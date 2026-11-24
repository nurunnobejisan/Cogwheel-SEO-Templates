export type HeadingLevelTag = "H1" | "H2" | "H3" | "H4" | "H5" | "H6" | "TEXT";

export type HeadingIssueType =
  | "missing-h1"
  | "multiple-h1"
  | "skipped-level"
  | "inverted-hierarchy"
  | "empty-heading"
  | "template-placeholder"
  | "generic-label"
  | "all-caps-shouting"
  | "excessive-length";

export interface HeadingItem {
  id: string;
  tag: HeadingLevelTag;
  originalText: string;
  optimizedText: string;
  optimizedLevel: HeadingLevelTag;
  position: number;
  issues: {
    type: HeadingIssueType;
    label: string;
    description: string;
    severity: "high" | "medium" | "low" | "info";
  }[];
  isDecorativeOrWidget: boolean;
}

export interface PageHeadingAudit {
  pageUrl: string;
  pageTitle: string;
  pageStatus: number;
  category: string;
  subCategory: string;
  targetKeyword: string;
  headings: HeadingItem[];
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  missingH1?: boolean;
  multipleH1?: boolean;
  hasSkippedLevels: boolean;
  issues: string[];
  recommendationSummary: string;
}

export interface HeadingAuditSummary {
  websiteUrl: string;
  origin: string;
  auditedAt: string;
  durationMs: number;
  maxPagesLimit: number;
  pagesDiscovered: number;
  pagesScanned: number;
  pagesFailed: number;
  totalPagesAudited: number;
  totalHeadingsAudited: number;
  h1TotalCount: number;
  h2TotalCount: number;
  h3TotalCount: number;
  h4H6TotalCount: number;
  pagesMissingH1Count: number;
  pagesMultipleH1Count: number;
  pagesWithSkippedLevelsCount: number;
  emptyHeadingsCount: number;
  discoveryMethods: string[];
  sitemapDiscoverySucceeded: boolean;
  sitemapUrlsFound: number;
  jsRenderingInspected: boolean;
  crawlCompleted: boolean;
  stoppedReason: string;
  coverageStatement: string;
  skippedAreas: string[];
  unresolvedErrors: string[];
  topFindings: string[];
}

export interface HeadingAuditOptions {
  startUrl?: string;
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  includeSubdomains?: boolean;
  enableSitemaps?: boolean;
  saveToGoogleSheets?: boolean;
  sheetTitle?: string;
  checkpointKey?: string;
  resume?: boolean;
}

export interface HeadingAuditResult {
  summary: HeadingAuditSummary;
  pages: PageHeadingAudit[];
  xlsxBase64: string;
  filename: string;
  googleSheetUrl?: string | null;
}
