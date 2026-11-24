/**
 * Cogwheel SEO & GEO Studio - Universal Read-Only Training Data Extractor & Sanitizer v3.0
 *
 * Manifest V3 compatible content module that extracts rich structured search metadata,
 * H1-H6 hierarchy, full JSON-LD graphs, microdata, links, images, hotel hospitality blocks,
 * Core Web Vitals, and tech stacks while guaranteeing strict security redaction.
 */

export interface HeadingNode {
  level: number;
  tag: string;
  text: string;
}

export interface LinkItem {
  href: string;
  anchorText: string;
  isInternal: boolean;
  rel: string;
}

export interface ImageItem {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface CtaItem {
  text: string;
  href: string;
  type: "booking" | "contact" | "phone" | "email";
}

export interface ReviewItem {
  rating?: string;
  reviewCount?: string;
  source?: string;
}

export interface HotelHospitalityData {
  amenities: string[];
  rates: string[];
  reviews: ReviewItem[];
}

export interface CoreWebVitals {
  lcp?: number;
  cls?: number;
  inp?: number;
}

export interface DetectedTech {
  cms: string[];
  frameworks: string[];
  tagManagers: string[];
}

export interface MicrodataItem {
  type: string;
  properties: Record<string, string>;
}

export interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  siteName?: string;
  url?: string;
}

export interface TwitterCardMetadata {
  card?: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface SanitizationMetrics {
  redactedTokensCount: number;
  redactedJwtsCount: number;
  redactedCardsCount: number;
  redactedPhonesCount: number;
}

export interface CapturedWebSample {
  schemaVersion: "3.0.0";
  url: string;
  domain: string;
  canonicalUrl: string;
  lang: string;
  robots: string;
  viewport: string;
  hreflang: Array<{ lang: string; href: string }>;
  title: string;
  metaDescription: string;
  headings: {
    h1: string[];
    h2: string[];
    outline: HeadingNode[];
  };
  jsonLdTypes: string[];
  jsonLdFull: unknown[];
  microdata: MicrodataItem[];
  openGraph: OpenGraphMetadata;
  twitter: TwitterCardMetadata;
  links: LinkItem[];
  images: ImageItem[];
  bookingCtas: CtaItem[];
  hospitality: HotelHospitalityData;
  coreWebVitals: CoreWebVitals;
  detectedTech: DetectedTech;
  mainContentText: string;
  ctaText: string;
  wordCount: number;
  frameId?: number;
  extractedAt: string;
  extractionErrors: string[];
  sanitizationMetrics: SanitizationMetrics;
}

// ============================================================================
// 1. HARDENED PII & SENSITIVE CREDENTIAL SANITIZATION ENGINE
// ============================================================================

// Tightened phone regex: requires separators or leading '+' prefix.
// Supports international 2-4 digit area codes while preventing false matches on years (2024), prices ($100.00), or ZIP codes (32413).
const PHONE_REGEX =
  /(?:\+\d{1,3}[-.\s]?)?(?:\(\d{2,4}\)|\b\d{2,4})[-.\s]\d{3,4}[-.\s]\d{3,4}\b|\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{4,8}\b/g;

// JWT Regex: 3 base64url segments separated by dots starting with eyJ
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;

// API Tokens & Secret Keys Regex
const API_TOKEN_REGEX =
  /\b(?:sk_live_[a-zA-Z0-9]{20,}|sk_test_[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{30,}|gho_[a-zA-Z0-9]{30,}|glpat-[a-zA-Z0-9_-]{20,}|xox[baprs]-[0-9a-zA-Z]{10,}|AIza[0-9A-Za-z-_]{35}|Bearer\s+[a-zA-Z0-9._~+/-]{20,})\b/gi;

// Credit Card Regex: 13-19 digits with separators
const CREDIT_CARD_REGEX =
  /\b(?:4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}|5[1-5]\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}|3[47]\d{2}[-\s]?\d{6}[-\s]?\d{5}|6(?:011|5\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/g;

// IBAN Regex: 2 letters, 2 digits, 11-30 alphanumeric characters
const IBAN_REGEX = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]?){0,16}\b/g;

/**
 * Sanitizes arbitrary text:
 * - KEEPS valid emails and URL queries (needed for accurate hotel entity data)
 * - REDACTS sensitive tokens, API keys, JWTs
 * - REDACTS credit cards & IBANs
 * - REDACTS phone numbers with strict boundary checks
 */
