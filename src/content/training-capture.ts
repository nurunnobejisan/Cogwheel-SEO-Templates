/**
 * Cogwheel SEO & GEO Studio - Universal Read-Only Training Data Extractor & PII Sanitizer
 *
 * Manifest V3 compatible content module that extracts clean structured search metadata
 * and main article text while guaranteeing strict PII redaction (emails, phone numbers,
 * tracking tokens, and query credentials) before returning a typed CapturedWebSample.
 */

export interface SanitizationMetrics {
  redactedEmailsCount: number;
  redactedPhonesCount: number;
  redactedQueryTokensCount: number;
}

export interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  siteName?: string;
  url?: string;
}

export interface CapturedWebSample {
  url: string;
  domain: string;
  canonicalUrl: string;
  title: string;
  metaDescription: string;
  headings: {
    h1: string[];
    h2: string[];
  };
  jsonLdTypes: string[];
  openGraph: OpenGraphMetadata;
  mainContentText: string;
  wordCount: number;
  extractedAt: string;
  sanitizationMetrics: SanitizationMetrics;
}

// ============================================================================
// 1. PII REDACTION & SANITIZATION ENGINE
// ============================================================================

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Matches US/International telephone numbers with delimiters:
// +1-850-230-6004, (850) 230-6004, 850-230-6004, 850.230.6004, 1-800-555-0199
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{3}\)|\b\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// Matches embedded URL query strings in text
const URL_QUERY_IN_TEXT_REGEX = /(https?:\/\/[^\s"'<>\)]+)(\?[^\s"'<>\)#]+)/gi;

/**
 * Sanitizes arbitrary text by redacting emails, telephone numbers, and query strings.
 */
export function sanitizeTextAndRedactPii(text: string): {
  sanitized: string;
  emailsCount: number;
  phonesCount: number;
  queriesCount: number;
} {
  if (!text) {
    return { sanitized: "", emailsCount: 0, phonesCount: 0, queriesCount: 0 };
  }

  let emailsCount = 0;
  let phonesCount = 0;
  let queriesCount = 0;

  // 1. Redact Emails
  const withoutEmails = text.replace(EMAIL_REGEX, () => {
    emailsCount++;
    return "[REDACTED_EMAIL]";
  });

  // 2. Redact Phone Numbers
  const withoutPhones = withoutEmails.replace(PHONE_REGEX, () => {
    phonesCount++;
    return "[REDACTED_PHONE]";
  });

  // 3. Redact URL Query Tokens
  const withoutQueries = withoutPhones.replace(URL_QUERY_IN_TEXT_REGEX, (_match, p1) => {
    queriesCount++;
    return `${p1}?redacted_query=true`;
  });

  return {
    sanitized: withoutQueries,
    emailsCount,
    phonesCount,
    queriesCount,
  };
}

/**
 * Strips sensitive query strings and tokens from a standalone URL.
 */
export function sanitizeUrlString(rawUrl: string): {
  sanitizedUrl: string;
  hasRedactedQuery: boolean;
} {
  if (!rawUrl) return { sanitizedUrl: "", hasRedactedQuery: false };

  try {
    const parsed = new URL(rawUrl);
    if (parsed.search && parsed.search.length > 1) {
      parsed.search = "?redacted_query=true";
      return { sanitizedUrl: parsed.toString(), hasRedactedQuery: true };
    }
    return { sanitizedUrl: rawUrl, hasRedactedQuery: false };
  } catch {
    if (rawUrl.includes("?")) {
      const [base, rest] = rawUrl.split("?");
      const hash = rest.includes("#") ? "#" + rest.split("#")[1] : "";
      return { sanitizedUrl: `${base}?redacted_query=true${hash}`, hasRedactedQuery: true };
    }
    return { sanitizedUrl: rawUrl, hasRedactedQuery: false };
  }
}

// ============================================================================
// 2. READ-ONLY DOM EXTRACTION
// ============================================================================

/**
 * Extracts Schema.org @type strings from parsed JSON-LD structures recursively.
 */
function harvestJsonLdTypes(obj: unknown, typesSet: Set<string>): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach((item) => harvestJsonLdTypes(item, typesSet));
    return;
  }

  const record = obj as Record<string, unknown>;

  if (record["@type"]) {
    if (typeof record["@type"] === "string") {
      typesSet.add(record["@type"]);
    } else if (Array.isArray(record["@type"])) {
      record["@type"].forEach((t) => {
        if (typeof t === "string") typesSet.add(t);
      });
    }
  }

  if (Array.isArray(record["@graph"])) {
    record["@graph"].forEach((item) => harvestJsonLdTypes(item, typesSet));
  }

  if (record["mainEntity"]) {
    harvestJsonLdTypes(record["mainEntity"], typesSet);
  }

  if (record["itemListElement"]) {
    harvestJsonLdTypes(record["itemListElement"], typesSet);
  }
}

