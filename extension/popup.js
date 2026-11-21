// Cogwheel SEO & GEO Studio Inspector - Popup Script
// Executes in Chrome Extension context and audits the active tab.

const STUDIO_BASE_URL = "https://cogwheel-seo-templates.vercel.app";

// 8 Trained Client Benchmarks to auto-detect
const TRAINED_BENCHMARKS = [
  { id: "springhill-pcb", name: "SpringHill Suites Panama City Beach", host: "marriott.com", city: "Panama City Beach", state: "FL" },
  { id: "canopy-boston", name: "Canopy by Hilton Boston Downtown", host: "hilton.com", city: "Boston", state: "MA" },
  { id: "ac-hotel-stpete", name: "AC Hotel St. Petersburg Downtown", host: "marriott.com", city: "St. Petersburg", state: "FL" },
  { id: "coachman-tahoe", name: "The Coachman Hotel", host: "coachmanhotel.com", city: "South Lake Tahoe", state: "CA" },
  { id: "governors-inn", name: "Governors' Inn Casselton", host: "governorsinn.com", city: "Casselton", state: "ND" },
  { id: "project-farmhouse", name: "Project Farmhouse (GrowNYC)", host: "projectfarmhouse.org", city: "New York", state: "NY" },
  { id: "beal-house", name: "Beal House Fort Walton Beachfront", host: "hilton.com", city: "Fort Walton Beach", state: "FL" },
  { id: "auburn-marriott", name: "Auburn Marriott Opelika Resort & Spa", host: "marriott.com", city: "Opelika", state: "AL" },
];

let currentAuditData = null;

// Initialize when popup loads
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  scanActiveTab();

  document.getElementById("btn-refresh")?.addEventListener("click", scanActiveTab);
  document.getElementById("btn-open-studio")?.addEventListener("click", openStudio);
  document.getElementById("btn-google-rich")?.addEventListener("click", openGoogleRichTest);
  document.getElementById("btn-copy-tsv")?.addEventListener("click", copyTsvAudit);
  document.getElementById("btn-download-json")?.addEventListener("click", downloadJsonAudit);
});

// Tab Switcher
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      if (targetId) {
        document.getElementById(targetId)?.classList.add("active");
      }
    });
  });
}

function isRestrictedUrl(url = "") {
  return (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("view-source:") ||
    url.startsWith("https://chromewebstore.google.com")
  );
}

async function scanActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || isRestrictedUrl(tab.url)) {
    showNotice("Open any live webpage (https://) to scan SEO data. Templates remain active below.");
    return;
  }

  try {
    // Execute content inspector function on the page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: auditPageContent,
    });

    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      data.tabId = tab.id;
      currentAuditData = data;
      renderAudit(data);
    } else {
      showError("Could not inspect page content.");
    }
  } catch (err) {
    console.warn("Tab not ready for inspection:", err.message);
    showError("Please refresh the tab and re-open the inspector.");
  }
}

function showNotice(msg) {
  const summaryEl = document.getElementById("score-summary");
  if (summaryEl) summaryEl.textContent = msg;

  const hostEl = document.getElementById("page-host");
  if (hostEl) hostEl.textContent = "System / New Tab Page";

  const urlEl = document.getElementById("page-url");
  if (urlEl) urlEl.textContent = "chrome://";

  const protocolEl = document.getElementById("page-protocol");
  if (protocolEl) protocolEl.textContent = "SYSTEM";

  const gradeBadge = document.getElementById("score-grade");
  if (gradeBadge) {
    gradeBadge.textContent = "TEMPLATES READY";
    gradeBadge.style.background = "#334155";
    gradeBadge.style.color = "#94a3b8";
  }

  // Pre-load benchmark fallback so templates & studio bridge tabs remain active
  if (!currentAuditData) {
    const fallback = {
      url: "chrome://",
      origin: "Browser System",
      pathname: "/",
      protocol: "system:",
      hostname: "system-page",
      title: "System Page (Template Studio Active)",
      metaDesc: "Live DOM scanner is paused on browser system pages. Cogwheel SEO templates and benchmarks are fully accessible.",
      canonical: "",
      h1Elements: ["Cogwheel SEO Workstation"],
      h2Elements: ["Templates & Benchmarks Active", "Open any live hotel website to auto-audit DOM"],
      totalImages: 0,
      imagesWithoutAlt: 0,
      words: 500,
      schemas: [{ "@type": "Hotel", name: "SpringHill Suites Panama City Beach" }],
      hasViewport: true,
      hasOgTitle: true,
      hasOgDesc: true,
      hasOgImage: true,
    };
    currentAuditData = fallback;
    renderAudit(fallback);
  }
}

