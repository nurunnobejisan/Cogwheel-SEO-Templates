import { PageAuditData } from "../types/extension";

// Listen for messages from Side Panel or Popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "EXTRACT_PAGE_DATA") {
    const data = extractPageData();
    sendResponse({ success: true, data });
    return true;
  }

  if (request.type === "TOGGLE_OVERLAY") {
    handleToggleOverlay(request.overlayType, request.enabled);
    sendResponse({ success: true });
    return true;
  }

  if (request.type === "SCROLL_TO_ELEMENT") {
    const el = document.querySelector(request.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement).style.outline = "4px solid #10b981";
      setTimeout(() => {
        (el as HTMLElement).style.outline = "";
      }, 2500);
    }
    sendResponse({ success: true });
    return true;
  }
});

function extractPageData(): PageAuditData {
  const title = document.title || "";
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";

  const h1Elements = Array.from(document.querySelectorAll("h1"))
    .map((el) => el.innerText.trim())
    .filter(Boolean);
  const h2Elements = Array.from(document.querySelectorAll("h2"))
    .map((el) => el.innerText.trim())
    .filter(Boolean);
  const h3Elements = Array.from(document.querySelectorAll("h3"))
    .map((el) => el.innerText.trim())
    .filter(Boolean);

  const images = Array.from(document.querySelectorAll("img"));
  let imagesWithoutAlt = 0;
  let oversizedImages = 0;
  images.forEach((img) => {
    const alt = img.getAttribute("alt");
    if (!alt || alt.trim() === "") imagesWithoutAlt++;
    if (img.naturalWidth > 2000 || img.naturalHeight > 2000) oversizedImages++;
  });

  const bodyText = document.body ? document.body.innerText || "" : "";
  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;

  // JSON-LD Schemas
  const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const schemas: any[] = [];
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
    } catch {
      // ignore invalid json
    }
  });

  // Links
  const allAnchors = Array.from(document.querySelectorAll("a[href]"));
  let internal = 0;
  let external = 0;
  let nofollow = 0;
  const currentHost = window.location.hostname;

  allAnchors.forEach((a) => {
    const href = a.getAttribute("href") || "";
    const rel = a.getAttribute("rel") || "";
    if (rel.includes("nofollow")) nofollow++;

    try {
      const parsed = new URL(href, window.location.origin);
      if (parsed.hostname === currentHost || !parsed.hostname) {
        internal++;
      } else {
        external++;
      }
    } catch {
      internal++;
    }
  });

  // Open Graph
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || title;
  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || metaDesc;
  const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";

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
    h2Elements: h2Elements.slice(0, 20),
    h3Elements: h3Elements.slice(0, 20),
    totalImages: images.length,
    imagesWithoutAlt,
    oversizedImages,
    words,
    schemas,
    links: { internal, external, nofollow },
    hasViewport: !!document.querySelector('meta[name="viewport"]'),
    hasOgTitle: !!document.querySelector('meta[property="og:title"]'),
    hasOgImage: !!ogImg,
    ogTitle,
    ogDescription: ogDesc,
    ogImage: ogImg,
  };
}

// Visual DOM Overlay Handlers
function handleToggleOverlay(type: "headings" | "missingAlts" | "links", enabled: boolean) {
  const overlayId = `__cogwheel_${type}_overlay__`;
  const existing = document.getElementById(overlayId);

  if (!enabled) {
    if (existing) existing.remove();
    document.querySelectorAll(`[data-cogwheel-${type}]`).forEach((el) => {
      (el as HTMLElement).style.outline = "";
      (el as HTMLElement).removeAttribute(`data-cogwheel-${type}`);
    });
    return;
  }

  // Create style container if not present
  let styleEl = document.getElementById(overlayId) as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = overlayId;
    document.head.appendChild(styleEl);
  }

  if (type === "headings") {
    styleEl.textContent = `
      .cogwheel-heading-badge {
        position: absolute;
        top: -10px;
        left: 0;
        z-index: 999999;
        font-family: -apple-system, sans-serif;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        pointer-events: none;
      }
      .cogwheel-badge-h1 { background: #10b981; }
      .cogwheel-badge-h1-dup { background: #ef4444; }
      .cogwheel-badge-h2 { background: #0284c7; }
      .cogwheel-badge-h3 { background: #8b5cf6; }
    `;

    const h1s = Array.from(document.querySelectorAll("h1"));
    h1s.forEach((h1, i) => {
      h1.setAttribute("data-cogwheel-headings", "true");
      (h1 as HTMLElement).style.position = "relative";
      (h1 as HTMLElement).style.outline = i === 0 ? "2px dashed #10b981" : "3px solid #ef4444";
      const badge = document.createElement("span");
      badge.className = `cogwheel-heading-badge ${i === 0 ? "cogwheel-badge-h1" : "cogwheel-badge-h1-dup"}`;
      badge.textContent = i === 0 ? "H1 (Primary)" : `H1 Duplicate #${i + 1}`;
      h1.appendChild(badge);
    });

    document.querySelectorAll("h2").forEach((h2, i) => {
      h2.setAttribute("data-cogwheel-headings", "true");
      (h2 as HTMLElement).style.position = "relative";
      (h2 as HTMLElement).style.outline = "2px dotted #0284c7";
      const badge = document.createElement("span");
      badge.className = "cogwheel-heading-badge cogwheel-badge-h2";
      badge.textContent = `H2 #${i + 1}`;
      h2.appendChild(badge);
    });
  } else if (type === "missingAlts") {
    styleEl.textContent = `
      .cogwheel-alt-badge {
        position: absolute;
        bottom: 4px;
        left: 4px;
        z-index: 999999;
        background: #ef4444;
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        padding: 3px 6px;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }
    `;

    document.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt");
      if (!alt || alt.trim() === "") {
        img.setAttribute("data-cogwheel-missingAlts", "true");
        (img as HTMLElement).style.outline = "3px solid #ef4444";
        (img as HTMLElement).style.outlineOffset = "2px";
      }
    });
  } else if (type === "links") {
    const currentHost = window.location.hostname;
    document.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("data-cogwheel-links", "true");
      const href = a.getAttribute("href") || "";
      const rel = a.getAttribute("rel") || "";
      try {
        const url = new URL(href, window.location.origin);
        if (rel.includes("nofollow")) {
          (a as HTMLElement).style.outline = "2px solid #f59e0b";
        } else if (url.hostname === currentHost || !url.hostname) {
          (a as HTMLElement).style.outline = "1.5px solid #10b981";
        } else {
          (a as HTMLElement).style.outline = "1.5px solid #0284c7";
        }
      } catch {
        (a as HTMLElement).style.outline = "1.5px solid #10b981";
      }
    });
  }
}
