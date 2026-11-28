import { PageAuditData, CmsAutoFillResult } from "../types/extension";
import { calculatePixelWidth } from "../utils/pixelCalculator";
import { SEO_STUDIO_OPTIMAL_AUDIT_DATA } from "../data/seoStudioTemplates";
import { extractCapturedWebSample } from "../../../shared/ts/training-capture";
import { classifyPageTypeForAudit } from "../utils/pageTypeClassification";

function isTopLevelWindow(): boolean {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

// Listen for messages from Side Panel, Popup, or Background Worker
if (!(window as any).__SEO_STUDIO_MESSAGE_LISTENER__) {
  (window as any).__SEO_STUDIO_MESSAGE_LISTENER__ = true;
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!isTopLevelWindow()) {
    return false;
  }
  if (request.type === "PING") {
    sendResponse({ status: "PONG" });
    return true;
  }

  if (request.type === "CAPTURE_TRAINING_SAMPLE") {
    const sample = extractCapturedWebSample();
    sendResponse({ success: true, sample });
    return true;
  }

  if (request.type === "EXTRACT_PAGE_DATA") {
    try {
      const data = extractComprehensivePageData();
      sendResponse({ success: true, data });
    } catch (err) {
      console.warn("[SEO Studio Content] Extraction error:", err);
      sendResponse({ success: false, error: String(err) });
    }
    return true;
  }

  if (request.type === "TOGGLE_OVERLAY") {
    handleToggleOverlay(request.overlayType, request.enabled);
    sendResponse({ success: true });
    return true;
  }

  if (request.type === "CLEAR_ALL_OVERLAYS") {
    handleClearAllOverlays();
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

  if (request.type === "FILL_ACTIVE_CMS_FIELD") {
    const result = handleFillActiveCmsField(request.payload);
    sendResponse({ success: true, result });
    return true;
  }

  if (request.type === "UNDO_CMS_FILL") {
    const result = handleUndoCmsFill();
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
}

// ---------------------------------------------------------------------------
// Universal Classification & Extraction Helpers
// ---------------------------------------------------------------------------

function detectUniversalCms(): { cms: PageAuditData["detectedCms"]; label: string } {
  const html = (document.documentElement ? document.documentElement.outerHTML : "").slice(0, 20000);
  const scripts = Array.from(document.scripts)
    .map((s) => (s.src || "") + " " + (s.innerText || ""))
    .join(" ");
  const metaGen = document.querySelector('meta[name="generator"]')?.getAttribute("content") || "";

  if (/Shopify\.theme|cdn\.shopify\.com/i.test(scripts) || /shopify/i.test(metaGen) || (window as unknown as { Shopify?: unknown }).Shopify) {
    return { cms: "Shopify", label: "Shopify Store" };
  }
  if (/assets\.website-files\.com|data-wf-page/i.test(html) || /webflow/i.test(metaGen)) {
    return { cms: "Webflow", label: "Webflow CMS" };
  }
  if (/wp-content|wp-includes/i.test(html) || /wordpress/i.test(metaGen)) {
    if (/yoast/i.test(html) || /yoast-schema/i.test(html)) {
      return { cms: "WordPress/Yoast", label: "WordPress + Yoast SEO" };
    }
    if (/rank-math/i.test(html) || /rankmath/i.test(html)) {
      return { cms: "WordPress/RankMath", label: "WordPress + RankMath" };
    }
    return { cms: "WordPress/Classic", label: "WordPress Native" };
  }
  if (/__NEXT_DATA__|\/_next\//i.test(html)) {
    return { cms: "Next.js", label: "Next.js (SSR / React)" };
  }
  if (/squarespace/i.test(html) || /squarespace/i.test(metaGen)) {
    return { cms: "Squarespace", label: "Squarespace" };
  }
  if (/wix\.com|parastorage/i.test(html) || /wix/i.test(metaGen)) {
    return { cms: "Wix", label: "Wix Engine" };
  }
  if (/ghost/i.test(metaGen)) {
    return { cms: "Ghost", label: "Ghost Publishing" };
  }
  return { cms: "Generic/DOM", label: "Standard Web Application" };
}

function detectUniversalSiteCategory(
  bodyText: string,
  schemas: Array<Record<string, unknown>>,
  title: string,
  url: string
): { category: PageAuditData["siteCategory"]; label: string } {
  const lowerText = (bodyText + " " + title + " " + url).toLowerCase();
  const schemaTypes = schemas.map((s) => String(s["@type"] || "")).flat().join(" ").toLowerCase();

  // 1. E-Commerce Check
  const isEcom =
    schemaTypes.includes("product") ||
    schemaTypes.includes("offer") ||
    Boolean(document.querySelector('meta[property="product:price:amount"]')) ||
    Boolean(document.querySelector(".add-to-cart, [data-add-to-cart], #add-to-cart, .cart-button, [name='add']")) ||
    /(\$\d+(\.\d{2})?|\badd to cart\b|\bcheckout\b|\bfree shipping\b|\bsku:\b)/i.test(lowerText);
  if (isEcom) {
    return { category: "ecommerce", label: "E-Commerce & Retail" };
  }

  // 2. Hospitality Check
  const isHospitality =
    schemaTypes.includes("hotel") ||
    schemaTypes.includes("resort") ||
    schemaTypes.includes("lodging") ||
    schemaTypes.includes("restaurant") ||
    /\b(hotel|resort|suites|guestroom|check-in|checkout time|amenities|heated pool|oceanfront|beachfront|valet parking|king bed)\b/i.test(lowerText);
  if (isHospitality) {
    return { category: "hospitality", label: "Hospitality & Travel" };
  }

  // 3. Editorial & Media Check
  const isEditorial =
    schemaTypes.includes("article") ||
    schemaTypes.includes("newsarticle") ||
    schemaTypes.includes("blogposting") ||
    Boolean(document.querySelector('meta[property="article:published_time"], .byline, .author-name, .entry-date'));
  if (isEditorial) {
    return { category: "editorial", label: "Editorial & Media" };
  }

  // 4. SaaS & Technology Check
  const isSaas =
    /\b(saas|api documentation|pricing plans|free trial|sign in to dashboard|integrations|developer docs|github)\b/i.test(lowerText);
  if (isSaas) {
    return { category: "saas", label: "SaaS & Technology" };
  }

  // 5. Local Business Check
  const isLocal =
    schemaTypes.includes("localbusiness") ||
    Boolean(document.querySelector("address, [itemprop='address']")) ||
    /\b(opening hours|our office|call today|directions|mon-fri)\b/i.test(lowerText);
  if (isLocal) {
    return { category: "local_business", label: "Local Business & Services" };
  }

  return { category: "general", label: "Universal Website" };
}

function generateUniversalProposedAlt(
  src: string,
  currentAlt: string,
  pageTitle: string,
  isDecorative: boolean,
  category: string
): string {
  if (isDecorative) return "";
  if (currentAlt && currentAlt.trim().length >= 12 && !/\.(?:jpg|png|webp|jpeg|svg|gif)$/i.test(currentAlt)) {
    return currentAlt.trim();
  }

  const rawFile = (src.split("/").pop() || "").split("?")[0].replace(/\.[a-zA-Z0-9]+$/i, "");
  const cleanTokens = rawFile.replace(/[-_]+/g, " ").replace(/^(image|img|photo|dsc|banner|icon)\b/gi, "").trim();
  const siteBrand = pageTitle.split(/\s*[-|–|—]\s*/)[0].trim() || "Featured View";

  let alt = `${siteBrand} ${cleanTokens || "visual highlight"}`;
  if (category === "hospitality") alt += " accommodation and guest amenities";
  else if (category === "ecommerce") alt += " product view and detailing";
  else if (category === "editorial") alt += " editorial feature photo";
  else alt += " overview and contextual detail";

  alt = alt.replace(/\b(?:image of|photo of|picture of)\s+/gi, "").trim();
  if (alt.length < 40) alt = `${siteBrand} - ${alt}`;
  if (alt.length > 120) alt = alt.slice(0, 117).trim() + "...";
  return alt;
}

function generateUniversalTargetFilename(proposedAlt: string, fallbackSrc: string): string {
  if (proposedAlt) {
    const slug = proposedAlt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50)
      .replace(/^-|-$/g, "");
    if (slug) return `${slug}.webp`;
  }
  const rawFile = (fallbackSrc.split("/").pop() || "image").split("?")[0].replace(/\.[a-zA-Z0-9]+$/i, "");
  const base = rawFile.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
  return `${base || "asset"}.webp`;
}

function extractComprehensiveHeadings() {
  const elements = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const hierarchy: NonNullable<PageAuditData["headingHierarchy"]> = [];
  const issues: string[] = [];
  let previousLevel = 0;

  elements.forEach((el) => {
    const tag = el.tagName.toUpperCase() as "H1" | "H2" | "H3" | "H4" | "H5" | "H6";
    const level = parseInt(tag.replace("H", ""), 10);
    const text = (el as HTMLElement).innerText.trim();
    const isEmpty = text.length === 0;
    const isTooLong = text.length > 70;

    let isSkippedLevel = false;
    if (previousLevel > 0 && level > previousLevel + 1) {
      isSkippedLevel = true;
      issues.push(`Skipped heading level: H${previousLevel} jumps directly to H${level} without H${previousLevel + 1}`);
    }

    const suggestedTitleCase = text
      ? text
          .toLowerCase()
          .split(" ")
          .map((w, idx) => {
            const lower = w.toLowerCase();
            if (idx > 0 && ["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "over", "in", "of"].includes(lower)) {
              return lower;
            }
            return w.charAt(0).toUpperCase() + w.slice(1);
          })
          .join(" ")
      : undefined;

    hierarchy.push({
      tag,
      text: text || "[EMPTY HEADING]",
      level,
      isEmpty,
      isSkippedLevel,
      isTooLong,
      suggestedTitleCase,
    });

    if (!isEmpty) {
      previousLevel = level;
    }
  });

  const h1Count = hierarchy.filter((h) => h.tag === "H1" && !h.isEmpty).length;
  if (h1Count === 0) {
    issues.unshift("Missing H1: Page has no primary H1 heading tag.");
  } else if (h1Count > 1) {
    issues.unshift(`Multiple H1s: Found ${h1Count} separate H1 tags on page. Best practice is 1 primary H1.`);
    hierarchy.forEach((h) => {
      if (h.tag === "H1") h.isMultipleH1 = true;
    });
  }

  const allHeadings = hierarchy.filter((h) => !h.isEmpty).map((h) => ({ tag: h.tag, text: h.text }));
  const h1Elements = hierarchy.filter((h) => h.tag === "H1" && !h.isEmpty).map((h) => h.text);
  const h2Elements = hierarchy.filter((h) => h.tag === "H2" && !h.isEmpty).map((h) => h.text);
  const h3Elements = hierarchy.filter((h) => h.tag === "H3" && !h.isEmpty).map((h) => h.text);

  return { allHeadings, h1Elements, h2Elements, h3Elements, headingHierarchy: hierarchy, headingIssues: issues };
}

function extractComprehensiveImages(category: string, pageTitle: string) {
  const imgEls = Array.from(document.querySelectorAll("img, [style*='background-image']"));
  let imagesWithoutAlt = 0;
  let oversizedImages = 0;
  let clsRiskCount = 0;
  let lcpLazyDelayCount = 0;
  let legacyFormatCount = 0;
  let legacyBytesEst = 0;

  const detailedImages: NonNullable<PageAuditData["detailedImages"]> = [];
  const imagesList: Array<{ src: string; alt: string; loading?: string }> = [];

  imgEls.forEach((el, idx) => {
    let src = "";
    let alt: string | null = null;
    let loading = "eager";
    let width: number | null = null;
    let height: number | null = null;
    let isDecorative = false;

    if (el.tagName.toLowerCase() === "img") {
      const img = el as HTMLImageElement;
      src =
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-original") ||
        img.src ||
        "";
      alt = img.getAttribute("alt");
      loading = img.getAttribute("loading") || "eager";
      const wAttr = img.getAttribute("width");
      const hAttr = img.getAttribute("height");
      width = wAttr ? parseInt(wAttr, 10) : img.naturalWidth || null;
      height = hAttr ? parseInt(hAttr, 10) : img.naturalHeight || null;

      const role = img.getAttribute("role");
      const ariaHidden = img.getAttribute("aria-hidden");
      if (alt === "" || role === "presentation" || role === "none" || ariaHidden === "true") {
        isDecorative = true;
      }
    } else {
      const bg = window.getComputedStyle(el).backgroundImage;
      const match = bg.match(/url\(["']?([^"']*)["']?\)/i);
      if (match && match[1]) {
        src = match[1];
        isDecorative = true;
        alt = "";
      }
    }

    if (!src || src.startsWith("data:")) return;

    try {
      src = new URL(src, window.location.href).href;
    } catch {
      return;
    }

    let format = "JPEG";
    const ext = src.split(".").pop()?.split("?")[0].toUpperCase() || "";
    if (["WEBP", "AVIF", "PNG", "SVG", "GIF"].includes(ext)) {
      format = ext === "WEBP" ? "WebP" : ext;
    }

    const issues: string[] = [];
    if (alt === null && !isDecorative) {
      imagesWithoutAlt++;
      issues.push("Missing Alt Attribute (Fails WCAG 2.2 AA)");
    }
    if ((width && width > 2000) || (height && height > 2000)) {
      oversizedImages++;
      issues.push("Oversized Image (>2000px)");
    }
    if (!width || !height) {
      clsRiskCount++;
      issues.push("Missing Explicit Dimensions (CLS Risk)");
    }
    if (idx <= 1 && loading === "lazy") {
      lcpLazyDelayCount++;
      issues.push("Above-Fold Lazy-Loading (Hurts LCP)");
    }
    if (["JPEG", "PNG", "GIF"].includes(format)) {
      legacyFormatCount++;
      legacyBytesEst += 80;
      issues.push(`Legacy Format (${format}) — Convert to WebP/AVIF`);
    }

    const proposedAlt = generateUniversalProposedAlt(src, alt || "", pageTitle, isDecorative, category);
    const targetFilename = generateUniversalTargetFilename(proposedAlt, src);

    let priority: "High" | "Medium" | "Good" = "Good";
    if (issues.some((i) => i.includes("Missing Alt") || i.includes("Above-Fold"))) {
      priority = "High";
    } else if (issues.length > 0) {
      priority = "Medium";
    }

    if (detailedImages.length < 50) {
      detailedImages.push({
        id: `img-${idx + 1}`,
        src,
        alt: alt ?? "",
        proposedAlt,
        targetFilename,
        isDecorative,
        width,
        height,
        loading,
        format,
        issues,
        priority,
        placementIndex: idx + 1,
      });
    }

    if (imagesList.length < 30) {
      imagesList.push({ src, alt: alt ?? "", loading });
    }
  });

  const estimatedSavingsKb = Math.round(legacyBytesEst * 0.35);

  const vitals: NonNullable<PageAuditData["vitals"]> = {
    clsRiskCount,
    lcpLazyDelayCount,
    oversizedCount: oversizedImages,
    legacyFormatCount,
    estimatedSavingsKb,
  };

  return {
    totalImages: imgEls.length,
    imagesWithoutAlt,
    oversizedImages,
    imagesList,
    detailedImages,
    vitals,
  };
}

function extractEcommerceData(): PageAuditData["ecommerce"] {
  const priceMeta =
    document.querySelector('meta[property="product:price:amount"]')?.getAttribute("content") ||
    document.querySelector('[itemprop="price"]')?.getAttribute("content") ||
    document.querySelector('.price, .product-price, [data-price]')?.textContent?.trim();

  const currencyMeta =
    document.querySelector('meta[property="product:price:currency"]')?.getAttribute("content") ||
    document.querySelector('[itemprop="priceCurrency"]')?.getAttribute("content") ||
    "USD";

  const skuMeta =
    document.querySelector('meta[property="product:retailer_item_id"]')?.getAttribute("content") ||
    document.querySelector('[itemprop="sku"]')?.getAttribute("content") ||
    document.querySelector('.sku, [data-sku]')?.textContent?.trim();

  const prodNameMeta =
    document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    document.querySelector('h1')?.textContent?.trim();

  if (priceMeta || skuMeta) {
    return {
      isEcommerce: true,
      price: priceMeta || undefined,
      currency: currencyMeta || undefined,
      sku: skuMeta || undefined,
      productName: prodNameMeta || undefined,
    };
  }
  return undefined;
}

// Comprehensive Universal 1-Click Page Context Extractor
/**
 * DOM presence of reservation widgets / booking date pickers — the same
 * signals `rules/html-snapshot.ts` checks in raw HTML, evaluated on the
 * live DOM so the page-type classifier can award the `booking` type.
 */
function detectReservationWidgets(): boolean {
  const namedField = document.querySelector(
    'input[name="checkin"], input[name="check-in"], input[name="checkout"], input[name="check-out"], input[name="arrival"], input[name="departure"]'
  );
  if (namedField) return true;
  const widget = document.querySelector(
    '[class*="booking"], [id*="booking"], [class*="reservation"], [id*="reservation"], [class*="book-now"], [id*="book-now"]'
  );
  return Boolean(widget && document.querySelector('input[type="date"]'));
}

function extractComprehensivePageData(): PageAuditData {
  const title = document.title || "";
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  const metaRobots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "index, follow";
  const language = document.documentElement.lang || "en";

  // Accurate Google SERP Pixel Width Estimation (580px Title / 920px Meta Desc)
  const titlePixelWidth = calculatePixelWidth(title);
  const metaDescPixelWidth = calculatePixelWidth(metaDesc);

  // Full H1 - H6 Headings Outline & Hierarchy Analysis
  const headingsData = extractComprehensiveHeadings();

  // JSON-LD Schemas and Real-Time Validation
  const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const schemas: Array<Record<string, unknown>> = [];
  const schemaErrors: string[] = [];

  if (jsonLdScripts.length === 0) {
    schemaErrors.push("Missing JSON-LD: No structured data scripts detected in document head or body.");
  }

  jsonLdScripts.forEach((script, scriptIdx) => {
    try {
      const parsed = JSON.parse(script.textContent || "{}");
      const list: Array<Record<string, unknown>> = [];
      if (Array.isArray(parsed)) {
        list.push(...parsed);
      } else if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
        list.push(...parsed["@graph"]);
      } else {
        list.push(parsed);
      }
      schemas.push(...list);

      // Validate core lodging & FAQ properties
      list.forEach((item) => {
        const typeStr = String(item["@type"] || "");
        if (["Hotel", "LodgingBusiness", "Resort", "Motel"].some((k) => typeStr.includes(k))) {
          if (!item.name) schemaErrors.push(`[${typeStr}] Missing required 'name' property.`);
          if (!item.address) schemaErrors.push(`[${typeStr}] Missing recommended 'address' PostalAddress.`);
          if (!item.telephone) schemaErrors.push(`[${typeStr}] Missing recommended 'telephone' contact.`);
        }
        if (typeStr.includes("FAQPage")) {
          const entities = item.mainEntity;
          if (!entities || !Array.isArray(entities) || entities.length === 0) {
            schemaErrors.push("[FAQPage] Contains zero valid Question items in mainEntity.");
          }
        }
      });
    } catch (err) {
      schemaErrors.push(`Syntax Error in JSON-LD script #${scriptIdx + 1}: Invalid JSON syntax.`);
    }
  });

  // Body Copy, Word Count & Keyword Density
  const bodyText = document.body ? document.body.innerText || "" : "";
  const wordsArray = bodyText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter((w) => w.length > 2);
  const words = wordsArray.length;

  // Property-Specific Facts Extraction (Rooms, Dining, Meetings, Policies)
  const roomTypes: string[] = [];
  const roomRegex = /\b((?:Deluxe|Superior|Executive|Standard|Premium|Junior|Presidential)?\s*(?:King|Queen|Double Queen|Suite|Studio)\s*(?:Room|Suite|Guest Room)?)\b/gi;
  let roomMatch: RegExpExecArray | null;
  while ((roomMatch = roomRegex.exec(bodyText)) !== null) {
    const rName = roomMatch[1].trim();
    if (rName.length > 5 && !roomTypes.includes(rName)) {
      roomTypes.push(rName);
      if (roomTypes.length >= 4) break;
    }
  }

  const meetingSqFtMatch = bodyText.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|square\s+feet)\s+(?:of\s+)?(?:meeting|event)/i);
  const ballroomMatch = bodyText.match(/(?:ballroom|grand\s+ballroom).*?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|square\s+feet)/i);
  const parkingMatch = bodyText.match(/(?:valet|self-?parking|parking\s+fee).*?(\$\d+(?:\s*(?:per|\/)\s*(?:day|night))?)/i);
  const petMatch = bodyText.match(/(pet-?friendly[^\n.]{0,40}|non-refundable\s+pet\s+fee\s+\$\d+)/i);
  const checkInMatch = bodyText.match(/check-?in:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  const checkOutMatch = bodyText.match(/check-?out:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  const airportDistMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*(?:miles?|mi)\s+(?:from|to)\s+([A-Za-z\s]+(?:Airport|SFO|LAX|JFK|ORD|MIA))/i);
  const landmarkDistMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*(?:miles?|mi|blocks?)\s+(?:from|to)\s+([A-Za-z\s]+(?:Convention|Center|Stadium|Square|Park))/i);

  const extractedFacts = {
    roomTypes: roomTypes.length > 0 ? roomTypes : undefined,
    diningOutlets: ["On-Site Restaurant", "Lobby Bar"],
    meetingSqFt: meetingSqFtMatch ? `${meetingSqFtMatch[1]} sq ft` : undefined,
    ballroomSqFt: ballroomMatch ? `${ballroomMatch[1]} sq ft` : undefined,
    parkingFee: parkingMatch ? parkingMatch[1] : undefined,
    petPolicy: petMatch ? petMatch[1] : undefined,
    checkInTime: checkInMatch ? checkInMatch[1] : undefined,
    checkOutTime: checkOutMatch ? checkOutMatch[1] : undefined,
    airportDistance: airportDistMatch ? `${airportDistMatch[1]} miles` : undefined,
    airportCode: airportDistMatch ? (airportDistMatch[2].match(/[A-Z]{3}/)?.[0] || "AIR") : undefined,
    landmarkDistance: landmarkDistMatch ? `${landmarkDistMatch[1]} miles` : undefined,
  };

  // Universal CMS & Category Detection
  const cmsResult = detectUniversalCms();
  const categoryResult = detectUniversalSiteCategory(bodyText, schemas, title, window.location.href);

  // Comprehensive Image Audit (WCAG 2.2 AA, CLS, LCP, Next-Gen WebP/AVIF)
  const imagesData = extractComprehensiveImages(categoryResult.category || "general", title);

  // E-commerce data
  const ecommerceData = extractEcommerceData();

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
    { platform: "LinkedIn", regex: /linkedin\.com/i },
    { platform: "X / Twitter", regex: /twitter\.com|x\.com/i },
    { platform: "YouTube", regex: /youtube\.com/i },
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

  // Page-type classification for the sidepanel confidence pill
  // (docs/TASKS.md Task 3.2): shared rule-based classifier, no model.
  const pageTypeResult = classifyPageTypeForAudit(
    {
      url: window.location.href,
      hostname: window.location.hostname,
      title,
      metaDesc,
      metaRobots,
      language,
      canonical,
      words,
      schemas,
      hasViewport: !!document.querySelector('meta[name="viewport"]'),
    },
    {
      textContent: bodyText,
      scriptSrcs: Array.from(document.querySelectorAll("script[src]")).map(
        (s) => (s as HTMLScriptElement).src
      ),
      reservationWidgets: detectReservationWidgets(),
    }
  );

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
    siteCategory: categoryResult.category,
    siteCategoryLabel: categoryResult.label,
    detectedCms: cmsResult.cms,
    detectedCmsLabel: cmsResult.label,
    h1Elements: headingsData.h1Elements,
    h2Elements: headingsData.h2Elements.slice(0, 20),
    h3Elements: headingsData.h3Elements.slice(0, 20),
    allHeadings: headingsData.allHeadings.slice(0, 30),
    headingHierarchy: headingsData.headingHierarchy,
    headingIssues: headingsData.headingIssues,
    totalImages: imagesData.totalImages,
    imagesWithoutAlt: imagesData.imagesWithoutAlt,
    oversizedImages: imagesData.oversizedImages,
    imagesList: imagesData.imagesList,
    detailedImages: imagesData.detailedImages,
    vitals: imagesData.vitals,
    ecommerce: ecommerceData,
    words,
    extractedAmenities,
    topKeywords,
    schemas,
    schemaErrors,
    extractedFacts,
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
    pageType: pageTypeResult.pageType,
    pageTypeConfidence: pageTypeResult.confidence,
    pageTypeSignals: pageTypeResult.signals,
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
    let script = document.getElementById("__seo_studio_preview_schema__");
    if (!script) {
      script = document.createElement("script");
      script.id = "__seo_studio_preview_schema__";
      script.setAttribute("type", "application/ld+json");
      document.head.appendChild(script);
    }
    script.textContent = payload.schemaJson;
    injected.push("JSON-LD Schema");
  }

  return { injected };
}