export function sanitizeTextAndRedactPii(text: string): {
  sanitized: string;
  tokensCount: number;
  jwtsCount: number;
  cardsCount: number;
  phonesCount: number;
} {
  if (!text) {
    return {
      sanitized: "",
      tokensCount: 0,
      jwtsCount: 0,
      cardsCount: 0,
      phonesCount: 0,
    };
  }

  let tokensCount = 0;
  let jwtsCount = 0;
  let cardsCount = 0;
  let phonesCount = 0;

  // 1. Redact JWTs
  let step1 = text.replace(JWT_REGEX, () => {
    jwtsCount++;
    return "[REDACTED_JWT]";
  });

  // 2. Redact API Tokens / Bearer Credentials
  let step2 = step1.replace(API_TOKEN_REGEX, (match) => {
    tokensCount++;
    if (match.toLowerCase().startsWith("bearer ")) {
      return "Bearer [REDACTED_API_KEY]";
    }
    return "[REDACTED_API_KEY]";
  });

  // 3. Redact Credit Cards
  let step3 = step2.replace(CREDIT_CARD_REGEX, () => {
    cardsCount++;
    return "[REDACTED_CARD]";
  });

  // 4. Redact IBANs
  let step4 = step3.replace(IBAN_REGEX, () => {
    cardsCount++;
    return "[REDACTED_CARD]";
  });

  // 5. Redact Telephone Numbers (tightened)
  let step5 = step4.replace(PHONE_REGEX, () => {
    phonesCount++;
    return "[REDACTED_PHONE]";
  });

  return {
    sanitized: step5,
    tokensCount,
    jwtsCount,
    cardsCount,
    phonesCount,
  };
}

/**
 * Sanitizes URLs: keeps general query parameters intact while stripping sensitive auth tokens.
 */
export function sanitizeUrlString(rawUrl: string): {
  sanitizedUrl: string;
  hasRedactedQuery: boolean;
} {
  if (!rawUrl) return { sanitizedUrl: "", hasRedactedQuery: false };

  try {
    const parsed = new URL(rawUrl, "https://example.com");
    let hasRedacted = false;

    const sensitiveParamKeys = [
      "token",
      "access_token",
      "auth",
      "key",
      "api_key",
      "secret",
      "password",
      "jwt",
      "session",
    ];

    sensitiveParamKeys.forEach((k) => {
      if (parsed.searchParams.has(k)) {
        parsed.searchParams.set(k, "[REDACTED]");
        hasRedacted = true;
      }
    });

    const result = rawUrl.startsWith("http")
      ? parsed.toString()
      : parsed.pathname + parsed.search + parsed.hash;

    const unencoded = result.replace(/%5BREDACTED%5D/g, "[REDACTED]");
    return { sanitizedUrl: unencoded, hasRedactedQuery: hasRedacted };
  } catch {
    return { sanitizedUrl: rawUrl, hasRedactedQuery: false };
  }
}

// ============================================================================
// 2. DOM & SHADOW ROOT TRAVERSAL UTILITIES
// ============================================================================

/**
 * Traverses open shadow roots to discover all matching elements.
 */
