import { CRAWLER_USER_AGENT } from "./robots";
import type { SitemapStatusEntry } from "./types";
import { normalizeCrawlUrl } from "./url";

export function parseSitemapXml(xmlText: string): { isIndex: boolean; locs: string[] } {
  if (!xmlText) return { isIndex: false, locs: [] };
  const isIndex = /<sitemapindex\b/i.test(xmlText);
  const locs = [...xmlText.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  return { isIndex, locs };
}

async function fetchXml(url: string, timeoutMs = 5000): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": CRAWLER_USER_AGENT, Accept: "application/xml,text/xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = res.ok ? await res.text() : "";
    return { status: res.status, text };
  } catch {
    return { status: 0, text: "" };
  }
}

/**
 * Discovers and parses sitemap.xml / sitemap_index.xml (plus any Sitemaps declared in robots.txt).
 */
export async function fetchAndParseSitemaps(
  startUrl: string,
  robotsSitemaps: string[] = [],
): Promise<{ sitemapUrls: string[]; sitemapStatuses: SitemapStatusEntry[] }> {
  let origin: string;
  try {
    origin = new URL(startUrl).origin;
  } catch {
    return { sitemapUrls: [], sitemapStatuses: [] };
  }

  const candidates = new Set<string>([
    ...robotsSitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ]);

  const discoveredPages: string[] = [];
  const seenPages = new Set<string>();
  const childSitemaps: string[] = [];
  const sitemapStatuses: SitemapStatusEntry[] = [];

  for (const smUrl of candidates) {
    const { status, text } = await fetchXml(smUrl);
    if (!text) {
      if (robotsSitemaps.includes(smUrl) || smUrl.endsWith("/sitemap.xml")) {
        sitemapStatuses.push({ url: smUrl, status, urlCount: 0 });
      }
      continue;
    }

    const parsed = parseSitemapXml(text);
    sitemapStatuses.push({ url: smUrl, status, urlCount: parsed.locs.length });

    if (parsed.isIndex) {
      for (const loc of parsed.locs) {
        if (!childSitemaps.includes(loc)) childSitemaps.push(loc);
      }
    } else {
      for (const loc of parsed.locs) {
        const norm = normalizeCrawlUrl(loc, startUrl, true);
        if (norm && !seenPages.has(norm)) {
          seenPages.add(norm);
          discoveredPages.push(norm);
        }
      }
      break; // primary sitemap found
    }
  }

  for (const childUrl of childSitemaps.slice(0, 12)) {
    const { status, text } = await fetchXml(childUrl);
    const parsed = parseSitemapXml(text);
    sitemapStatuses.push({ url: childUrl, status, urlCount: parsed.locs.length });
    for (const loc of parsed.locs) {
      const norm = normalizeCrawlUrl(loc, startUrl, true);
      if (norm && !seenPages.has(norm)) {
        seenPages.add(norm);
        discoveredPages.push(norm);
      }
    }
  }

  return { sitemapUrls: discoveredPages, sitemapStatuses };
}
