export * from "./fetcher";
export * from "./parser";
export * from "./robots";
export * from "./sitemap";
export * from "./storage";
export * from "./types";
export * from "./url";

// Compatibility facade for /api/crawl-property and existing tests
import { fetchAndParseSitemaps } from "./sitemap";
import { validateTargetUrl } from "./url";

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

export function detectServicesInText(text: string): Set<string> {
  const cleaned = (text || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const found = new Set<string>();
  for (const [svc, pat] of Object.entries(SERVICE_PATTERNS)) {
    if (pat.test(cleaned)) found.add(svc);
  }
  return found;
}

export function extractHtmlCrawlText(html: string): { title: string; text: string; headings: string[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

  const metaParts: string[] = [];
  for (const m of html.matchAll(
    /<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|keywords)["'][^>]+content=["']([^"']+)["']/gi,
  )) {
    metaParts.push(m[1]);
  }

  const stripped = html.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const headings: string[] = [];
  for (const m of stripped.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)) {
    const h = m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    if (h.length >= 4 && h.length <= 80 && !headings.includes(h)) {
      headings.push(h);
      if (headings.length >= 12) break;
    }
  }
  const visible = stripped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { title, text: [title, ...metaParts, visible].filter(Boolean).join(" "), headings };
}

export interface CrawlOptions {
  fallbackText?: string;
  workbookUrls?: string[];
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
  const cacheKey = `${normalizedUrl.toLowerCase()}|${fallbackText.toLowerCase()}`;
  const cached = crawlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CRAWL_CACHE_TTL_MS) {
    return cached.result;
  }

  const warnings: string[] = [];
  let pageTitle = "";
  let plainText = "";
  let blocked = false;
  const crawledUrls: string[] = [];
  const pageTopics: string[] = [];

  let sitemapCount = 0;
  try {
    const [sm, res] = await Promise.all([
      fetchAndParseSitemaps(normalizedUrl),
      fetch(normalizedUrl, {
        headers: { "User-Agent": "HiltonSEOStudioCrawler/1.0 (+https://hilton-seo-studio.vercel.app)" },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null),
    ]);
    sitemapCount = sm.sitemapUrls.length;
    if (!res || !res.ok) {
      blocked = true;
      warnings.push(res ? `Site returned HTTP ${res.status} — using defaults.` : `Could not reach ${normalizedUrl}.`);
    } else {
      const html = await res.text();
      const ext = extractHtmlCrawlText(html);
      pageTitle = ext.title;
      plainText = ext.text;
      pageTopics.push(...ext.headings);
      crawledUrls.push(res.url || normalizedUrl);
    }
  } catch (e) {
    blocked = true;
    warnings.push((e as Error).message);
  }

  const slugServices = detectServicesInText(`${normalizedUrl} ${fallbackText} ${pageTitle}`);
  const bodyServices = detectServicesInText(plainText);
  const combined = new Set<string>(slugServices);
  for (const s of bodyServices) {
    if (!STRUCTURAL_ONLY_SERVICES.has(s)) combined.add(s);
  }
  const services = [...combined].sort();

  const result: CrawlResult = {
    targetUrl: normalizedUrl,
    pageTitle,
    crawledPages: crawledUrls.length,
    crawledUrls,
    sitemapUrls: sitemapCount,
    services,
    serviceLabels: services.map((s) => SERVICE_LABELS[s] ?? s),
    pageTopics,
    plainText: plainText.slice(0, 60_000),
    blocked,
    warnings,
  };
  crawlCache.set(cacheKey, { timestamp: Date.now(), result });
  return result;
}

export const defaultCrawler: Crawler = {
  crawl: crawlTargetWebsite,
};