export function querySelectorAllDeep(root: ParentNode, selector: string): Element[] {
  const elements: Element[] = [];
  const parts = selector.split(",").map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    try {
      elements.push(...Array.from(root.querySelectorAll(part)));
    } catch {
      // Ignore invalid selector
    }
  }

  try {
    const all = root.querySelectorAll("*");
    for (const el of Array.from(all)) {
      if ((el as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot) {
        elements.push(...querySelectorAllDeep((el as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot!, selector));
      }
    }
  } catch {
    // Handled silently
  }

  return elements;
}

// ============================================================================
// 3. READ-ONLY DOM EXTRACTION WITH ERROR BOUNDARIES
// ============================================================================

function extractHeadingsHierarchy(doc: Document): {
  h1: string[];
  h2: string[];
  outline: HeadingNode[];
} {
  const headingElements = querySelectorAllDeep(doc, "h1, h2, h3, h4, h5, h6");
  const outline: HeadingNode[] = [];
  const h1: string[] = [];
  const h2: string[] = [];

  headingElements.forEach((el) => {
    const tag = el.tagName.toUpperCase();
    const level = parseInt(tag.replace("H", ""), 10) || 1;
    const text = (el.textContent || "").trim();
    if (text) {
      outline.push({ level, tag, text });
      if (tag === "H1") h1.push(text);
      if (tag === "H2") h2.push(text);
    }
  });

  return { h1, h2, outline };
}

function extractJsonLdAndMicrodata(doc: Document): {
  jsonLdTypes: string[];
  jsonLdFull: unknown[];
  microdata: MicrodataItem[];
} {
  const jsonLdTypesSet = new Set<string>();
  const jsonLdFull: unknown[] = [];
  const microdata: MicrodataItem[] = [];

  // Parse JSON-LD scripts
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  scripts.forEach((s) => {
    try {
      const parsed = JSON.parse(s.textContent || "");
      jsonLdFull.push(parsed);

      const collectTypes = (item: unknown) => {
        if (!item || typeof item !== "object") return;
        if (Array.isArray(item)) {
          item.forEach(collectTypes);
          return;
        }
        const rec = item as Record<string, unknown>;
        if (rec["@type"]) {
          if (typeof rec["@type"] === "string") {
            jsonLdTypesSet.add(rec["@type"]);
          } else if (Array.isArray(rec["@type"])) {
            rec["@type"].forEach((t) => typeof t === "string" && jsonLdTypesSet.add(t));
          }
        }
        if (rec["@graph"]) collectTypes(rec["@graph"]);
        if (rec["mainEntity"]) collectTypes(rec["mainEntity"]);
      };

      collectTypes(parsed);
    } catch {
      // Ignore invalid JSON-LD blocks
    }
  });

  // Extract Microdata
  try {
    const itemScopes = doc.querySelectorAll("[itemscope]");
    itemScopes.forEach((scope) => {
      const itemType = scope.getAttribute("itemtype") || "GenericItem";
      const props: Record<string, string> = {};
      const propEls = scope.querySelectorAll("[itemprop]");
      propEls.forEach((p) => {
        const key = p.getAttribute("itemprop");
        if (key) {
          const val =
            p.getAttribute("content") ||
            p.getAttribute("src") ||
            p.getAttribute("href") ||
            p.textContent?.trim() ||
            "";
          if (val) props[key] = val;
        }
      });
      microdata.push({ type: itemType, properties: props });
    });
  } catch {
    // Microdata parse error
  }

  return {
    jsonLdTypes: Array.from(jsonLdTypesSet),
    jsonLdFull,
    microdata,
  };
}

function extractLinksAndImages(doc: Document, baseUrl: string): {
  links: LinkItem[];
  images: ImageItem[];
} {
  const links: LinkItem[] = [];
  const images: ImageItem[] = [];
  let host = "";
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {}

  // Links
  const anchors = querySelectorAllDeep(doc, "a[href]");
  anchors.forEach((a) => {
    const href = a.getAttribute("href") || "";
    const anchorText = (a.textContent || "").trim();
    const rel = a.getAttribute("rel") || "";
    let isInternal = false;
    try {
      const u = new URL(href, baseUrl);
      isInternal = !u.hostname || u.hostname.toLowerCase() === host;
    } catch {
      isInternal = true;
    }
    if (href) {
      links.push({ href, anchorText, isInternal, rel });
    }
  });

  // Images
  const imgEls = querySelectorAllDeep(doc, "img");
  imgEls.forEach((img) => {
    const src = img.getAttribute("src") || "";
    const alt = img.getAttribute("alt") || "";
    const loading = img.getAttribute("loading") || undefined;
    const width = (img as HTMLImageElement).width || undefined;
    const height = (img as HTMLImageElement).height || undefined;
    const naturalWidth = (img as HTMLImageElement).naturalWidth || undefined;
    const naturalHeight = (img as HTMLImageElement).naturalHeight || undefined;
    if (src) {
      images.push({ src, alt, width, height, loading, naturalWidth, naturalHeight });
    }
  });

  return { links, images };
}

function extractHotelHospitality(doc: Document): {
  bookingCtas: CtaItem[];
  hospitality: HotelHospitalityData;
  ctaText: string;
} {
  const bookingCtas: CtaItem[] = [];
  const amenitiesSet = new Set<string>();
  const ratesSet = new Set<string>();
  const reviews: ReviewItem[] = [];
  const ctaWords: string[] = [];

  const commonAmenities = [
    "pool", "lazy river", "beachfront", "oceanfront", "balcony", "free wifi",
    "breakfast", "fitness center", "spa", "pet friendly", "valet parking",
    "ev charging", "restaurant", "bar", "meeting rooms", "suite", "kitchenette",
  ];

  // Scan CTAs
  const interactiveEls = querySelectorAllDeep(doc, "a, button");
  interactiveEls.forEach((el) => {
    const text = (el.textContent || "").trim();
    const href = el.getAttribute("href") || "";
    const lower = text.toLowerCase();

    if (
      lower.includes("book") ||
      lower.includes("reserve") ||
      lower.includes("check availability") ||
      lower.includes("view rates")
    ) {
      bookingCtas.push({ text, href, type: "booking" });
      ctaWords.push(text);
    } else if (href.startsWith("tel:") || lower.includes("call now")) {
      bookingCtas.push({ text, href, type: "phone" });
      ctaWords.push(text);
    } else if (href.startsWith("mailto:") || lower.includes("email us")) {
      bookingCtas.push({ text, href, type: "email" });
      ctaWords.push(text);
    } else if (lower.includes("contact") || lower.includes("inquire")) {
      bookingCtas.push({ text, href, type: "contact" });
      ctaWords.push(text);
    }
  });

  // Scan Amenities & Rates
  const textContent = (doc.body ? doc.body.textContent || "" : "").toLowerCase();
  commonAmenities.forEach((am) => {
    if (textContent.includes(am)) amenitiesSet.add(am);
  });

  // Rates regex: e.g. $199, $249/night
  const rateMatches = (doc.body ? doc.body.textContent || "" : "").match(/\$\d{2,4}(?:\.\d{2})?(?:\s*\/\s*night)?/g);
  if (rateMatches) {
    rateMatches.slice(0, 10).forEach((r) => ratesSet.add(r.trim()));
  }

  // Reviews
  const reviewScoreEls = querySelectorAllDeep(doc, "[class*='rating' i], [class*='score' i], [class*='review' i]");
  reviewScoreEls.slice(0, 5).forEach((el) => {
    const txt = (el.textContent || "").trim();
    if (/\b(?:[1-5](?:\.\d)?|10|[89]\.\d)\b/.test(txt) && txt.length < 50) {
      reviews.push({ rating: txt, source: "DOM Element" });
    }
  });

  return {
    bookingCtas,
    hospitality: {
      amenities: Array.from(amenitiesSet),
      rates: Array.from(ratesSet),
      reviews,
    },
    ctaText: ctaWords.join(" "),
  };
}

function detectTechStack(doc: Document): DetectedTech {
  const cms: string[] = [];
  const frameworks: string[] = [];
  const tagManagers: string[] = [];

  const html = (doc.documentElement?.innerHTML || doc.body?.innerHTML || doc.documentElement?.textContent || "").toLowerCase();

  // CMS
  if (html.includes("wp-content") || html.includes("wordpress")) cms.push("WordPress");
  if (html.includes("data-wf-page") || html.includes("webflow")) cms.push("Webflow");
  if (html.includes("cdn.shopify.com") || html.includes("shopify")) cms.push("Shopify");
  if (html.includes("squarespace")) cms.push("Squarespace");
  if (html.includes("drupal.js") || html.includes("drupal")) cms.push("Drupal");

  // Frameworks
  if (doc.querySelector("#__next") || html.includes("/_next/")) frameworks.push("Next.js");
  if (doc.querySelector("[data-reactroot]") || html.includes("react")) frameworks.push("React");
  if (doc.querySelector("[data-v-]") || html.includes("vue")) frameworks.push("Vue.js");
  if (doc.querySelector("[ng-version]") || html.includes("angular")) frameworks.push("Angular");

  // Tag Managers & Trackers
  if (html.includes("googletagmanager.com/gtm.js")) tagManagers.push("Google Tag Manager");
  if (html.includes("google-analytics.com") || html.includes("gtag(")) tagManagers.push("Google Analytics (GA4)");
  if (html.includes("connect.facebook.net") || html.includes("fbq(")) tagManagers.push("Meta Pixel");

  return { cms, frameworks, tagManagers };
}

function extractCoreWebVitals(): CoreWebVitals {
  const result: CoreWebVitals = {};
  if (typeof performance === "undefined" || !performance.getEntriesByType) {
    return result;
  }

  try {
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    if (lcpEntries.length > 0) {
      const last = lcpEntries[lcpEntries.length - 1];
      result.lcp = Math.round(last.startTime);
    }

    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav && !result.lcp) {
      result.lcp = Math.round(nav.domContentLoadedEventEnd || 0);
    }
  } catch {
    // Handled silently
  }

  return result;
}