/**
 * Extracts clean, non-boilerplate article text from the primary content area.
 * Completely non-destructive: clones DOM nodes before stripping unwanted elements.
 */
export function extractMainContentText(doc: Document): string {
  // Determine primary content root
  const container =
    doc.querySelector("main") ||
    doc.querySelector("article") ||
    doc.querySelector('[role="main"]') ||
    doc.body;

  if (!container) return "";

  // Deep clone to guarantee read-only DOM execution
  const clone = container.cloneNode(true) as HTMLElement;

  // Unwanted elements to exclude
  const excludedSelectors = [
    "nav",
    "footer",
    "header",
    "aside",
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "button",
    "form",
    "dialog",
    "select",
    "textarea",
    '[aria-hidden="true"]',
    "[hidden]",
    ".nav",
    ".navbar",
    ".footer",
    ".menu",
    ".sidebar",
    ".cookie-banner",
    ".modal",
  ];

  excludedSelectors.forEach((sel) => {
    try {
      const nodes = clone.querySelectorAll(sel);
      nodes.forEach((node) => node.remove());
    } catch {
      // Ignore selector syntax issues in edge cases
    }
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

  // Extract inner text or textContent
  const rawText = clone.textContent || "";

  // Normalize whitespace: collapse consecutive spaces and excessive line breaks
  return rawText
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Executes a full read-only capture and PII sanitization pass on a Document.
 */
export function extractCapturedWebSample(doc?: Document): CapturedWebSample {
  const targetDoc = doc || (typeof document !== "undefined" ? document : null);

  if (!targetDoc) {
    throw new Error("extractCapturedWebSample requires a valid Document context.");
  }

  let totalEmailsRedacted = 0;
  let totalPhonesRedacted = 0;
  let totalQueriesRedacted = 0;

  // 1. URL & Domain
  const rawUrl = targetDoc.location ? targetDoc.location.href : "";
  const { sanitizedUrl: cleanUrl, hasRedactedQuery: urlHasQuery } = sanitizeUrlString(rawUrl);
  if (urlHasQuery) totalQueriesRedacted++;

  const rawDomain = targetDoc.location ? targetDoc.location.hostname : "";
  const cleanDomain = rawDomain.toLowerCase();

  // 2. Canonical URL
  const canonicalEl = targetDoc.querySelector('link[rel="canonical"]');
  const rawCanonical = canonicalEl ? (canonicalEl.getAttribute("href") || "") : cleanUrl;
  const { sanitizedUrl: cleanCanonical, hasRedactedQuery: canonHasQuery } = sanitizeUrlString(rawCanonical);
  if (canonHasQuery) totalQueriesRedacted++;

  // 3. Title Tag
  const rawTitle = targetDoc.title || "";
  const titleSanitized = sanitizeTextAndRedactPii(rawTitle);
  totalEmailsRedacted += titleSanitized.emailsCount;
  totalPhonesRedacted += titleSanitized.phonesCount;
  totalQueriesRedacted += titleSanitized.queriesCount;

  // 4. Meta Description
  const metaDescEl =
    targetDoc.querySelector('meta[name="description"]') ||
    targetDoc.querySelector('meta[name="Description"]');
  const rawMetaDesc = metaDescEl ? (metaDescEl.getAttribute("content") || "") : "";
  const metaSanitized = sanitizeTextAndRedactPii(rawMetaDesc);
  totalEmailsRedacted += metaSanitized.emailsCount;
  totalPhonesRedacted += metaSanitized.phonesCount;
  totalQueriesRedacted += metaSanitized.queriesCount;

  // 5. Headings (H1 & H2)
  const h1Elements = Array.from(targetDoc.querySelectorAll("h1"))
    .map((el) => el.textContent?.trim() || "")
    .filter(Boolean)
    .map((text) => {
      const res = sanitizeTextAndRedactPii(text);
      totalEmailsRedacted += res.emailsCount;
      totalPhonesRedacted += res.phonesCount;
      totalQueriesRedacted += res.queriesCount;
      return res.sanitized;
    });

  const h2Elements = Array.from(targetDoc.querySelectorAll("h2"))
    .map((el) => el.textContent?.trim() || "")
    .filter(Boolean)
    .map((text) => {
      const res = sanitizeTextAndRedactPii(text);
      totalEmailsRedacted += res.emailsCount;
      totalPhonesRedacted += res.phonesCount;
      totalQueriesRedacted += res.queriesCount;
      return res.sanitized;
    });

  // 6. JSON-LD Structured Data Types
  const jsonLdTypesSet = new Set<string>();
  const jsonLdScripts = targetDoc.querySelectorAll('script[type="application/ld+json"]');

  jsonLdScripts.forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent || "");
      harvestJsonLdTypes(parsed, jsonLdTypesSet);
    } catch {
      // Ignore unparseable JSON-LD blocks
    }
  });

  // 7. Open Graph Metadata
  const getOgTag = (prop: string): string | undefined => {
    const el = targetDoc.querySelector(`meta[property="${prop}"]`);
    return el ? (el.getAttribute("content") || undefined) : undefined;
  };

  const rawOgTitle = getOgTag("og:title");
  const rawOgDesc = getOgTag("og:description");
  const rawOgImage = getOgTag("og:image");
  const rawOgUrl = getOgTag("og:url");

  const openGraph: OpenGraphMetadata = {
    title: rawOgTitle ? sanitizeTextAndRedactPii(rawOgTitle).sanitized : undefined,
    description: rawOgDesc ? sanitizeTextAndRedactPii(rawOgDesc).sanitized : undefined,
    image: rawOgImage ? sanitizeUrlString(rawOgImage).sanitizedUrl : undefined,
    type: getOgTag("og:type"),
    siteName: getOgTag("og:site_name"),
    url: rawOgUrl ? sanitizeUrlString(rawOgUrl).sanitizedUrl : undefined,
  };

  // 8. Main Content Text Extraction
  const rawBodyContent = extractMainContentText(targetDoc);
  const bodySanitized = sanitizeTextAndRedactPii(rawBodyContent);
  totalEmailsRedacted += bodySanitized.emailsCount;
  totalPhonesRedacted += bodySanitized.phonesCount;
  totalQueriesRedacted += bodySanitized.queriesCount;

  // Word count calculation on sanitized body text
  const words = bodySanitized.sanitized
    ? bodySanitized.sanitized.split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  return {
    url: cleanUrl,
    domain: cleanDomain,
    canonicalUrl: cleanCanonical,
    title: titleSanitized.sanitized,
    metaDescription: metaSanitized.sanitized,
    headings: {
      h1: h1Elements,
      h2: h2Elements,
    },
    jsonLdTypes: Array.from(jsonLdTypesSet),
    openGraph,
    mainContentText: bodySanitized.sanitized,
    wordCount: words,
    extractedAt: new Date().toISOString(),
    sanitizationMetrics: {
      redactedEmailsCount: totalEmailsRedacted,
      redactedPhonesCount: totalPhonesRedacted,
      redactedQueryTokensCount: totalQueriesRedacted,
    },
  };
}
