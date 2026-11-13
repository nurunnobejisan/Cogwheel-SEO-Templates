import net from "node:net";

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gclsrc",
  "dclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "igshid",
]);

function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower === "::" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd");
  }
  return false;
}

/**
 * Validates and normalizes a target website URL with SSRF protections.
 */
export function validateTargetUrl(rawUrl: string): string {
  let url = (rawUrl || "").trim();
  if (!url) return "";

  if (!/^https?:\/\//i.test(url)) {
    if (url.includes("://")) {
      throw new UrlValidationError("Target Website URL must use http:// or https://.");
    }
    url = `https://${url}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UrlValidationError("Please enter a valid Target Website URL.");
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || (!host.includes(".") && net.isIP(host) === 0)) {
    throw new UrlValidationError("Please enter a valid Target Website domain (e.g. https://thenines.com/).");
  }
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new UrlValidationError("Local or internal hostnames are not allowed as Target Website URLs.");
  }
  if (net.isIP(host) !== 0 && isPrivateOrReservedIp(host)) {
    throw new UrlValidationError("Private or reserved IP addresses are not allowed as Target Website URLs.");
  }
  return parsed.toString();
}

export function canonicalHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Normalizes a URL for crawl deduplication:
 * - Resolves relative URLs against base
 * - Strips #fragments and tracking query parameters
 * - Strips trailing slash on non-root paths
 * - Enforces same host when `baseHost` is provided (returns null if external or non-http)
 */
export function normalizeCrawlUrl(rawHref: string, baseUrl: string, enforceSameHost = true): string | null {
  let parsed: URL;
  let base: URL;
  try {
    base = new URL(baseUrl);
    parsed = new URL(rawHref, base);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (enforceSameHost && canonicalHost(parsed.hostname) !== canonicalHost(base.hostname)) {
    return null;
  }

  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

export function matchesIncludeExclude(
  url: string,
  includePatterns: string[] = [],
  excludePatterns: string[] = [],
): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }

  for (const ex of excludePatterns) {
    const trimmed = ex.trim();
    if (!trimmed) continue;
    if (pathname.includes(trimmed) || url.includes(trimmed)) return false;
  }

  const activeIncludes = includePatterns.map((p) => p.trim()).filter(Boolean);
  if (activeIncludes.length === 0) return true;

  return activeIncludes.some((inc) => pathname.includes(inc) || url.includes(inc));
}

