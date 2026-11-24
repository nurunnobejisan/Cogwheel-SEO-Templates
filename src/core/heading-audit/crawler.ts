import type {
  HeadingAuditOptions,
  HeadingAuditSummary,
  PageHeadingAudit,
} from "./types.ts";
import {
  analyzeAndOptimizeHeadings,
  classifyPageUrl,
  deriveTargetKeyword,
  type RawExtractedHeading,
} from "./analyzer.ts";

const CRAWLER_USER_AGENT =
  "Mozilla/5.0 (compatible; CogwheelHeadingAudit/2.8; +https://cogwheel-seo-templates.vercel.app)";

function normalizeUrl(raw: string, baseUrl?: string): string | null {
  try {
    let input = raw.trim();
    if (!input) return null;
    if (input.startsWith("//")) input = "https:" + input;
    const resolved = baseUrl ? new URL(input, baseUrl) : new URL(input);
    if (!["http:", "https:"].includes(resolved.protocol)) return null;

    // Strip tracking parameters
    const searchParams = new URLSearchParams(resolved.search);
    const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid"];
    let modified = false;
    for (const key of trackingKeys) {
      if (searchParams.has(key)) {
        searchParams.delete(key);
        modified = true;
      }
    }
    if (modified) {
      resolved.search = searchParams.toString() ? `?${searchParams.toString()}` : "";
    }
    resolved.hash = "";
    return resolved.href;
  } catch {
    return null;
  }
}

export function extractHeadingsFromHtml(htmlText: string): RawExtractedHeading[] {
  const headings: RawExtractedHeading[] = [];
  let position = 0;

  // Match <h1> to <h6> tags in document order
  const headingRegex = /<(h[1-6])\b[^>]*>(.*?)<\/\1>/gis;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(htmlText)) !== null) {
    position++;
    const tag = match[1].toUpperCase() as "H1" | "H2" | "H3" | "H4" | "H5" | "H6";
    const rawInner = match[2];
    // Strip nested tags, scripts, and normalize whitespace
    const cleanText = rawInner
      .replace(/<script\b[^>]*>.*?<\/script>/gis, "")
      .replace(/<style\b[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    headings.push({
      tag,
      text: cleanText,
      position,
    });
  }

  // Also check for prominent styled text headings (e.g. class="*section-title*" or class="*heading*") if few formal tags exist
  if (headings.length < 5) {
    const styledTextRegex = /<(?:div|span|p)\b[^>]*class=["'][^"']*(?:title|heading|caption)[^"']*["'][^>]*>(.*?)<\/(?:div|span|p)>/gis;
    while ((match = styledTextRegex.exec(htmlText)) !== null) {
      const rawInner = match[1];
      const cleanText = rawInner
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanText.length > 3 && cleanText.length < 75 && !headings.some((h) => h.text.toLowerCase() === cleanText.toLowerCase())) {
        position++;
        headings.push({
          tag: "TEXT",
          text: cleanText,
          position,
        });
      }
    }
  }

  return headings;
}

function extractLinksFromHtml(html: string, baseUrl: string, origin: string, allowSubdomains: boolean): string[] {
  const links = new Set<string>();
  const aRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = aRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
      continue;
    }
    const normalized = normalizeUrl(raw, baseUrl);
    if (!normalized) continue;

    try {
      const linkUrl = new URL(normalized);
      if (allowSubdomains) {
        const rootHost = new URL(origin).hostname.split(".").slice(-2).join(".");
        if (!linkUrl.hostname.endsWith(rootHost)) continue;
      } else {
        if (linkUrl.origin !== origin) continue;
      }

      // Ignore non-HTML document files
      if (/\.(pdf|zip|docx?|xlsx?|mp4|mp3|avi|mov|svg|webp|png|jpe?g|gif)$/i.test(linkUrl.pathname)) {
        continue;
      }

      links.add(normalized);
    } catch {
      // ignore
    }
  }

  return Array.from(links);
}

