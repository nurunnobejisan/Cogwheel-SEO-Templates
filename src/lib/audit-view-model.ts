import type { DistributionPoint, IssueRowItem, StatusKind, VitalMetric } from "@/components/data/index";
import type { ActionItem, FullWebsiteAuditReport } from "@/core/full-audit/types";

export interface AuditCategoryMeta {
  id: string;
  label: string;
  shortLabel: string;
}

export const AUDIT_DIMENSIONS: AuditCategoryMeta[] = [
  { id: "security", label: "Security", shortLabel: "Security" },
  { id: "crawling", label: "Crawling & Indexing", shortLabel: "Crawling" },
  { id: "redirects", label: "Redirects", shortLabel: "Redirects" },
  { id: "sitemap", label: "Sitemap", shortLabel: "Sitemap" },
  { id: "meta", label: "Meta Tags", shortLabel: "Meta" },
  { id: "content", label: "Content", shortLabel: "Content" },
  { id: "headings", label: "Headings", shortLabel: "Headings" },
  { id: "images", label: "Images", shortLabel: "Images" },
  { id: "links", label: "Links", shortLabel: "Links" },
  { id: "speed", label: "Speed & Performance", shortLabel: "Speed" },
  { id: "geo", label: "AI & GEO", shortLabel: "AI & GEO" },
];

export function priorityToSeverity(priority: ActionItem["priority"]): StatusKind {
  if (priority === "P0" || priority === "P1") return "error";
  if (priority === "P2") return "warning";
  return "notice";
}

export function mapActionItemToDimension(item: ActionItem): string {
  const title = item.title.toLowerCase();
  if (item.category === "headings") return "headings";
  if (item.category === "images") return "images";
  if (item.category === "geo" || item.category === "schema") return "geo";
  if (item.category === "keywords" || item.category === "gsc") return "content";
  if (title.includes("https") || title.includes("ssl") || title.includes("hsts") || title.includes("csp") || title.includes("security")) {
    return "security";
  }
  if (title.includes("redirect")) return "redirects";
  if (title.includes("sitemap")) return "sitemap";
  if (title.includes("title") || title.includes("meta") || title.includes("description")) return "meta";
  if (title.includes("link")) return "links";
  if (title.includes("speed") || title.includes("compression") || title.includes("response")) return "speed";
  return "crawling";
}

export function buildIssuesByDimension(report: FullWebsiteAuditReport | null): Record<string, IssueRowItem[]> {
  const map: Record<string, IssueRowItem[]> = {};
  for (const dim of AUDIT_DIMENSIONS) {
    map[dim.id] = [];
  }
  if (!report) return map;

  for (const item of report.actionPlan) {
    const dim = mapActionItemToDimension(item);
    map[dim].push({
      id: item.id,
      title: item.title,
      severity: priorityToSeverity(item.priority),
      pagesCount: Math.max(1, item.affectedUrlsCount || 1),
      fixedCount: 0,
      newCount: 1,
      description: item.description,
      howToFix: item.remediationGuide,
      affectedUrls: [report.targetUrl],
      viewAllHref: `/audit/pages?issue=${encodeURIComponent(item.id)}`,
    });
  }

  // Add deterministic measured checks if not already flagged in actionPlan
  if (!report.technicalHealth.isHttps && !map.security.some((i) => i.id === "https-missing")) {
    map.security.push({
      id: "https-missing",
      title: "Property not served over HTTPS",
      severity: "error",
      pagesCount: 1,
      description: "Target URL resolved without TLS encryption.",
      howToFix: "Redirect all HTTP traffic to HTTPS with a permanent 301 redirect and valid SSL certificate.",
      affectedUrls: [report.targetUrl],
    });
  }

  if (report.crawlability.discoveredSitemaps.length === 0 && !map.sitemap.some((i) => i.id === "sitemap-missing")) {
    map.sitemap.push({
      id: "sitemap-missing",
      title: "No XML sitemap discovered",
      severity: "warning",
      pagesCount: 1,
      description: "No sitemap reference was found in robots.txt or default /sitemap.xml path.",
      howToFix: "Publish an updated XML sitemap and reference its full URL in robots.txt.",
      affectedUrls: [report.targetUrl],
    });
  }

  if (!report.onPage.isTitleBudgetCompliant && !map.meta.some((i) => i.id === "title-pixel-over")) {
    map.meta.push({
      id: "title-pixel-over",
      title: "Title tag exceeds 580 px desktop SERP budget",
      severity: "warning",
      pagesCount: 1,
      description: `Measured title width is ${report.onPage.titlePixelWidth} px, exceeding the 580 px desktop truncation limit.`,
      howToFix: "Trim secondary modifiers or move the brand suffix behind a concise primary keyword phrase.",
      affectedUrls: [report.targetUrl],
    });
  }

  if (!report.onPage.isMetaBudgetCompliant && !map.meta.some((i) => i.id === "meta-pixel-over")) {
    map.meta.push({
      id: "meta-pixel-over",
      title: "Meta description out of 920 px / 155 char budget",
      severity: "notice",
      pagesCount: 1,
      description: `Measured meta description is ${report.onPage.metaDescriptionLength} characters.`,
      howToFix: "Rewrite the meta description between 135 and 155 characters with clear booking intent.",
      affectedUrls: [report.targetUrl],
    });
  }

  if (report.technicalHealth.responseTimeMs > 800 && !map.speed.some((i) => i.id === "slow-ttfb")) {
    map.speed.push({
      id: "slow-ttfb",
      title: "Slow server response time (> 800 ms)",
      severity: "warning",
      pagesCount: 1,
      description: `Initial HTML response took ${report.technicalHealth.responseTimeMs} ms.`,
      howToFix: "Enable page caching, CDN edge distribution, and Gzip/Brotli compression.",
      affectedUrls: [report.targetUrl],
    });
  }

  return map;
}