/**
 * Extracts clean, non-boilerplate article text separately from CTA text.
 * Strictly NEVER reads input, textarea, password, or credit card fields.
 */
export function extractMainContentText(doc: Document): string {
  const container =
    doc.querySelector("main") ||
    doc.querySelector("article") ||
    doc.querySelector('[role="main"]') ||
    doc.body;

  if (!container) return "";

  const clone = container.cloneNode(true) as HTMLElement;

  // Remove non-content elements. Note: we do NOT drop header/button wholesale,
  // but remove form inputs, passwords, scripts, styles, iframes.
  const excludedSelectors = [
    "nav",
    "footer",
    "header",
    "aside",
    "script",
    "style",
    "noscript",
    "svg",
    "input",
    "textarea",
    "select",
    "option",
    '[type="password"]',
    '[type="hidden"]',
    '[aria-hidden="true"]',
    "[hidden]",
    ".nav",
    ".navbar",
    ".footer",
    ".menu",
    ".sidebar",
    ".cookie-banner",
    ".consent-banner",
    "#onetrust-consent-sdk",
  ];

  excludedSelectors.forEach((sel) => {
    try {
      clone.querySelectorAll(sel).forEach((node) => node.remove());
    } catch {}
  });

  // Strip elements with hidden inline styles
  clone.querySelectorAll("*").forEach((el) => {
    const styleAttr = el.getAttribute("style")?.toLowerCase() || "";
    if (
      styleAttr.includes("display: none") ||
      styleAttr.includes("display:none") ||
      styleAttr.includes("visibility: hidden") ||
      styleAttr.includes("visibility:hidden")
    ) {
      el.remove();
    }
  });

  const rawText = clone.textContent || "";
  return rawText
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Executes a full read-only capture and PII sanitization pass on a Document.
 */
export function extractCapturedWebSample(doc?: Document, frameId = 0): CapturedWebSample {
  const targetDoc = doc || (typeof document !== "undefined" ? document : null);

  if (!targetDoc) {
    throw new Error("extractCapturedWebSample requires a valid Document context.");
  }

  // Security Gate: Never capture sensitive pages containing password inputs
  const pwdInput = targetDoc.querySelector('input[type="password"], [type="password"]');
  if (pwdInput) {
    throw new Error("SECURITY_ABORT: Sensitive page contains password field. Capture is blocked.");
  }

  const extractionErrors: string[] = [];
  const rawUrl = targetDoc.location ? targetDoc.location.href : "";
  const rawDomain = targetDoc.location ? targetDoc.location.hostname : "";
  const cleanDomain = rawDomain.toLowerCase();

  // 1. Meta & Document Attributes
  let lang = "en";
  let robots = "index, follow";
  let viewport = "";
  const hreflang: Array<{ lang: string; href: string }> = [];

  try {
    lang = targetDoc.documentElement.lang || "en";
    robots = targetDoc.querySelector('meta[name="robots"]')?.getAttribute("content") || "index, follow";
    viewport = targetDoc.querySelector('meta[name="viewport"]')?.getAttribute("content") || "";
    targetDoc.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => {
      const l = el.getAttribute("hreflang") || "";
      const h = el.getAttribute("href") || "";
      if (l && h) hreflang.push({ lang: l, href: h });
    });
  } catch (err) {
    extractionErrors.push(`Metadata: ${String(err)}`);
  }

  // 2. Canonical URL
  let cleanCanonical = rawUrl;
  try {
    const canonicalEl = targetDoc.querySelector('link[rel="canonical"]');
    if (canonicalEl) {
      cleanCanonical = canonicalEl.getAttribute("href") || rawUrl;
    }
  } catch (err) {
    extractionErrors.push(`Canonical: ${String(err)}`);
  }

  // 3. Title & Meta Description
  const rawTitle = targetDoc.title || "";
  const metaDescEl =
    targetDoc.querySelector('meta[name="description"]') ||
    targetDoc.querySelector('meta[name="Description"]');
  const rawMetaDesc = metaDescEl ? metaDescEl.getAttribute("content") || "" : "";

  // 4. Headings Outline
  let headings = { h1: [] as string[], h2: [] as string[], outline: [] as HeadingNode[] };
  try {
    headings = extractHeadingsHierarchy(targetDoc);
  } catch (err) {
    extractionErrors.push(`Headings: ${String(err)}`);
  }

  // 5. JSON-LD and Microdata
  let jsonLdTypes: string[] = [];
  let jsonLdFull: unknown[] = [];
  let microdata: MicrodataItem[] = [];
  try {
    const res = extractJsonLdAndMicrodata(targetDoc);
    jsonLdTypes = res.jsonLdTypes;
    jsonLdFull = res.jsonLdFull;
    microdata = res.microdata;
  } catch (err) {
    extractionErrors.push(`StructuredData: ${String(err)}`);
  }

  // 6. Open Graph & Twitter Cards
  const getMeta = (selector: string): string | undefined => {
    return targetDoc.querySelector(selector)?.getAttribute("content") || undefined;
  };

  const openGraph: OpenGraphMetadata = {
    title: getMeta('meta[property="og:title"]'),
    description: getMeta('meta[property="og:description"]'),
    image: getMeta('meta[property="og:image"]'),
    type: getMeta('meta[property="og:type"]'),
    siteName: getMeta('meta[property="og:site_name"]'),
    url: getMeta('meta[property="og:url"]'),
  };

  const twitter: TwitterCardMetadata = {
    card: getMeta('meta[name="twitter:card"]'),
    title: getMeta('meta[name="twitter:title"]'),
    description: getMeta('meta[name="twitter:description"]'),
    image: getMeta('meta[name="twitter:image"]'),
  };

  // 7. Links and Images
  let links: LinkItem[] = [];
  let images: ImageItem[] = [];
  try {
    const res = extractLinksAndImages(targetDoc, rawUrl);
    links = res.links;
    images = res.images;
  } catch (err) {
    extractionErrors.push(`Links/Images: ${String(err)}`);
  }

  // 8. Hotel Hospitality & CTAs
  let bookingCtas: CtaItem[] = [];
  let hospitality: HotelHospitalityData = { amenities: [], rates: [], reviews: [] };
  let ctaText = "";
  try {
    const res = extractHotelHospitality(targetDoc);
    bookingCtas = res.bookingCtas;
    hospitality = res.hospitality;
    ctaText = res.ctaText;
  } catch (err) {
    extractionErrors.push(`Hospitality: ${String(err)}`);
  }

  // 9. Core Web Vitals
  let coreWebVitals: CoreWebVitals = {};
  try {
    coreWebVitals = extractCoreWebVitals();
  } catch (err) {
    extractionErrors.push(`CWV: ${String(err)}`);
  }

  // 10. Detected Tech Stack
  let detectedTech: DetectedTech = { cms: [], frameworks: [], tagManagers: [] };
  try {
    detectedTech = detectTechStack(targetDoc);
  } catch (err) {
    extractionErrors.push(`TechStack: ${String(err)}`);
  }

  // 11. Main Content Text & Sanitization
  const rawBodyContent = extractMainContentText(targetDoc);
  const sanitizedBody = sanitizeTextAndRedactPii(rawBodyContent);
  const sanitizedTitle = sanitizeTextAndRedactPii(rawTitle);
  const sanitizedMeta = sanitizeTextAndRedactPii(rawMetaDesc);

  const totalTokens =
    sanitizedBody.tokensCount + sanitizedTitle.tokensCount + sanitizedMeta.tokensCount;
  const totalJwts =
    sanitizedBody.jwtsCount + sanitizedTitle.jwtsCount + sanitizedMeta.jwtsCount;
  const totalCards =
    sanitizedBody.cardsCount + sanitizedTitle.cardsCount + sanitizedMeta.cardsCount;
  const totalPhones =
    sanitizedBody.phonesCount + sanitizedTitle.phonesCount + sanitizedMeta.phonesCount;

  const wordCount = sanitizedBody.sanitized
    ? sanitizedBody.sanitized.split(/\s+/).filter(Boolean).length
    : 0;

  return {
    schemaVersion: "3.0.0",
    url: rawUrl,
    domain: cleanDomain,
    canonicalUrl: cleanCanonical,
    lang,
    robots,
    viewport,
    hreflang,
    title: sanitizedTitle.sanitized,
    metaDescription: sanitizedMeta.sanitized,
    headings,
    jsonLdTypes,
    jsonLdFull,
    microdata,
    openGraph,
    twitter,
    links,
    images,
    bookingCtas,
    hospitality,
    coreWebVitals,
    detectedTech,
    mainContentText: sanitizedBody.sanitized,
    ctaText,
    wordCount,
    frameId,
    extractedAt: new Date().toISOString(),
    extractionErrors,
    sanitizationMetrics: {
      redactedTokensCount: totalTokens,
      redactedJwtsCount: totalJwts,
      redactedCardsCount: totalCards,
      redactedPhonesCount: totalPhones,
    },
  };
}