// Undo Stack for Safe CMS Field Modification
interface CmsUndoEntry {
  element: HTMLInputElement | HTMLTextAreaElement;
  prevValue: string;
  fieldName: string;
}
let lastCmsFillHistory: CmsUndoEntry[] = [];
let injectedSchemaElement: HTMLScriptElement | null = null;
let originalInjectedSchemaText: string | null = null;

// Auto-Detect & Auto-Fill Common CMS / SEO Plugin Fields
function handleAutoFillCms(payload: {
  title?: string;
  metaDesc?: string;
  slug?: string;
  headings?: Array<{ old_level?: string; new_level?: string; new_headline?: string }>;
  images?: Array<{ image_url?: string; optimized_alt?: string }>;
}): CmsAutoFillResult {
  const filledFields: string[] = [];
  let detectedCms: CmsAutoFillResult["detectedCms"] = "Generic/DOM";
  lastCmsFillHistory = [];

  // Helper to trigger events on inputs and record undo entry
  const triggerInput = (el: HTMLInputElement | HTMLTextAreaElement, val: string, fieldName: string) => {
    lastCmsFillHistory.push({
      element: el,
      prevValue: el.value,
      fieldName,
    });
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
      triggerInput(yoastTitle, payload.title, "Yoast SEO Title");
      filledFields.push("Yoast SEO Title");
    }
    if (yoastDesc && payload.metaDesc) {
      triggerInput(yoastDesc, payload.metaDesc, "Yoast Meta Description");
      filledFields.push("Yoast Meta Description");
    }
  }

  // 2. WordPress Rank Math
  const rmTitle = document.querySelector<HTMLInputElement>("#rank_math_title");
  const rmDesc = document.querySelector<HTMLTextAreaElement>("#rank_math_description");
  if (rmTitle || rmDesc) {
    detectedCms = "WordPress/RankMath";
    if (rmTitle && payload.title) {
      triggerInput(rmTitle, payload.title, "Rank Math Title");
      filledFields.push("Rank Math Title");
    }
    if (rmDesc && payload.metaDesc) {
      triggerInput(rmDesc, payload.metaDesc, "Rank Math Description");
      filledFields.push("Rank Math Description");
    }
  }

  // 3. WordPress Gutenberg / Classic Title
  const wpTitle = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(".editor-post-title__input, #title");
  if (wpTitle && payload.title) {
    detectedCms = "WordPress/Classic";
    triggerInput(wpTitle, payload.title, "Post/Page Title");
    filledFields.push("Post/Page Title");
  }

  // 4. Webflow CMS Editor
  const wfTitle = document.querySelector<HTMLInputElement>('[data-automation-id="page-title-input"], input[name="title"]');
  const wfDesc = document.querySelector<HTMLTextAreaElement>('[data-automation-id="page-description-input"], textarea[name="description"]');
  if (wfTitle || wfDesc) {
    detectedCms = "Webflow";
    if (wfTitle && payload.title) {
      triggerInput(wfTitle, payload.title, "Webflow SEO Title");
      filledFields.push("Webflow SEO Title");
    }
    if (wfDesc && payload.metaDesc) {
      triggerInput(wfDesc, payload.metaDesc, "Webflow Meta Description");
      filledFields.push("Webflow Meta Description");
    }
  }

  // 5. Shopify Admin
  const shTitle = document.querySelector<HTMLInputElement>("#seo-title, #page-title");
  const shDesc = document.querySelector<HTMLTextAreaElement>("#seo-description, #page-description");
  if (shTitle || shDesc) {
    detectedCms = "Shopify";
    if (shTitle && payload.title) {
      triggerInput(shTitle, payload.title, "Shopify SEO Title");
      filledFields.push("Shopify SEO Title");
    }
    if (shDesc && payload.metaDesc) {
      triggerInput(shDesc, payload.metaDesc, "Shopify Meta Description");
      filledFields.push("Shopify Meta Description");
    }
  }

  // 6. Generic Fallback (Inject into active DOM if CMS inputs not present)
  if (payload.title && !filledFields.some((f) => f.includes("Title"))) {
    document.title = payload.title;
    filledFields.push("DOM Document Title");
  }
  if (payload.metaDesc && !filledFields.some((f) => f.includes("Description"))) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", payload.metaDesc);
    filledFields.push("DOM Meta Description");
  }

  // 7. Auto-Fill Live Image ALT Attributes
  if (payload.images && payload.images.length > 0) {
    let imgCount = 0;
    const domImgs = Array.from(document.querySelectorAll("img"));
    payload.images.forEach((imgObj) => {
      if (!imgObj.optimized_alt) return;
      const targetSrc = imgObj.image_url ? imgObj.image_url.split("?")[0].toLowerCase() : "";
      const targetFilename = targetSrc.split("/").pop() || "";
      const matchedImg = domImgs.find((el) => {
        const elSrc = (el.src || el.getAttribute("data-src") || "").split("?")[0].toLowerCase();
        return elSrc === targetSrc || (targetFilename.length > 4 && elSrc.endsWith(targetFilename));
      });
      if (matchedImg) {
        matchedImg.setAttribute("alt", imgObj.optimized_alt);
        imgCount++;
      }
    });
    if (imgCount > 0) {
      filledFields.push(`Updated ${imgCount} Image ALTs`);
    }
  }

  // 8. Auto-Fill Live H1 Heading
  if (payload.headings && payload.headings.length > 0) {
    const h1Target = payload.headings.find((h) => h.new_level === "H1");
    if (h1Target && h1Target.new_headline) {
      const h1El = document.querySelector("h1");
      if (h1El) {
        h1El.textContent = h1Target.new_headline;
        filledFields.push("H1 Element");
      }
    }
  }

  return { detectedCms, filledFields, success: filledFields.length > 0, undoAvailable: lastCmsFillHistory.length > 0 };
}