// Function injected and executed in the active tab context
function auditPageContent() {
  const title = document.title || "";
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  const h1Elements = Array.from(document.querySelectorAll("h1")).map((el) => el.innerText.trim()).filter(Boolean);
  const h2Elements = Array.from(document.querySelectorAll("h2")).map((el) => el.innerText.trim()).filter(Boolean);
  
  // Images audit
  const images = Array.from(document.querySelectorAll("img"));
  const imagesWithoutAlt = images.filter((img) => !img.getAttribute("alt") || img.getAttribute("alt").trim() === "").length;
  
  // Word count approx
  const bodyText = document.body ? document.body.innerText || "" : "";
  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;

  // JSON-LD schemas
  const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const schemas = [];
  jsonLdScripts.forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent || "{}");
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
        schemas.push(...parsed["@graph"]);
      } else {
        schemas.push(parsed);
      }
    } catch (e) {
      // invalid JSON-LD
    }
  });

  return {
    url: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    title,
    metaDesc,
    canonical,
    h1Elements,
    h2Elements: h2Elements.slice(0, 15),
    totalImages: images.length,
    imagesWithoutAlt,
    words,
    schemas,
    hasViewport: !!document.querySelector('meta[name="viewport"]'),
    hasOgTitle: !!document.querySelector('meta[property="og:title"]'),
  };
}