function extractPageTitle(html: string): string | null {
  const m = html.match(/<title\b[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

async function discoverSitemapUrls(origin: string, timeoutMs: number): Promise<string[]> {
  const pageUrls = new Set<string>();
  const candidateSitemaps = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap/sitemap.xml`,
  ];

  try {
    const robotsRes = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": CRAWLER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (robotsRes.ok) {
      const text = await robotsRes.text();
      const sitemapMatches = text.matchAll(/^Sitemap:\s*(https?:\/\/[^\s]+)/gim);
      for (const sm of sitemapMatches) {
        if (sm[1]) candidateSitemaps.unshift(sm[1].trim());
      }
    }
  } catch {
    // Continue
  }

  const visitedSitemaps = new Set<string>();

  async function parseSitemapXml(sitemapUrl: string) {
    if (visitedSitemaps.has(sitemapUrl) || visitedSitemaps.size > 20) return;
    visitedSitemaps.add(sitemapUrl);

    try {
      const res = await fetch(sitemapUrl, {
        headers: { "User-Agent": CRAWLER_USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return;

      const xml = await res.text();

      // Check for sitemap index
      const subSitemaps = [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
      for (const sub of subSitemaps) {
        await parseSitemapXml(sub);
      }

      // Page URLs
      const urlMatches = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
      for (const u of urlMatches) {
        const norm = normalizeUrl(u, origin);
        if (norm && norm.startsWith(origin)) {
          pageUrls.add(norm);
        }
      }
    } catch {
      // Continue
    }
  }

  for (const sm of candidateSitemaps) {
    if (pageUrls.size >= 1500) break;
    await parseSitemapXml(sm);
  }

  return Array.from(pageUrls);
}

export async function crawlWebsiteHeadings(
  startUrl: string,
  options: HeadingAuditOptions = { startUrl },
  onProgress?: (progress: { pagesScanned: number; totalInQueue: number; totalHeadings: number; currentUrl: string }) => void
): Promise<{
  summary: HeadingAuditSummary;
  pages: PageHeadingAudit[];
}> {
  const startTime = Date.now();
  const maxPages = options.maxPages ?? 60;
  const delayMs = options.delayMs ?? 100;
  const timeoutMs = options.timeoutMs ?? 10000;
  const includeSubdomains = Boolean(options.includeSubdomains);

  const validStart = normalizeUrl(startUrl);
  if (!validStart) {
    throw new Error(`Invalid target website URL: "${startUrl}". Must be a valid http/https address.`);
  }

  const origin = new URL(validStart).origin;
  const queue: string[] = [validStart];
  const visited = new Set<string>();
  const discoveredPages = new Set<string>([validStart]);

  const discoveryMethods: string[] = ["Internal HTML Link Crawler", "Document DOM Heading Parser"];

  // Sitemap Discovery
  let sitemapSuccess = false;
  let sitemapCount = 0;
  if (options.enableSitemaps !== false) {
    try {
      const smUrls = await discoverSitemapUrls(origin, timeoutMs);
      if (smUrls.length > 0) {
        sitemapSuccess = true;
        sitemapCount = smUrls.length;
        discoveryMethods.push("XML Sitemap & Index Parser");
        for (const u of smUrls) {
          discoveredPages.add(u);
          if (queue.length < maxPages * 3) {
            queue.push(u);
          }
        }
      }
    } catch {
      // Continue
    }
  }

  const pageAudits: PageHeadingAudit[] = [];
  const errors: string[] = [];
  let totalHeadingsAudited = 0;

  let stoppedReason = "Reached configured page limit";

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    onProgress?.({
      pagesScanned: visited.size,
      totalInQueue: queue.length + visited.size,
      totalHeadings: totalHeadingsAudited,
      currentUrl,
    });

    try {
      const pageRes = await fetch(currentUrl, {
        headers: {
          "User-Agent": CRAWLER_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!pageRes.ok) {
        errors.push(`${currentUrl} (HTTP ${pageRes.status})`);
        continue;
      }

      const contentType = pageRes.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        continue;
      }

      const html = await pageRes.text();
      const pageTitle = extractPageTitle(html) || currentUrl;

      // Extract raw headings
      const rawHeadings = extractHeadingsFromHtml(html);
      totalHeadingsAudited += rawHeadings.length;

      // Analyze and optimize headings
      const analysis = analyzeAndOptimizeHeadings(rawHeadings, currentUrl, pageTitle);
      const { category, subCategory } = classifyPageUrl(currentUrl);
      const targetKeyword = deriveTargetKeyword(currentUrl, pageTitle);

      pageAudits.push({
        pageUrl: currentUrl,
        pageTitle,
        pageStatus: pageRes.status,
        category,
        subCategory,
        targetKeyword,
        headings: analysis.headings,
        h1Count: analysis.h1Count,
        h2Count: analysis.h2Count,
        h3Count: analysis.h3Count,
        h4Count: analysis.h4Count,
        hasSkippedLevels: analysis.hasSkippedLevels,
        issues: analysis.issues,
        recommendationSummary: analysis.recommendationSummary,
      });

      // Find more links
      const pageLinks = extractLinksFromHtml(html, currentUrl, origin, includeSubdomains);
      for (const link of pageLinks) {
        discoveredPages.add(link);
        if (!visited.has(link) && !queue.includes(link) && queue.length < maxPages * 4) {
          queue.push(link);
        }
      }

      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${currentUrl} (${msg})`);
    }
  }

  if (queue.length === 0 && visited.size < maxPages) {
    stoppedReason = "Crawl completed (all discovered pages audited)";
  }

  // Summary Metrics
  let h1Total = 0;
  let h2Total = 0;
  let h3Total = 0;
  let h4H6Total = 0;
  let missingH1Count = 0;
  let multipleH1Count = 0;
  let skippedLevelsCount = 0;
  let emptyHeadingsCount = 0;

  for (const page of pageAudits) {
    h1Total += page.h1Count;
    h2Total += page.h2Count;
    h3Total += page.h3Count;
    h4H6Total += page.h4Count;
    if (page.h1Count === 0) missingH1Count++;
    if (page.h1Count > 1) multipleH1Count++;
    if (page.hasSkippedLevels) skippedLevelsCount++;

    for (const h of page.headings) {
      if (h.issues.some((i) => i.type === "empty-heading")) {
        emptyHeadingsCount++;
      }
    }
  }

  const topFindings: string[] = [];
  if (missingH1Count > 0) {
    topFindings.push(`${missingH1Count} pages are missing a formal <h1> element.`);
  }
  if (multipleH1Count > 0) {
    topFindings.push(`${multipleH1Count} pages have multiple <h1> tags, diluting primary topical focus.`);
  }
  if (skippedLevelsCount > 0) {
    topFindings.push(`${skippedLevelsCount} pages skip heading levels (e.g. jumping from H1 directly to H3).`);
  }
  if (emptyHeadingsCount > 0) {
    topFindings.push(`${emptyHeadingsCount} empty heading tags were detected.`);
  }
  if (topFindings.length === 0) {
    topFindings.push("All audited pages exhibit clean, logical, and accessible heading structures.");
  }

  const summary: HeadingAuditSummary = {
    websiteUrl: validStart,
    origin,
    auditedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    maxPagesLimit: maxPages,
    pagesDiscovered: discoveredPages.size,
    pagesScanned: visited.size,
    pagesFailed: errors.length,
    totalPagesAudited: pageAudits.length,
    totalHeadingsAudited,
    h1TotalCount: h1Total,
    h2TotalCount: h2Total,
    h3TotalCount: h3Total,
    h4H6TotalCount: h4H6Total,
    pagesMissingH1Count: missingH1Count,
    pagesMultipleH1Count: multipleH1Count,
    pagesWithSkippedLevelsCount: skippedLevelsCount,
    emptyHeadingsCount,
    discoveryMethods,
    sitemapDiscoverySucceeded: sitemapSuccess,
    sitemapUrlsFound: sitemapCount,
    jsRenderingInspected: false,
    crawlCompleted: queue.length === 0 && visited.size < maxPages,
    stoppedReason,
    coverageStatement: `Audit complete across ${visited.size} public HTML pages discovered via sitemaps and internal link exploration under configured limits.`,
    skippedAreas: [],
    unresolvedErrors: errors,
    topFindings,
  };

  return {
    summary,
    pages: pageAudits,
  };
}
