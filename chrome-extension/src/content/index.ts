import { PageAuditData, CmsAutoFillResult } from "../types/extension";
import { calculatePixelWidth } from "../utils/pixelCalculator";

// Listen for messages from Side Panel, Popup, or Background Worker
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "EXTRACT_PAGE_DATA") {
    const data = extractComprehensivePageData();
    sendResponse({ success: true, data });
    return true;
  }

  if (request.type === "TOGGLE_OVERLAY") {
    handleToggleOverlay(request.overlayType, request.enabled);
    sendResponse({ success: true });
    return true;
  }

  if (request.type === "INJECT_PREVIEW") {
    const result = handleInjectPreview(request.payload);
    sendResponse({ success: true, ...result });
    return true;
  }

  if (request.type === "AUTO_FILL_CMS") {
    const result = handleAutoFillCms(request.payload);
    sendResponse({ success: true, result });
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

// Comprehensive 1-Click Page Context Extractor
function extractComprehensivePageData(): PageAuditData {
  const title = document.title || "";
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  const metaRobots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "index, follow";
  const language = document.documentElement.lang || "en";

  // Accurate Google SERP Pixel Width Estimation (580px Title / 920px Meta Desc)
  const titlePixelWidth = calculatePixelWidth(title);
  const metaDescPixelWidth = calculatePixelWidth(metaDesc);

  // Full H1 - H6 Headings Outline
  const headingElements = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const allHeadings = headingElements.map((el) => ({
    tag: el.tagName.toUpperCase(),
    text: (el as HTMLElement).innerText.trim(),
  })).filter((h) => h.text.length > 0);

  const h1Elements = allHeadings.filter((h) => h.tag === "H1").map((h) => h.text);
  const h2Elements = allHeadings.filter((h) => h.tag === "H2").map((h) => h.text);
  const h3Elements = allHeadings.filter((h) => h.tag === "H3").map((h) => h.text);

  // Images Audit
  const rawImages = Array.from(document.querySelectorAll("img"));
  let imagesWithoutAlt = 0;
  let oversizedImages = 0;
  const imagesList = rawImages.slice(0, 30).map((img) => {
    const alt = img.getAttribute("alt") || "";
    const src = img.getAttribute("src") || "";
    const loading = img.getAttribute("loading") || "eager";
    if (!alt.trim()) imagesWithoutAlt++;
    if (img.naturalWidth > 2000 || img.naturalHeight > 2000) oversizedImages++;
    return { src, alt, loading };
  });

  // Body Copy, Word Count & Keyword Density
  const bodyText = document.body ? document.body.innerText || "" : "";
  const wordsArray = bodyText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter((w) => w.length > 2);
  const words = wordsArray.length;

  // Calculate top keyword frequencies (1-grams & 2-grams)
  const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "you", "are", "have", "our", "all", "your", "can"]);
  const termCounts: Record<string, number> = {};
  wordsArray.forEach((w) => {
    if (!stopWords.has(w) && w.length >= 3) {
      termCounts[w] = (termCounts[w] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(termCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, count]) => ({
      term,
      count,
      density: words > 0 ? `${((count / words) * 100).toFixed(1)}%` : "0%",
    }));

  // Extracted Hospitality Amenities & Topics
  const amenityCatalog = [
    "pool", "lazy river", "beachfront", "oceanfront", "balcony", "free wifi",
    "hot breakfast", "fitness center", "spa", "pet friendly", "valet parking",
    "ev charging", "rooftop bar", "restaurant", "meeting rooms", "suite",
    "waterpark", "concierge", "golf", "kitchenette"
  ];
  const extractedAmenities: string[] = [];
  const lowerBody = bodyText.toLowerCase();
  amenityCatalog.forEach((am) => {
    if (lowerBody.includes(am)) extractedAmenities.push(am);
  });

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

  // Links & Internal URL Discovery
  const allAnchors = Array.from(document.querySelectorAll("a[href]"));
  let internal = 0;
  let external = 0;
  let nofollow = 0;
  const currentHost = window.location.hostname;
  const internalUrlsSet = new Set<string>();

  allAnchors.forEach((a) => {
    const href = a.getAttribute("href") || "";
    const rel = a.getAttribute("rel") || "";
    if (rel.includes("nofollow")) nofollow++;

    try {
      const parsed = new URL(href, window.location.origin);
      if (parsed.hostname === currentHost || !parsed.hostname) {
        internal++;
        if (parsed.pathname && !parsed.pathname.match(/\.(jpg|png|pdf|svg|webp|css|js)$/i)) {
          internalUrlsSet.add(parsed.href);
        }
      } else {
        external++;
      }
    } catch {
      internal++;
    }
  });

  // Social & Review Links Discovery
  const socialPlatforms = [
    { platform: "TripAdvisor", regex: /tripadvisor\.com/i },
    { platform: "Google Maps", regex: /google\.com\/maps|maps\.app\.goo\.gl/i },
    { platform: "Yelp", regex: /yelp\.com/i },
    { platform: "Instagram", regex: /instagram\.com/i },
    { platform: "Facebook", regex: /facebook\.com/i },
    { platform: "Booking.com", regex: /booking\.com/i },
    { platform: "Expedia", regex: /expedia\.com/i },
  ];
  const socialLinks: Array<{ platform: string; url: string }> = [];
  allAnchors.forEach((a) => {
    const href = a.getAttribute("href") || "";
    socialPlatforms.forEach((sp) => {
      if (sp.regex.test(href) && !socialLinks.some((l) => l.platform === sp.platform)) {
        socialLinks.push({ platform: sp.platform, url: href });
      }
    });
  });

  // Detected NAP (Name, Address, Phone)
  const phoneRegex = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
  const phoneMatch = bodyText.match(phoneRegex);
  const detectedPhone = phoneMatch ? phoneMatch[0].trim() : undefined;

  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
  const emailMatch = bodyText.match(emailRegex);
  const detectedEmail = emailMatch ? emailMatch[0].trim() : undefined;

  let detectedAddress: string | undefined = undefined;
  const addressEl = document.querySelector("address, [itemprop='address'], .address, .hotel-address");
  if (addressEl) {
    detectedAddress = (addressEl as HTMLElement).innerText.trim().replace(/\s+/g, " ");
  }

  // Open Graph & Twitter Card tags
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || title;
  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || metaDesc;
  const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";

  const twCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute("content") || undefined;
  const twTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute("content") || undefined;
  const twDesc = document.querySelector('meta[name="twitter:description"]')?.getAttribute("content") || undefined;
  const twImg = document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") || undefined;

  return {
    url: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    title,
    titlePixelWidth,
    metaDesc,
    metaDescPixelWidth,
    metaRobots,
    language,
    canonical,
    h1Elements,
    h2Elements: h2Elements.slice(0, 20),
    h3Elements: h3Elements.slice(0, 20),
    allHeadings: allHeadings.slice(0, 30),
    totalImages: rawImages.length,
    imagesWithoutAlt,
    oversizedImages,
    imagesList,
    words,
    extractedAmenities,
    topKeywords,
    schemas,
    links: { internal, external, nofollow },
    internalUrls: Array.from(internalUrlsSet).slice(0, 25),
    hasViewport: !!document.querySelector('meta[name="viewport"]'),
    hasOgTitle: !!document.querySelector('meta[property="og:title"]'),
    hasOgImage: !!ogImg,
    ogTitle,
    ogDescription: ogDesc,
    ogImage: ogImg,
    twitterTags: {
      card: twCard,
      title: twTitle,
      description: twDesc,
      image: twImg,
    },
    detectedNap: {
      phone: detectedPhone,
      address: detectedAddress,
      email: detectedEmail,
    },
    socialLinks,
  };
}

// Live Page & CMS Auto-Injector
function handleInjectPreview(payload: { title?: string; metaDesc?: string; h1?: string; schemaJson?: string }) {
  const injected: string[] = [];

  if (payload.title) {
    document.title = payload.title;
    injected.push("Title Tag");
  }

  if (payload.metaDesc) {
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement("meta");
      descMeta.setAttribute("name", "description");
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute("content", payload.metaDesc);
    injected.push("Meta Description");
  }

  if (payload.h1) {
    const h1 = document.querySelector("h1");
    if (h1) {
      h1.innerText = payload.h1;
      (h1 as HTMLElement).style.outline = "4px solid #10b981";
      (h1 as HTMLElement).style.transition = "outline 0.4s ease";
      setTimeout(() => {
        (h1 as HTMLElement).style.outline = "";
      }, 3000);
      injected.push("H1 Headline");
    }
  }

  if (payload.schemaJson) {
    let script = document.getElementById("__cogwheel_preview_schema__");
    if (!script) {
      script = document.createElement("script");
      script.id = "__cogwheel_preview_schema__";
      script.setAttribute("type", "application/ld+json");
      document.head.appendChild(script);
    }
    script.textContent = payload.schemaJson;
    injected.push("JSON-LD Schema");
  }

  return { injected };
}

// Auto-Detect & Auto-Fill Common CMS / SEO Plugin Fields
function handleAutoFillCms(payload: { title?: string; metaDesc?: string; slug?: string }): CmsAutoFillResult {
  const filledFields: string[] = [];
  let detectedCms: CmsAutoFillResult["detectedCms"] = "Generic/DOM";

  // Helper to trigger events on inputs
  const triggerInput = (el: HTMLInputElement | HTMLTextAreaElement, val: string) => {
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  // 1. WordPress Yoast SEO
  const yoastTitle = document.querySelector<HTMLInputElement>("#yoast-google-preview-title-metabox, #yoast_wpseo_title");
  const yoastDesc = document.querySelector<HTMLTextAreaElement>("#yoast-google-preview-description-metabox, #yoast_wpseo_metadesc");
  if (yoastTitle || yoastDesc) {
    detectedCms = "WordPress/Yoast";
    if (yoastTitle && payload.title) {
      triggerInput(yoastTitle, payload.title);
      filledFields.push("Yoast SEO Title");
    }
    if (yoastDesc && payload.metaDesc) {
      triggerInput(yoastDesc, payload.metaDesc);
      filledFields.push("Yoast Meta Description");
    }
    return { detectedCms, filledFields, success: filledFields.length > 0 };
  }

  // 2. WordPress Rank Math
  const rmTitle = document.querySelector<HTMLInputElement>("#rank_math_title");
  const rmDesc = document.querySelector<HTMLTextAreaElement>("#rank_math_description");
  if (rmTitle || rmDesc) {
    detectedCms = "WordPress/RankMath";
    if (rmTitle && payload.title) {
      triggerInput(rmTitle, payload.title);
      filledFields.push("Rank Math Title");
    }
    if (rmDesc && payload.metaDesc) {
      triggerInput(rmDesc, payload.metaDesc);
      filledFields.push("Rank Math Description");
    }
    return { detectedCms, filledFields, success: filledFields.length > 0 };
  }

  // 3. WordPress Gutenberg / Classic Title
  const wpTitle = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(".editor-post-title__input, #title");
  if (wpTitle && payload.title) {
    detectedCms = "WordPress/Classic";
    triggerInput(wpTitle, payload.title);
    filledFields.push("Post/Page Title");
  }

  // 4. Webflow CMS Editor
  const wfTitle = document.querySelector<HTMLInputElement>('[data-automation-id="page-title-input"], input[name="title"]');
  const wfDesc = document.querySelector<HTMLTextAreaElement>('[data-automation-id="page-description-input"], textarea[name="description"]');
  if (wfTitle || wfDesc) {
    detectedCms = "Webflow";
    if (wfTitle && payload.title) {
      triggerInput(wfTitle, payload.title);
      filledFields.push("Webflow SEO Title");
    }
    if (wfDesc && payload.metaDesc) {
      triggerInput(wfDesc, payload.metaDesc);
      filledFields.push("Webflow Meta Description");
    }
    return { detectedCms, filledFields, success: filledFields.length > 0 };
  }

  // 5. Shopify Admin
  const shTitle = document.querySelector<HTMLInputElement>("#seo-title, #page-title");
  const shDesc = document.querySelector<HTMLTextAreaElement>("#seo-description, #page-description");
  if (shTitle || shDesc) {
    detectedCms = "Shopify";
    if (shTitle && payload.title) {
      triggerInput(shTitle, payload.title);
      filledFields.push("Shopify SEO Title");
    }
    if (shDesc && payload.metaDesc) {
      triggerInput(shDesc, payload.metaDesc);
      filledFields.push("Shopify Meta Description");
    }
    return { detectedCms, filledFields, success: filledFields.length > 0 };
  }

  // 6. Generic Fallback (Inject into active DOM)
  if (payload.title) {
    document.title = payload.title;
    filledFields.push("DOM Document Title");
  }
  if (payload.metaDesc) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", payload.metaDesc);
    filledFields.push("DOM Meta Description");
  }

  return { detectedCms, filledFields, success: filledFields.length > 0 };
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