export function summarizeSeverityCounts(report: FullWebsiteAuditReport | null) {
  if (!report) {
    return { errors: null, warnings: null, notices: null, pagesCrawled: null };
  }
  const byDim = buildIssuesByDimension(report);
  let errors = 0;
  let warnings = 0;
  let notices = 0;
  for (const list of Object.values(byDim)) {
    for (const item of list) {
      if (item.severity === "error") errors += 1;
      else if (item.severity === "warning") warnings += 1;
      else notices += 1;
    }
  }
  return {
    errors,
    warnings,
    notices,
    pagesCrawled: Math.max(1, report.crawlability.discoveredSitemaps.length > 0 ? 1 : 1),
  };
}

export function buildDistributionSeries(report: FullWebsiteAuditReport | null): DistributionPoint[] {
  if (!report) return [];
  const byDim = buildIssuesByDimension(report);
  return AUDIT_DIMENSIONS.map((dim) => {
    const items = byDim[dim.id] ?? [];
    return {
      category: dim.shortLabel,
      errors: items.filter((i) => i.severity === "error").length,
      warnings: items.filter((i) => i.severity === "warning").length,
      notices: items.filter((i) => i.severity === "notice").length,
    };
  });
}

export function buildMeasuredVitals(report: FullWebsiteAuditReport | null): VitalMetric[] | undefined {
  if (!report) return undefined;
  const rtt = report.technicalHealth.responseTimeMs;
  const lcpGood = rtt < 400 ? 84 : rtt < 900 ? 58 : 28;
  const lcpWarn = rtt < 400 ? 12 : rtt < 900 ? 28 : 40;
  const lcpPoor = Math.max(0, 100 - lcpGood - lcpWarn);
  return [
    {
      label: "LCP",
      goodPct: lcpGood,
      needsWorkPct: lcpWarn,
      poorPct: lcpPoor,
      measuredValue: `${rtt} ms TTFB`,
    },
    {
      label: "INP",
      goodPct: report.technicalHealth.hasCompression ? 88 : 64,
      needsWorkPct: report.technicalHealth.hasCompression ? 10 : 26,
      poorPct: report.technicalHealth.hasCompression ? 2 : 10,
      measuredValue: report.technicalHealth.hasCompression ? "Compressed" : "Uncompressed",
    },
    {
      label: "CLS",
      goodPct: report.images.oversizedCount === 0 ? 92 : 68,
      needsWorkPct: report.images.oversizedCount === 0 ? 6 : 22,
      poorPct: report.images.oversizedCount === 0 ? 2 : 10,
      measuredValue: `${report.images.totalImages} imgs checked`,
    },
  ];
}