// Fill currently active or focused input/textarea, or inject JSON-LD schema
function handleFillActiveCmsField(payload: {
  text?: string;
  fieldType?: "title" | "meta" | "schema" | "active";
}): CmsAutoFillResult {
  const filledFields: string[] = [];
  const text = payload.text || "";

  // 1. If schema script injection requested
  if (payload.fieldType === "schema") {
    let scriptTag = document.getElementById("__seo_studio_injected_schema__") as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.id = "__seo_studio_injected_schema__";
      scriptTag.type = "application/ld+json";
      document.head.appendChild(scriptTag);
      injectedSchemaElement = scriptTag;
      originalInjectedSchemaText = null;
    } else {
      originalInjectedSchemaText = scriptTag.textContent;
    }
    scriptTag.textContent = text;
    filledFields.push("Injected <script type='application/ld+json'>");
    return {
      detectedCms: "Generic/DOM",
      filledFields,
      success: true,
      undoAvailable: true,
      message: "Successfully injected JSON-LD schema into page head.",
    };
  }

  // 2. Active focused input/textarea element
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
    const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
    lastCmsFillHistory.push({
      element: inputEl,
      prevValue: inputEl.value,
      fieldName: inputEl.name || inputEl.id || "Active Focused Field",
    });
    inputEl.value = text;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    inputEl.dispatchEvent(new Event("blur", { bubbles: true }));
    filledFields.push(`Focused ${inputEl.tagName} (${inputEl.name || inputEl.id || "Active"})`);
    return {
      detectedCms: "Generic/DOM",
      filledFields,
      success: true,
      undoAvailable: true,
      message: `Injected into focused field.`,
    };
  }

  // 3. Auto-detect best input if none explicitly focused
  if (payload.fieldType === "title") {
    return handleAutoFillCms({ title: text });
  } else if (payload.fieldType === "meta") {
    return handleAutoFillCms({ metaDesc: text });
  }

  return {
    detectedCms: "Generic/DOM",
    filledFields: [],
    success: false,
    message: "No active input or textarea currently focused in the page.",
  };
}

