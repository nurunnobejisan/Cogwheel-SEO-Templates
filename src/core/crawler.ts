import net from "node:net";

export const SERVICE_PATTERNS: Record<string, RegExp> = {
  lodging: /\b(?:hotels?|inns?|motels?|lodging|stays?|places\s+to\s+stay|rooms?)\b/i,
  accommodations: /\b(?:accommodations?)\b/i,
  resort: /\b(?:resorts?|retreats?|getaways?)\b/i,
  spa: /\b(?:spas?|massages?|facials?|saunas?|wellness|day\s+spas?)\b/i,
  pool: /\b(?:pools?|swim(?:ming)?|waterparks?|lazy\s+river)\b/i,
  hot_tub: /\b(?:jacuzzis?|hot\s+tubs?|whirlpools?)\b/i,
  suites: /\b(?:suites?|extended\s+stay|kitchenettes?)\b/i,
  boutique: /\b(?:boutique)\b/i,
  luxury: /\b(?:luxury|luxurious|5\s+star|five\s+star|4\s+star|four\s+star|upscale)\b/i,
  pet_friendly: /\b(?:pets?|pet\s+friendly|dogs?|dog\s+friendly)\b/i,
  wedding: /\b(?:weddings?|bridal|ceremon(?:y|ies)|receptions?)\b/i,
  meetings_events: /\b(?:meetings?|conferences?|conventions?|ballrooms?|banquets?|events?)\b/i,
  venues: /\b(?:venues?)\b/i,
  dining: /\b(?:restaurants?|dining|bistros?|steakhouses?)\b/i,
  breakfast: /\b(?:breakfast|brunch)\b/i,
  things_to_do: /\b(?:things?\s+to\s+do|attractions?|activities|sightseeing)\b/i,
  waterfront: /\b(?:waterfront|riverfront|riverwalk|beachfront|oceanfront|lakefront|lakeside)\b/i,
  golf: /\b(?:golf(?:ing)?)\b/i,
  casino: /\b(?:casinos?|gaming|slots?)\b/i,
  ski: /\b(?:ski(?:ing)?|snowboard(?:ing)?)\b/i,
  all_inclusive: /\b(?:all[\s-]+inclusive)\b/i,
  family: /\b(?:famil(?:y|ies)|kids?)\b/i,
  romantic: /\b(?:romantic|couples?|honeymoon)\b/i,
  packages_deals: /\b(?:packages?|deals?|specials?|offers?|discounts?)\b/i,
};

export const SERVICE_LABELS: Record<string, string> = {
  lodging: "Hotel & Lodging",
  accommodations: "Accommodations",
  resort: "Resort & Getaways",
  spa: "Spa & Wellness",
  pool: "Pool & Aquatics",
  hot_tub: "Hot Tub / Jacuzzi",
  suites: "Suites",
  boutique: "Boutique Hotel",
  luxury: "Luxury / Upscale",
  pet_friendly: "Pet-Friendly",
  wedding: "Weddings",
  meetings_events: "Meetings & Events",
  venues: "Event Venues",
  dining: "Restaurants & Dining",
  breakfast: "Breakfast",
  things_to_do: "Local Attractions / Things to Do",
  waterfront: "Waterfront / Riverfront",
  golf: "Golf",
  casino: "Casino",
  ski: "Ski",
  all_inclusive: "All-Inclusive",
  family: "Family-Friendly",
  romantic: "Romantic / Couples",
  packages_deals: "Packages & Deals",
};

const STRUCTURAL_ONLY_SERVICES = new Set([
  "spa",
  "pool",
  "resort",
  "casino",
  "golf",
  "ski",
  "all_inclusive",
  "boutique",
  "hot_tub",
]);

const PRIORITY_SLUG_RE =
  /(?:amenit|spa|dining|restaurant|meeting|wedding|event|gather|venue|room|suite|pool|accommodat|overview|experience|offer|package|pet|family|golf|casino|resort|boutique|service|solution|product|feature|pricing|about|work|portfolio|case|menu|shop|store|categor)/i;

