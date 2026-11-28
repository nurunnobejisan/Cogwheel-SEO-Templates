/**
 * SEO Studio Templates — Canonical URL Normalizer
 * 
 * Enforces:
 * - HTTPS protocol enforcement
 * - Marketing & tracking parameter stripping (utm_*, fbclid, gclid, etc.)
 * - Slash deduplication (without breaking protocol https://)
 * - Trailing slash policy (default: trailing slash for clean folder structures)
 * - Lowercase hostnames
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "zanpid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "ref"
]);

export interface CanonicalOptions {
  trailingSlash?: boolean;
  forceHttps?: boolean;
  stripTracking?: boolean;
  stripHash?: boolean;
}

export function normalizeCanonicalUrl(
  rawUrl: string,
  options: CanonicalOptions = {}
): string {
  const opts: Required<CanonicalOptions> = {
    trailingSlash: true,
    forceHttps: true,
    stripTracking: true,
    stripHash: true,
    ...options
  };

  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Invalid URL provided to canonical normalizer.");
  }

  let cleaned = rawUrl.trim();

  // If URL has no protocol, prepend https://
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = "https://" + cleaned;
  }

  // Deduplicate consecutive slashes without damaging protocol
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse URL for canonical normalization: ${rawUrl}`);
  }

  // 1. Force HTTPS
  if (opts.forceHttps) {
    parsed.protocol = "https:";
  }

  // 2. Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase();

  // 3. Strip tracking parameters
  if (opts.stripTracking) {
    const keysToRemove: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith("utm_")) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((k) => parsed.searchParams.delete(k));
  }

  // 4. Strip Hash
  if (opts.stripHash) {
    parsed.hash = "";
  }

  // 5. Handle trailing slash on pathname
  let pathname = parsed.pathname;
  // If it's not a file extension like .html, .xml, .json, .pdf
  const hasFileExtension = /\.[a-zA-Z0-9]{2,5}$/.test(pathname);

  if (!hasFileExtension) {
    if (opts.trailingSlash && !pathname.endsWith("/")) {
      pathname += "/";
    } else if (!opts.trailingSlash && pathname.endsWith("/") && pathname !== "/") {
      pathname = pathname.slice(0, -1);
    }
  }

  parsed.pathname = pathname;

  return parsed.toString();
}