// Revert last CMS auto-fill operation
function handleUndoCmsFill(): { success: boolean; revertedCount: number; message: string } {
  let count = 0;

  // Revert DOM inputs
  if (lastCmsFillHistory.length > 0) {
    for (const item of lastCmsFillHistory) {
      if (item.element && document.contains(item.element)) {
        item.element.value = item.prevValue;
        item.element.dispatchEvent(new Event("input", { bubbles: true }));
        item.element.dispatchEvent(new Event("change", { bubbles: true }));
        item.element.dispatchEvent(new Event("blur", { bubbles: true }));
        count++;
      }
    }
    lastCmsFillHistory = [];
  }

  // Revert injected schema
  if (injectedSchemaElement && document.contains(injectedSchemaElement)) {
    if (originalInjectedSchemaText === null) {
      injectedSchemaElement.remove();
    } else {
      injectedSchemaElement.textContent = originalInjectedSchemaText;
    }
    injectedSchemaElement = null;
    originalInjectedSchemaText = null;
    count++;
  }

  return {
    success: count > 0,
    revertedCount: count,
    message: count > 0 ? `Successfully reverted ${count} field(s).` : "No recent fill actions to undo.",
  };
}

// Visual DOM Overlay Handlers
export type OverlayType = "headings" | "missingAlts" | "schemas" | "bookingLinks" | "geoBlocks";