const ASSET_EXT_RE = /\.(?:pdf|jpg|jpeg|png|gif|webp|svg|css|js|xml|zip|ico|woff2?|mp4)$/i;

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }
  return false;
}

/**
 * Validates and normalizes a target website URL with SSRF protections.
 * Ported from nurunnobejisan/SEO (`_validate_target_url`).
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

export function detectServicesInText(text: string): Set<string> {
  const cleaned = (text || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const found = new Set<string>();
  for (const [svc, pat] of Object.entries(SERVICE_PATTERNS)) {
    if (pat.test(cleaned)) found.add(svc);
  }
  return found;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

export function extractHtmlCrawlText(html: string): { title: string; text: string; headings: string[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(cleanText(titleMatch[1].replace(/<[^>]+>/g, " "))) : "";

  const metaParts: string[] = [];
  for (const m of html.matchAll(
    /<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|keywords)["'][^>]+content=["']([^"']+)["']/gi,
  )) {
    metaParts.push(decodeHtmlEntities(m[1]));
  }
  for (const m of html.matchAll(
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:title|og:description|keywords)["']/gi,
  )) {
    metaParts.push(decodeHtmlEntities(m[1]));
  }

  const strippedScripts = html.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const headings: string[] = [];
  for (const m of strippedScripts.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)) {
    const h = decodeHtmlEntities(cleanText(m[1].replace(/<[^>]+>/g, " ")));
    if (h.length >= 4 && h.length <= 80 && !headings.includes(h) && !/[{}]|page\.title|\+\s*['"]/.test(h)) {
      headings.push(h);
      if (headings.length >= 12) break;
    }
  }

  const visible = decodeHtmlEntities(cleanText(strippedScripts.replace(/<[^>]+>/g, " ")));
  return {
    title,
    text: [title, ...metaParts, visible].filter(Boolean).join(" "),
    headings,
  };
}

async function fetchHtml(url: string, timeoutMs = 4000): Promise<{ html: string; finalUrl: string; status: number }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = (await res.text()).slice(0, 750_000);
  return { html, finalUrl: res.url || url, status: res.status };
}

async function fetchViaReader(url: string, timeoutMs = 5500): Promise<{ title: string; text: string }> {
  const readerUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(readerUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/plain, text/markdown;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const txt = (await res.text()).slice(0, 400_000);
  const titleMatch = txt.match(/^Title:\s*(.+)$/m);
  return { title: titleMatch ? cleanText(titleMatch[1]) : "", text: txt };
}

export async function discoverSitemapUrls(baseUrl: string, timeoutMs = 2800): Promise<string[]> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const probes = [`${origin}/robots.txt`, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const probeResults = await Promise.all(
    probes.map(async (u) => {
      try {
        const { html, status } = await fetchHtml(u, timeoutMs);
        return [u, status < 400 ? html : ""] as const;
      } catch {
        return [u, ""] as const;
      }
    }),
  );
  const resultMap = new Map<string, string>(probeResults);

  const discoveredPages: string[] = [];
  const childSitemaps: string[] = [];
  const extraSitemaps: string[] = [];

  const robotsTxt = resultMap.get(`${origin}/robots.txt`) ?? "";
  for (const m of robotsTxt.matchAll(/^sitemap:\s*(\S+)/gim)) {
    const smUrl = m[1].trim();
    if (smUrl && !probes.includes(smUrl) && !extraSitemaps.includes(smUrl)) {
      extraSitemaps.push(smUrl);
    }
  }

  const parseSitemapXml = (xmlText: string) => {
    if (!xmlText) return;
    const locs = [...xmlText.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => m[1].trim()).filter(Boolean);
    if (xmlText.toLowerCase().includes("<sitemapindex")) {
      for (const loc of locs) {
        if (!childSitemaps.includes(loc)) childSitemaps.push(loc);
      }
    } else {
      for (const loc of locs) {
        if (!discoveredPages.includes(loc)) discoveredPages.push(loc);
      }
    }
  };

  parseSitemapXml(resultMap.get(`${origin}/sitemap.xml`) ?? "");
  if (discoveredPages.length === 0 && childSitemaps.length === 0) {
    parseSitemapXml(resultMap.get(`${origin}/sitemap_index.xml`) ?? "");
  }
  for (const smUrl of extraSitemaps.slice(0, 2)) {
    if (discoveredPages.length > 0 || childSitemaps.length > 0) break;
    try {
      const { html, status } = await fetchHtml(smUrl, timeoutMs);
      if (status < 400) parseSitemapXml(html);
    } catch {
      // ignore failed extra sitemap
    }
  }

  if (childSitemaps.length > 0) {
    const childXmls = await Promise.all(
      childSitemaps.slice(0, 8).map(async (u) => {
        try {
          const { html, status } = await fetchHtml(u, timeoutMs);
          return status < 400 ? html : "";
        } catch {
          return "";
        }
      }),
    );
    for (const cXml of childXmls) {
      for (const m of cXml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
        const loc = m[1].trim();
        if (loc && !discoveredPages.includes(loc)) discoveredPages.push(loc);
      }
    }
  }

  return discoveredPages;
}

export interface CrawlOptions {
  fallbackText?: string;
  workbookUrls?: string[];
  maxSubpages?: number;
  useReaderFallback?: boolean;
}

export interface CrawlResult {
  targetUrl: string;
  pageTitle: string;
  crawledPages: number;
  crawledUrls: string[];
  sitemapUrls: number;
  services: string[];
  serviceLabels: string[];
  pageTopics: string[];
  plainText: string;
  blocked: boolean;
  warnings: string[];
}

export interface Crawler {
  crawl(targetUrl: string, options?: CrawlOptions): Promise<CrawlResult>;
}

const CRAWL_CACHE_TTL_MS = 15 * 60 * 1000;
const crawlCache = new Map<string, { timestamp: number; result: CrawlResult }>();

export function clearCrawlCache(): void {
  crawlCache.clear();
}

export async function crawlTargetWebsite(targetUrl: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const normalizedUrl = validateTargetUrl(targetUrl);
  const fallbackText = (options.fallbackText ?? "").trim();
  const workbookUrls = options.workbookUrls ?? [];
  const maxSubpages = options.maxSubpages ?? 10;
  const useReaderFallback = options.useReaderFallback ?? true;

  const cacheKey = `${normalizedUrl.toLowerCase()}|${fallbackText.toLowerCase()}|${workbookUrls.length}`;
  if (normalizedUrl) {
    const cached = crawlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CRAWL_CACHE_TTL_MS) {
      return {
        ...cached.result,
        crawledUrls: [...cached.result.crawledUrls],
        services: [...cached.result.services],
        serviceLabels: [...cached.result.serviceLabels],
        pageTopics: [...cached.result.pageTopics],
        warnings: [...cached.result.warnings],
      };
    }
  }

  const deadline = Date.now() + 8000;
  let crawledPages = 0;
  const crawledUrls: string[] = [];
  let sitemapUrlCount = 0;
  let pageTitle = "";
  const urlSlugChunks: string[] = [];
  const bodyChunks: string[] = [];
  const pageTopics: string[] = [];
  const warnings: string[] = [];
  let blocked = false;

  if (normalizedUrl) {
    const cleanUrl = normalizedUrl.replace(/\/(?:wp-admin|wp-login\.php).*$/i, "/");
    const parsed = new URL(cleanUrl);
    urlSlugChunks.push(parsed.pathname.toLowerCase().replace(/[^a-z0-9]+/g, " "));

    const [sitemapRaw, homeRes] = await Promise.all([
      discoverSitemapUrls(cleanUrl, 2200),
      fetchHtml(cleanUrl, 4500).catch(() => ({ html: "", finalUrl: cleanUrl, status: 0 })),
    ]);

    let sitemapUrls = sitemapRaw;
    const pathParts = parsed.pathname
      .replace(/^\/|\/$/g, "")
      .split("/")
      .filter((p) => p && !["en", "en-us", "hotels", "hotel", "overview"].includes(p.toLowerCase()));
    if (pathParts.length > 0 && sitemapUrls.length > 30) {
      const propKey = pathParts[0].toLowerCase();
      const scoped = sitemapUrls.filter((u) => u.toLowerCase().includes(propKey));
      if (scoped.length > 0 || sitemapUrls.length > 150) {
        sitemapUrls = scoped;
      }
    }

    sitemapUrlCount = sitemapUrls.length;
    for (const smU of sitemapUrls) {
      try {
        urlSlugChunks.push(new URL(smU).pathname.toLowerCase().replace(/[^a-z0-9]+/g, " "));
      } catch {
        // ignore invalid url
      }
    }

    const priorityCandidates: string[] = [];
    const generalCandidates: string[] = [];
    const baseHost = new URL(homeRes.finalUrl || cleanUrl).hostname.toLowerCase().replace(/^www\./, "");

    const htmlLower = homeRes.html.slice(0, 2000).toLowerCase();
    const isBlockedOrEmpty =
      !homeRes.html ||
      homeRes.status >= 400 ||
      htmlLower.slice(0, 800).includes("access denied") ||
      htmlLower.includes("cf-browser-verification");

    if (!isBlockedOrEmpty) {
      const extracted = extractHtmlCrawlText(homeRes.html);
      if (extracted.text.length >= 180) {
        pageTitle = extracted.title;
        bodyChunks.push(extracted.text);
        crawledPages += 1;
        crawledUrls.push(homeRes.finalUrl || cleanUrl);
        pageTopics.push(...extracted.headings);

        const hrefs = [...homeRes.html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
        for (const h of [...hrefs, ...sitemapUrls]) {
          try {
            const full = new URL(h, homeRes.finalUrl || cleanUrl);
            full.search = "";
            const fullStr = full.toString().replace(/\/$/, "");
            const host = full.hostname.toLowerCase().replace(/^www\./, "");
            if (
              (full.protocol === "http:" || full.protocol === "https:") &&
              host === baseHost &&
              fullStr !== (homeRes.finalUrl || cleanUrl).replace(/\/$/, "") &&
              !ASSET_EXT_RE.test(full.pathname)
            ) {
              urlSlugChunks.push(full.pathname.toLowerCase().replace(/[^a-z0-9]+/g, " "));
              if (PRIORITY_SLUG_RE.test(full.pathname)) {
                if (!priorityCandidates.includes(fullStr)) priorityCandidates.push(fullStr);
              } else if (!generalCandidates.includes(fullStr)) {
                generalCandidates.push(fullStr);
              }
            }
          } catch {
            // ignore malformed href
          }
        }
      } else {
        blocked = true;
      }
    } else {
      blocked = true;
    }

    if (blocked && useReaderFallback && Date.now() < deadline - 1500) {
      try {
        const reader = await fetchViaReader(cleanUrl, 4500);
        if (reader.text && !reader.text.slice(0, 400).includes("Access Denied")) {
          blocked = false;
          pageTitle = pageTitle || reader.title;
          bodyChunks.push(reader.text);
          crawledPages += 1;
          crawledUrls.push(cleanUrl);
          for (const m of reader.text.matchAll(/^#{1,2}\s+(.+)$/gm)) {
            const hm = cleanText(m[1]);
            if (hm.length >= 4 && hm.length <= 80 && !pageTopics.includes(hm)) {
              pageTopics.push(hm);
            }
          }
          for (const m of reader.text.matchAll(/https?:\/\/[^\s)"'>]+/g)) {
            try {
              const lu = new URL(m[0]);
              lu.search = "";
              const luStr = lu.toString().replace(/\/$/, "");
              if (lu.hostname.toLowerCase().replace(/^www\./, "") === baseHost) {
                if (PRIORITY_SLUG_RE.test(lu.pathname)) {
                  if (!priorityCandidates.includes(luStr)) priorityCandidates.push(luStr);
                } else if (!generalCandidates.includes(luStr)) {
                  generalCandidates.push(luStr);
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        warnings.push(`Could not reach ${cleanUrl} directly or via reader fallback.`);
      }

      for (const smU of sitemapUrls) {
        if (PRIORITY_SLUG_RE.test(smU)) {
          if (!priorityCandidates.includes(smU)) priorityCandidates.push(smU);
        } else if (!generalCandidates.includes(smU)) {
          generalCandidates.push(smU);
        }
      }
    } else if (blocked) {
      warnings.push(
        homeRes.status >= 400
          ? `Site returned HTTP ${homeRes.status} — using default sitemap and manual property fields.`
          : `Could not reach ${cleanUrl} — using defaults.`,
      );
    }

    const subCandidates = [...priorityCandidates, ...generalCandidates].slice(0, maxSubpages);
    if (subCandidates.length > 0 && Date.now() < deadline - 800) {
      const remTimeout = Math.max(1200, Math.min(2500, deadline - Date.now()));
      const subResults = await Promise.all(
        subCandidates.map(async (subU) => {
          try {
            const { html, status } = await fetchHtml(subU, remTimeout);
            if (status < 400 && !html.slice(0, 600).toLowerCase().includes("access denied")) {
              const ext = extractHtmlCrawlText(html);
              return { subU, ...ext };
            }
          } catch {
            // ignore subpage error
          }
          return null;
        }),
      );

      for (const res of subResults) {
        if (!res) continue;
        if (!pageTitle && res.title) pageTitle = res.title;
        bodyChunks.push(res.text);
        crawledPages += 1;
        crawledUrls.push(res.subU);
        for (const h of res.headings) {
          if (!pageTopics.includes(h) && pageTopics.length < 16) pageTopics.push(h);
        }
      }
    }
  }

  for (const wu of workbookUrls.slice(0, 300)) {
    try {
      urlSlugChunks.push(new URL(wu).pathname.toLowerCase().replace(/[^a-z0-9]+/g, " "));
    } catch {
      // ignore
    }
  }
  if (fallbackText) urlSlugChunks.push(fallbackText);
  if (pageTitle) urlSlugChunks.push(pageTitle);

  const slugCombined = urlSlugChunks.join("\n");
  const bodyCombined = bodyChunks.join("\n");
  const slugServices = detectServicesInText(slugCombined);
  const bodyServices = detectServicesInText(bodyCombined);

  const websiteServices = new Set<string>(slugServices);
  for (const svc of bodyServices) {
    if (!STRUCTURAL_ONLY_SERVICES.has(svc)) websiteServices.add(svc);
  }
  if (/\b(?:hotels?|resorts?|inns?|motels?|lodging|suites?|accommodations?)\b/i.test(`${slugCombined} ${bodyCombined}`)) {
    websiteServices.add("lodging");
  }

  const services = [...websiteServices].sort();
  const result: CrawlResult = {
    targetUrl: normalizedUrl,
    pageTitle,
    crawledPages,
    crawledUrls: crawledUrls.slice(0, 12),
    sitemapUrls: sitemapUrlCount,
    services,
    serviceLabels: services.map((s) => SERVICE_LABELS[s] ?? s),
    pageTopics: pageTopics.slice(0, 12),
    plainText: bodyCombined.slice(0, 60_000),
    blocked: blocked && crawledPages === 0,
    warnings,
  };

  if (normalizedUrl) {
    if (crawlCache.size > 64) crawlCache.clear();
    crawlCache.set(cacheKey, { timestamp: Date.now(), result });
  }

  return result;
}

export const defaultCrawler: Crawler = {
  crawl: crawlTargetWebsite,
};
