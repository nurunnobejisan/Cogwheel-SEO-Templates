export interface RedirectHop {
  url: string;
  statusCode: number;
}

export interface HeadingEntry {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ImageAsset {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
}

export interface HreflangEntry {
  lang: string;
  href: string;
}

export interface PageIssue {
  code:
    | "missing-title"
    | "duplicate-h1"
    | "missing-h1"
    | "missing-meta-description"
    | "images-missing-alt"
    | "broken-status"
    | "redirect-chain"
    | "js-rendering-required";
  message: string;
  severity: "warning" | "error";
}

export interface CrawlPageRecord {
  crawlRunId: string;
  url: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectHop[];
  canonical: string | null;
  robotsMeta: string | null;
  title: string | null;
  metaDescription: string | null;
  h1H6: HeadingEntry[];
  wordCount: number;
  contentHash: string;
  images: ImageAsset[];
  internalLinks: string[];
  externalLinks: string[];
  hreflang: HreflangEntry[];
  jsonLd: string[];
  openGraph: Record<string, string>;
  responseTimeMs: number;
  depth: number;
  inSitemap: boolean;
  needsJsRendering: boolean;
  issues: PageIssue[];
  crawledAt: string;
}

export interface RobotsRuleSet {
  allow: string[];
  disallow: string[];
  sitemaps: string[];
  raw: string;
}

export interface SitemapStatusEntry {
  url: string;
  status: number;
  urlCount: number;
}

export interface QueueItem {
  url: string;
  depth: number;
}

export interface CrawlQueueState {
  frontier: QueueItem[];
  visited: string[];
  sitemapUrls: string[];
  sitemapStatuses: SitemapStatusEntry[];
  robots: RobotsRuleSet;
}

export interface SiteCrawlSummary {
  sitemapUrls: SitemapStatusEntry[];
  robotsTxtPresent: boolean;
  brokenLinks: Array<{ url: string; statusCode: number; foundOn: string[] }>;
  redirectChains: Array<{ url: string; finalUrl: string; hops: RedirectHop[] }>;
  orphanPages: string[];
  missingFromSitemap: string[];
  jsRenderedPages: string[];
  issueCounts: Record<string, number>;
}

export type CrawlRunStatus = "pending" | "running" | "completed" | "failed";

export interface CrawlRunRecord {
  id: string;
  propertyId: string | null;
  taskRunId: string | null;
  startUrl: string;
  maxPages: number;
  crawlDepth: number;
  includePatterns: string[];
  excludePatterns: string[];
  startedAt: string;
  finishedAt: string | null;
  pagesDiscovered: number;
  pagesCrawled: number;
  status: CrawlRunStatus;
  queueState: CrawlQueueState;
  siteSummary: SiteCrawlSummary;
}