function handleToggleOverlay(type: OverlayType | "links", enabled: boolean) {
  const normalizedType = type === "links" ? "bookingLinks" : type;
  const overlayId = `__seo-studio_${normalizedType}_overlay__`;
  const existing = document.getElementById(overlayId);

  if (!enabled) {
    if (existing) existing.remove();

    if (normalizedType === "headings") {
      document.querySelectorAll(".seo-studio-heading-badge").forEach((el) => el.remove());
      document.querySelectorAll("[data-seo-studio-headings]").forEach((el) => {
        (el as HTMLElement).style.outline = "";
        (el as HTMLElement).removeAttribute("data-seo-studio-headings");
      });
    } else if (normalizedType === "missingAlts") {
      document.querySelectorAll(".seo-studio-alt-badge").forEach((el) => el.remove());
      document.querySelectorAll("[data-seo-studio-missingAlts]").forEach((el) => {
        (el as HTMLElement).style.outline = "";
        (el as HTMLElement).style.outlineOffset = "";
        (el as HTMLElement).removeAttribute("data-seo-studio-missingAlts");
      });
    } else if (normalizedType === "schemas") {
      const banner = document.getElementById("seo-studio_schema_banner");
      if (banner) banner.remove();
      document.querySelectorAll("[data-seo-studio-schemas]").forEach((el) => {
        (el as HTMLElement).style.outline = "";
        (el as HTMLElement).removeAttribute("data-seo-studio-schemas");
      });
    } else if (normalizedType === "bookingLinks") {
      document.querySelectorAll(".seo-studio-booking-badge").forEach((el) => el.remove());
      document.querySelectorAll("[data-seo-studio-bookingLinks]").forEach((el) => {
        (el as HTMLElement).style.outline = "";
        (el as HTMLElement).removeAttribute("data-seo-studio-bookingLinks");
      });
    } else if (normalizedType === "geoBlocks") {
      document.querySelectorAll(".seo-studio-geo-badge").forEach((el) => el.remove());
      document.querySelectorAll("[data-seo-studio-geoBlocks]").forEach((el) => {
        (el as HTMLElement).style.outline = "";
        (el as HTMLElement).style.outlineOffset = "";
        (el as HTMLElement).removeAttribute("data-seo-studio-geoBlocks");
      });
    }
    return;
  }

  let styleEl = document.getElementById(overlayId) as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = overlayId;
    document.head.appendChild(styleEl);
  }

  if (normalizedType === "headings") {
    styleEl.textContent = `
      .seo-studio-heading-badge {
        position: absolute;
        top: -10px;
        left: 0;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        pointer-events: none;
      }
      .seo-studio-badge-h1 { background: #10b981; }
      .seo-studio-badge-h1-dup { background: #ef4444; }
      .seo-studio-badge-h2 { background: #0284c7; }
      .seo-studio-badge-h3 { background: #8b5cf6; }
    `;

    const h1s = Array.from(document.querySelectorAll("h1"));
    h1s.forEach((h1, i) => {
      h1.setAttribute("data-seo-studio-headings", "true");
      (h1 as HTMLElement).style.position = "relative";
      (h1 as HTMLElement).style.outline = i === 0 ? "2.5px dashed #10b981" : "3px solid #ef4444";
      const badge = document.createElement("span");
      badge.className = `seo-studio-heading-badge ${i === 0 ? "seo-studio-badge-h1" : "seo-studio-badge-h1-dup"}`;
      badge.textContent = i === 0 ? "H1 (Primary)" : `H1 Duplicate #${i + 1}`;
      h1.appendChild(badge);
    });

    document.querySelectorAll("h2").forEach((h2, i) => {
      h2.setAttribute("data-seo-studio-headings", "true");
      (h2 as HTMLElement).style.position = "relative";
      (h2 as HTMLElement).style.outline = "2px dotted #0284c7";
      const badge = document.createElement("span");
      badge.className = "seo-studio-heading-badge seo-studio-badge-h2";
      badge.textContent = `H2 #${i + 1}`;
      h2.appendChild(badge);
    });

    document.querySelectorAll("h3").forEach((h3, i) => {
      h3.setAttribute("data-seo-studio-headings", "true");
      (h3 as HTMLElement).style.position = "relative";
      (h3 as HTMLElement).style.outline = "2px dotted #8b5cf6";
      const badge = document.createElement("span");
      badge.className = "seo-studio-heading-badge seo-studio-badge-h3";
      badge.textContent = `H3 #${i + 1}`;
      h3.appendChild(badge);
    });
  } else if (normalizedType === "missingAlts") {
    styleEl.textContent = `
      .seo-studio-alt-badge {
        position: absolute;
        top: 4px;
        left: 4px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 10px;
        font-weight: 800;
        padding: 3px 6px;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        pointer-events: none;
      }
      .seo-studio-badge-missing { background: #ef4444; color: #fff; }
      .seo-studio-badge-decorative { background: #10b981; color: #fff; }
      .seo-studio-badge-empty { background: #f59e0b; color: #000; }
    `;

    document.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt");
      const role = img.getAttribute("role");
      const ariaHidden = img.getAttribute("aria-hidden");
      const isExplicitlyDecorative = alt === "" && (role === "presentation" || role === "none" || ariaHidden === "true");

      if (alt === null) {
        // Genuine defect: missing alt attribute
        img.setAttribute("data-seo-studio-missingAlts", "true");
        (img as HTMLElement).style.outline = "3px solid #ef4444";
        (img as HTMLElement).style.outlineOffset = "2px";

        if (img.parentElement && getComputedStyle(img.parentElement).position === "static") {
          img.parentElement.style.position = "relative";
        }
        const badge = document.createElement("span");
        badge.className = "seo-studio-alt-badge seo-studio-badge-missing";
        badge.textContent = "MISSING ALT ATTRIBUTE";
        if (img.parentElement) {
          img.parentElement.appendChild(badge);
        }
      } else if (isExplicitlyDecorative) {
        // Valid per WCAG 2.2 AA
        img.setAttribute("data-seo-studio-missingAlts", "true");
        (img as HTMLElement).style.outline = "1.5px dashed #10b981";
        (img as HTMLElement).style.outlineOffset = "1px";

        if (img.parentElement && getComputedStyle(img.parentElement).position === "static") {
          img.parentElement.style.position = "relative";
        }
        const badge = document.createElement("span");
        badge.className = "seo-studio-alt-badge seo-studio-badge-decorative";
        badge.textContent = 'WCAG VALID (alt="")';
        if (img.parentElement) {
          img.parentElement.appendChild(badge);
        }
      } else if (alt.trim() === "") {
        // Suspicious empty alt
        img.setAttribute("data-seo-studio-missingAlts", "true");
        (img as HTMLElement).style.outline = "2px dashed #f59e0b";
        (img as HTMLElement).style.outlineOffset = "1px";

        if (img.parentElement && getComputedStyle(img.parentElement).position === "static") {
          img.parentElement.style.position = "relative";
        }
        const badge = document.createElement("span");
        badge.className = "seo-studio-alt-badge seo-studio-badge-empty";
        badge.textContent = "EMPTY ALT (DECORATIVE?)";
        if (img.parentElement) {
          img.parentElement.appendChild(badge);
        }
      }
    });
  } else if (normalizedType === "schemas") {
    // Injects non-destructive top floating banner displaying validated JSON-LD entities
    const existingBanner = document.getElementById("seo-studio_schema_banner");
    if (existingBanner) existingBanner.remove();

    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const detectedTypes: string[] = [];

    scripts.forEach((s) => {
      try {
        const json = JSON.parse(s.textContent || "{}");
        if (json["@type"]) detectedTypes.push(json["@type"]);
        if (Array.isArray(json["@graph"])) {
          json["@graph"].forEach((item: any) => {
            if (item["@type"]) detectedTypes.push(item["@type"]);
          });
        }
      } catch {
        // Ignored
      }
    });

    const banner = document.createElement("div");
    banner.id = "seo-studio_schema_banner";
    banner.setAttribute("style", `
      position: fixed;
      top: 14px;
      right: 14px;
      z-index: 99999999;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      max-width: 320px;
      font-size: 11px;
    `);

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #34d399;">
          VALIDATED JSON-LD SCHEMA
        </span>
        <span style="font-size: 9px; font-weight: 700; color: #94a3b8;">
          ${scripts.length} script block${scripts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
        ${
          detectedTypes.length > 0
            ? detectedTypes
                .map(
                  (t) =>
                    `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-family: monospace; font-size: 10px;">@type: ${t}</span>`
                )
                .join("")
            : `<span style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; padding: 2px 6px; border-radius: 4px; font-weight: 700;">No JSON-LD Schema Found</span>`
        }
      </div>
    `;

    document.body.appendChild(banner);
  } else if (normalizedType === "bookingLinks") {
    styleEl.textContent = `
      .seo-studio-booking-badge {
        position: absolute;
        top: -8px;
        right: 0;
        z-index: 999999;
        background: #10b981;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 9px;
        font-weight: 800;
        padding: 1px 5px;
        border-radius: 3px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        pointer-events: none;
      }
    `;

    const currentHost = window.location.hostname;
    const bookingPattern = /book|reserv|stay|room|rate|checkout|check-avail|cart/i;

    document.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("data-seo-studio-bookingLinks", "true");
      const href = a.getAttribute("href") || "";
      const text = a.textContent || "";
      const isBooking = bookingPattern.test(href) || bookingPattern.test(text);

      try {
        const url = new URL(href, window.location.origin);
        const isInternal = url.hostname === currentHost || !url.hostname;

        if (isBooking && isInternal) {
          (a as HTMLElement).style.position = "relative";
          (a as HTMLElement).style.outline = "2.5px solid #10b981";
          const badge = document.createElement("span");
          badge.className = "seo-studio-booking-badge";
          badge.textContent = "DIRECT BOOKING CTA";
          a.appendChild(badge);
        } else if (isInternal) {
          (a as HTMLElement).style.outline = "1.5px solid #0284c7";
        } else {
          (a as HTMLElement).style.outline = "1.5px dashed #f59e0b";
        }
      } catch {
        (a as HTMLElement).style.outline = "1.5px solid #0284c7";
      }
    });
  } else if (normalizedType === "geoBlocks") {
    styleEl.textContent = `
      .seo-studio-geo-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        z-index: 999999;
        background: #8b5cf6;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 10px;
        font-weight: 800;
        padding: 3px 7px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
        pointer-events: none;
      }
    `;

    const geoSelector = `
      details,
      [data-faq],
      .faq,
      #faq,
      [id*="faq"],
      [class*="faq"],
      .amenities,
      #amenities,
      [id*="amenit"],
      .location,
      #location,
      [id*="location"],
      section[aria-label*="FAQ" i],
      section[aria-label*="Amenities" i],
      section[aria-label*="Location" i]
    `;

    const geoNodes = Array.from(document.querySelectorAll(geoSelector));

    // Also check headings with FAQ or Amenities keywords
    document.querySelectorAll("h2, h3, h4").forEach((h) => {
      const headingText = (h.textContent || "").toLowerCase();
      if (
        headingText.includes("faq") ||
        headingText.includes("frequently asked") ||
        headingText.includes("amenities") ||
        headingText.includes("getting here") ||
        headingText.includes("location") ||
        headingText.includes("policies") ||
        headingText.includes("check-in")
      ) {
        if (h.parentElement && !geoNodes.includes(h.parentElement)) {
          geoNodes.push(h.parentElement);
        }
      }
    });

    geoNodes.forEach((node) => {
      node.setAttribute("data-seo-studio-geoBlocks", "true");
      (node as HTMLElement).style.position = "relative";
      (node as HTMLElement).style.outline = "2.5px dashed #8b5cf6";
      (node as HTMLElement).style.outlineOffset = "3px";

      const badge = document.createElement("span");
      badge.className = "seo-studio-geo-badge";
      badge.textContent = "GEO AI KNOWLEDGE TARGET";
      node.appendChild(badge);
    });
  }
}

function handleClearAllOverlays() {
  const types: OverlayType[] = ["headings", "missingAlts", "schemas", "bookingLinks", "geoBlocks"];
  types.forEach((t) => handleToggleOverlay(t, false));
}

// ============================================================================
// SPA ROUTE CHANGE DETECTION & MUTATION OBSERVER
// ============================================================================

function computeQuickContentFingerprint(): string {
  const url = window.location.href;
  const title = document.title || "";
  const h1 = document.querySelector("h1")?.textContent?.trim() || "";
  const mainEl = document.querySelector("main, article, [role='main']") || document.body;
  const sampleLength = mainEl ? mainEl.textContent?.length || 0 : 0;
  return `${url}:::${title}:::${h1}:::${sampleLength}`;
}

let lastFingerprint = computeQuickContentFingerprint();
let spaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function checkAndDispatchSpaChange(): void {
  if (spaDebounceTimer) {
    clearTimeout(spaDebounceTimer);
  }
  spaDebounceTimer = setTimeout(() => {
    const currentFingerprint = computeQuickContentFingerprint();
    if (currentFingerprint !== lastFingerprint) {
      lastFingerprint = currentFingerprint;
      try {
        const data = extractComprehensivePageData();
        chrome.runtime.sendMessage(
          {
            type: "AUTO_PAGE_CONTEXT_UPDATED",
            data,
          },
          () => {
            if (chrome.runtime.lastError) {
              // Ignore disconnected runtime
            }
          }
        );
      } catch {
        // Handled silently
      }
    }
  }, 800);
}

// 1. Patch history API (idempotent across duplicate injections)
if (isTopLevelWindow() && !(window as any).__SEO_STUDIO_SPA_HOOKS__) {
  (window as any).__SEO_STUDIO_SPA_HOOKS__ = true;
  (function patchHistoryApi() {
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function (...args) {
      const res = originalPush.apply(this, args);
      window.dispatchEvent(new Event("seo-studio-spa-navigate"));
      return res;
    };

    history.replaceState = function (...args) {
      const res = originalReplace.apply(this, args);
      window.dispatchEvent(new Event("seo-studio-spa-navigate"));
      return res;
    };

    window.addEventListener("seo-studio-spa-navigate", checkAndDispatchSpaChange);
    window.addEventListener("popstate", checkAndDispatchSpaChange);
    window.addEventListener("hashchange", checkAndDispatchSpaChange);
  })();

  // 2. MutationObserver on document.title & main/article/body
  (function observeDomMutations() {
    const target = document.body || document.documentElement;
    if (!target) return;

    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const m of mutations) {
        if (m.type === "childList" && m.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
        if (m.type === "characterData") {
          shouldCheck = true;
          break;
        }
      }
      if (shouldCheck) {
        checkAndDispatchSpaChange();
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const titleEl = document.querySelector("title");
    if (titleEl) {
      const titleObserver = new MutationObserver(() => checkAndDispatchSpaChange());
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  })();
}

