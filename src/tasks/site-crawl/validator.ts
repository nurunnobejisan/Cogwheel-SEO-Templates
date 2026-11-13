import type { CrawlPageRecord, PageIssue, SiteCrawlSummary, SitemapStatusEntry } from "@/core/crawler";
import type { TaskRunFlag } from "@/core/runs";

export function evaluatePageIssues(page: Omit<CrawlPageRecord, "issues">): PageIssue[] {
  const issues: PageIssue[] = [];

  if (page.statusCode === 0 || page.statusCode >= 400) {
    issues.push({
      code: "broken-status",
      message: `HTTP ${page.statusCode || "ERR"} on ${page.url}`,
      severity: "error",
    });
    return issues;
  }

  if (page.redirectChain.length > 0) {
    issues.push({
      code: "redirect-chain",
      message: `${page.redirectChain.length} redirect(s) from ${page.url} to ${page.finalUrl}`,
      severity: "warning",
    });
  }

  if (page.needsJsRendering) {
    issues.push({
      code: "js-rendering-required",
      message: `Page appears to require JS rendering (${page.wordCount} words in raw HTML)`,
      severity: "warning",
    });
    return issues;
  }

  if (!page.title || !page.title.trim()) {
    issues.push({
      code: "missing-title",
      message: "Missing <title> tag",
      severity: "error",
    });
  }

  if (!page.metaDescription || !page.metaDescription.trim()) {
    issues.push({
      code: "missing-meta-description",
      message: "Missing meta description",
      severity: "warning",
    });
  }

  const h1Count = page.h1H6.filter((h) => h.level === 1).length;
  if (h1Count === 0) {
    issues.push({
      code: "missing-h1",
      message: "Missing H1 heading",
      severity: "warning",
    });
  } else if (h1Count > 1) {
    issues.push({
      code: "duplicate-h1",
      message: `Found ${h1Count} H1 headings (expected 1)`,
      severity: "error",
    });
  }

  const missingAltCount = page.images.filter((img) => img.alt === null || img.alt.trim() === "").length;
  if (missingAltCount > 0) {
    issues.push({
      code: "images-missing-alt",
      message: `${missingAltCount} image(s) missing alt text`,
      severity: "warning",
    });
  }

  return issues;
}

/**
 * Computes site-wide diagnostics across all crawled pages and the sitemap URL list.
 * - orphanPages: URLs in sitemap that received 0 internal links from other crawled pages
 * - missingFromSitemap: crawled 2xx pages not present in the sitemap
 */
export function computeSiteSummary(opts: {
  pages: CrawlPageRecord[];
  sitemapUrls: string[];
  sitemapStatuses: SitemapStatusEntry[];
  robotsTxtPresent: boolean;
  startUrl: string;
}): SiteCrawlSummary {
  const { pages, sitemapUrls, sitemapStatuses, robotsTxtPresent, startUrl } = opts;

  const inboundFrom = new Map<string, Set<string>>();
  for (const p of pages) {
    for (const target of p.internalLinks) {
      if (target === p.url) continue;
      let set = inboundFrom.get(target);
      if (!set) {
        set = new Set<string>();
        inboundFrom.set(target, set);
      }
      set.add(p.url);
    }
  }

  const brokenLinks = pages
    .filter((p) => p.statusCode === 0 || p.statusCode >= 400)
    .map((p) => ({
      url: p.url,
      statusCode: p.statusCode,
      foundOn: [...(inboundFrom.get(p.url) ?? [])],
    }));

  const redirectChains = pages
    .filter((p) => p.redirectChain.length > 0)
    .map((p) => ({
      url: p.url,
      finalUrl: p.finalUrl,
      hops: p.redirectChain,
    }));

  const sitemapSet = new Set(sitemapUrls);
  const startNorm = startUrl.replace(/\/$/, "");
  const orphanPages = sitemapUrls.filter((u) => {
    if (u.replace(/\/$/, "") === startNorm) return false;
    const inbound = inboundFrom.get(u);
    return !inbound || inbound.size === 0;
  });

  const missingFromSitemap =
    sitemapUrls.length > 0
      ? pages
          .filter((p) => p.statusCode >= 200 && p.statusCode < 300 && !sitemapSet.has(p.url))
          .map((p) => p.url)
      : [];

  const jsRenderedPages = pages.filter((p) => p.needsJsRendering).map((p) => p.url);

  const issueCounts: Record<string, number> = {};
  for (const p of pages) {
    for (const issue of p.issues) {
      issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
    }
  }

  return {
    sitemapUrls: sitemapStatuses,
    robotsTxtPresent,
    brokenLinks,
    redirectChains,
    orphanPages,
    missingFromSitemap,
    jsRenderedPages,
    issueCounts,
  };
}

export function summaryToTaskFlags(summary: SiteCrawlSummary): TaskRunFlag[] {
  const flags: TaskRunFlag[] = [];
  if (summary.brokenLinks.length > 0) {
    flags.push({
      code: "broken-links",
      message: `${summary.brokenLinks.length} broken link(s) (4xx/5xx) found`,
      severity: "error",
    });
  }
  if (summary.jsRenderedPages.length > 0) {
    flags.push({
      code: "js-rendering-required",
      message: `${summary.jsRenderedPages.length} page(s) require JS rendering`,
      severity: "warning",
    });
  }
  if (summary.orphanPages.length > 0) {
    flags.push({
      code: "orphan-pages",
      message: `${summary.orphanPages.length} orphan page(s) in sitemap with no internal links`,
      severity: "warning",
    });
  }
  if ((summary.issueCounts["missing-title"] ?? 0) > 0) {
    flags.push({
      code: "missing-title",
      message: `${summary.issueCounts["missing-title"]} page(s) missing <title>`,
      severity: "warning",
    });
  }
  if ((summary.issueCounts["duplicate-h1"] ?? 0) > 0) {
    flags.push({
      code: "duplicate-h1",
      message: `${summary.issueCounts["duplicate-h1"]} page(s) have multiple H1 tags`,
      severity: "warning",
    });
  }
  return flags;
}