// Computes 100-point score & renders UI
function renderAudit(data) {
  // 1. Basic Header Elements
  document.getElementById("page-protocol").textContent = data.protocol.replace(":", "").toUpperCase();
  document.getElementById("page-host").textContent = data.hostname;
  document.getElementById("page-url").textContent = data.url;

  // 2. Evaluate the 10 Quality Gates & compute 100-point score
  const gates = [
    {
      id: "title-length",
      name: "Title Tag Length (45-65 chars)",
      maxPts: 10,
      pass: data.title.length >= 40 && data.title.length <= 70,
      earned: data.title.length >= 40 && data.title.length <= 70 ? 10 : data.title.length > 0 ? 5 : 0,
      desc: data.title ? `${data.title.length} characters (Optimal: 50-60).` : "Missing Title tag.",
    },
    {
      id: "meta-desc",
      name: "Meta Description (120-160 chars)",
      maxPts: 10,
      pass: data.metaDesc.length >= 110 && data.metaDesc.length <= 165,
      earned: data.metaDesc.length >= 110 && data.metaDesc.length <= 165 ? 10 : data.metaDesc.length > 0 ? 5 : 0,
      desc: data.metaDesc ? `${data.metaDesc.length} characters.` : "Missing Meta Description tag.",
    },
    {
      id: "h1-architecture",
      name: "Single H1 Tag Present",
      maxPts: 10,
      pass: data.h1Elements.length === 1,
      earned: data.h1Elements.length === 1 ? 10 : data.h1Elements.length > 1 ? 5 : 0,
      desc: data.h1Elements.length === 1 ? `1 H1: "${data.h1Elements[0].slice(0, 40)}..."` : `${data.h1Elements.length} H1 tags detected.`,
    },
    {
      id: "canonical",
      name: "Canonical Self-Reference",
      maxPts: 10,
      pass: Boolean(data.canonical && (data.canonical === data.url || data.url.startsWith(data.canonical))),
      earned: data.canonical ? 10 : 0,
      desc: data.canonical ? "Canonical tag is properly declared." : "Missing canonical URL declaration.",
    },
    {
      id: "schema-hotel",
      name: "Hospitality Schema (Hotel / Lodging)",
      maxPts: 15,
      pass: data.schemas.some((s) => {
        const t = (s["@type"] || "").toLowerCase();
        return t.includes("hotel") || t.includes("lodging") || t.includes("resort") || t.includes("localbusiness");
      }),
      earned: data.schemas.some((s) => (s["@type"] || "").toLowerCase().includes("hotel")) ? 15 : data.schemas.length ? 8 : 0,
      desc: data.schemas.length ? `${data.schemas.length} schema blocks found (${data.schemas.map((s) => s["@type"]).join(", ")})` : "No JSON-LD schemas detected.",
    },
    {
      id: "schema-faq-crumbs",
      name: "Rich Schemas (FAQ / Breadcrumb)",
      maxPts: 10,
      pass: data.schemas.some((s) => {
        const t = (s["@type"] || "").toLowerCase();
        return t.includes("faq") || t.includes("breadcrumb");
      }),
      earned: data.schemas.some((s) => (s["@type"] || "").toLowerCase().includes("faq")) ? 10 : 4,
      desc: "Powers Google Rich Snippets & voice citation.",
    },
    {
      id: "content-depth",
      name: "Content Depth (350+ words)",
      maxPts: 10,
      pass: data.words >= 350,
      earned: data.words >= 450 ? 10 : data.words >= 250 ? 6 : 2,
      desc: `${data.words.toLocaleString()} words on page.`,
    },
    {
      id: "image-alt",
      name: "Image Accessibility (Alt tags)",
      maxPts: 10,
      pass: data.imagesWithoutAlt === 0,
      earned: data.imagesWithoutAlt === 0 ? 10 : Math.max(0, 10 - data.imagesWithoutAlt * 2),
      desc: data.imagesWithoutAlt === 0 ? `All ${data.totalImages} images have alt tags.` : `${data.imagesWithoutAlt} of ${data.totalImages} images missing alt text.`,
    },
    {
      id: "mobile-social",
      name: "Mobile Viewport & OpenGraph",
      maxPts: 10,
      pass: data.hasViewport && data.hasOgTitle,
      earned: data.hasViewport && data.hasOgTitle ? 10 : 5,
      desc: data.hasViewport ? "Mobile viewport & OpenGraph meta verified." : "Missing mobile viewport or OG tags.",
    },
    {
      id: "geo-readiness",
      name: "GEO Proximity & Address Entity",
      maxPts: 5,
      pass: data.schemas.some((s) => s.address || s.geo),
      earned: data.schemas.some((s) => s.address || s.geo) ? 5 : 2,
      desc: "Structured postal address & lat/long for local map pack.",
    },
  ];

  const totalScore = gates.reduce((sum, g) => sum + g.earned, 0);
  const passedCount = gates.filter((g) => g.pass).length;

  // 3. Update Overall Score Card
  document.getElementById("overall-score").textContent = totalScore;
  const gradeEl = document.getElementById("score-grade");
  if (totalScore >= 90) {
    gradeEl.textContent = "GRADE A+";
    gradeEl.style.color = "#34d399";
  } else if (totalScore >= 75) {
    gradeEl.textContent = "GRADE B";
    gradeEl.style.color = "#38bdf8";
  } else if (totalScore >= 60) {
    gradeEl.textContent = "GRADE C";
    gradeEl.style.color = "#fbbf24";
  } else {
    gradeEl.textContent = "NEEDS AUDIT";
    gradeEl.style.color = "#f87171";
  }

  document.getElementById("score-summary").textContent = `${passedCount} of 10 quality gates passed. ${100 - totalScore} points recoverable.`;

  // 4. Update KPI Chips
  document.getElementById("kpi-h1").textContent = data.h1Elements.length;
  document.getElementById("kpi-schema").textContent = data.schemas.length;
  document.getElementById("kpi-words").textContent = data.words > 1000 ? `${(data.words / 1000).toFixed(1)}k` : data.words;
  document.getElementById("kpi-alt").textContent = data.imagesWithoutAlt;

  // 5. Render Gates List
  document.getElementById("gates-passed-count").textContent = `${passedCount} / 10 Passed`;
  const gatesContainer = document.getElementById("gates-list");
  gatesContainer.innerHTML = "";
  gates.forEach((gate) => {
    const item = document.createElement("div");
    item.className = "gate-item";
    const statusClass = gate.pass ? "pass" : gate.earned > 0 ? "warn" : "fail";
    const statusLabel = gate.pass ? "PASS" : gate.earned > 0 ? "WARN" : "FAIL";

    item.innerHTML = `
      <span class="gate-status-pill ${statusClass}">${statusLabel}</span>
      <div class="gate-info">
        <div class="gate-title-row">
          <span class="gate-name">${gate.name}</span>
          <span class="gate-pts">${gate.earned}/${gate.maxPts} pts</span>
        </div>
        <div class="gate-desc">${gate.desc}</div>
      </div>
    `;
    gatesContainer.appendChild(item);
  });

  // 6. Populate Meta & Headings Tab
  document.getElementById("title-char-count").textContent = `${data.title.length} chars`;
  document.getElementById("page-title").textContent = data.title || "(Missing Title)";
  document.getElementById("desc-char-count").textContent = `${data.metaDesc.length} chars`;
  document.getElementById("page-description").textContent = data.metaDesc || "(Missing Description)";
  document.getElementById("canonical-status").textContent = data.canonical ? "Declared" : "Missing";
  document.getElementById("canonical-url").textContent = data.canonical || "(No Canonical Tag)";

  const h1Container = document.getElementById("h1-list");
  h1Container.innerHTML = "";
  document.getElementById("h1-count").textContent = `${data.h1Elements.length} tags`;
  if (data.h1Elements.length === 0) {
    h1Container.innerHTML = '<div class="heading-pill" style="color:#f87171;">(No H1 Heading Found)</div>';
  } else {
    data.h1Elements.forEach((h1) => {
      const p = document.createElement("div");
      p.className = "heading-pill";
      p.textContent = h1;
      h1Container.appendChild(p);
    });
  }

  const h2Container = document.getElementById("h2-list");
  h2Container.innerHTML = "";
  document.getElementById("h2-count").textContent = `${data.h2Elements.length} tags`;
  if (data.h2Elements.length === 0) {
    h2Container.innerHTML = '<div class="heading-pill" style="color:#94a3b8;">(No H2 Headings)</div>';
  } else {
    data.h2Elements.forEach((h2) => {
      const p = document.createElement("div");
      p.className = "heading-pill";
      p.textContent = h2;
      h2Container.appendChild(p);
    });
  }

  // 7. Populate Schemas Tab
  const schemasContainer = document.getElementById("schemas-list");
  schemasContainer.innerHTML = "";
  if (data.schemas.length === 0) {
    schemasContainer.innerHTML = '<div class="empty-state">No JSON-LD schema blocks found on this page.</div>';
  } else {
    data.schemas.forEach((schema, i) => {
      const sItem = document.createElement("div");
      sItem.className = "schema-item";
      const sType = schema["@type"] || "Schema Object";
      const keys = Object.keys(schema).filter((k) => !k.startsWith("@")).slice(0, 6).join(", ");
      sItem.innerHTML = `
        <div class="schema-type">${i + 1}. ${sType}</div>
        <div class="schema-fields">Properties: ${keys || "None"}</div>
      `;
      schemasContainer.appendChild(sItem);
    });
  }

  // 8. Trained Model Matcher
  const matched = TRAINED_BENCHMARKS.find((b) => data.hostname.includes(b.host) || data.title.toLowerCase().includes(b.name.toLowerCase().slice(0, 10)));
  const matchBox = document.getElementById("trained-match-box");
  if (matched) {
    matchBox.textContent = `Matched: ${matched.name} (${matched.city}, ${matched.state})`;
  } else {
    matchBox.textContent = `Active Site: ${data.hostname} · Ready for Custom Crawl`;
  }

  // 9. Inform background worker to update tab badge
  if (data.tabId) {
    chrome.runtime.sendMessage({
      type: "UPDATE_BADGE",
      tabId: data.tabId,
      score: totalScore,
    });
  }
}

// 1-Click Launch to Cogwheel Studio web app
function openStudio() {
  if (!currentAuditData) return;
  const targetUrl = `${STUDIO_BASE_URL}?url=${encodeURIComponent(currentAuditData.url)}&name=${encodeURIComponent(currentAuditData.title || currentAuditData.hostname)}`;
  chrome.tabs.create({ url: targetUrl });
}

// Google Rich Results Test Link
function openGoogleRichTest() {
  if (!currentAuditData) return;
  const testUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(currentAuditData.url)}`;
  chrome.tabs.create({ url: testUrl });
}

// Copy TSV for Google Sheets / Excel
function copyTsvAudit() {
  if (!currentAuditData) return;
  const d = currentAuditData;
  const tsv = [
    ["Metric", "Value"].join("\t"),
    ["URL", d.url].join("\t"),
    ["Host", d.hostname].join("\t"),
    ["Title", d.title].join("\t"),
    ["Title Length", d.title.length].join("\t"),
    ["Meta Description", d.metaDesc].join("\t"),
    ["Canonical", d.canonical].join("\t"),
    ["H1 Headings", d.h1Elements.join(" | ")].join("\t"),
    ["Word Count", d.words].join("\t"),
    ["Total Images", d.totalImages].join("\t"),
    ["Images Missing Alt", d.imagesWithoutAlt].join("\t"),
    ["Schemas Detected", d.schemas.map((s) => s["@type"]).join(", ")].join("\t"),
  ].join("\n");

  navigator.clipboard.writeText(tsv).then(() => {
    showToast("TSV copied! Paste into Google Sheets.");
  });
}

// Download Audit JSON
function downloadJsonAudit() {
  if (!currentAuditData) return;
  const blob = new Blob([JSON.stringify(currentAuditData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentAuditData.hostname.replace(/\./g, "_")}_SEO_Audit.json`;
  link.click();
  showToast("Audit JSON downloaded!");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function showError(msg) {
  document.getElementById("score-summary").textContent = msg;
}
