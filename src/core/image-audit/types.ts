export type ImageIssueCode =
  | "missing-alt"
  | "empty-alt-suspicious"
  | "oversized-file"
  | "legacy-format"
  | "missing-dimensions"
  | "broken-image"
  | "duplicate-asset"
  | "above-fold-lazy";

export interface ImageAuditItem {
  id: string;
  imageUrl: string;
  pageUrl: string;
  pageTitle: string;
  pageStatus: number;
  currentAlt: string | null;
  proposedAlt: string;
  isDecorative: boolean;
  htmlWidth: number | null;
  htmlHeight: number | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  fileSizeBytes: number | null;
  fileSizeKb: number | null;
  format: string;
  mimeType: string;
  elementType: "img" | "picture" | "source" | "data-lazy" | "css-background";
  sourceAttribute: string;
  srcsetCandidates?: string[];
  loadingAttribute: "lazy" | "eager" | "auto" | "unspecified";
  httpStatus: number;
  isBroken: boolean;
  occurrenceCount: number;
  issues: {
    code: ImageIssueCode;
    label: string;
    description: string;
    severity: "high" | "medium" | "low" | "info";
  }[];
  recommendation: string;
  priority: "High" | "Medium" | "Low" | "Good";
}

export interface ImageAuditSummary {
  websiteUrl: string;
  origin: string;
  crawledAt: string;
  durationMs: number;
  maxPagesLimit: number;
  pagesScanned: number;
  pagesFailed: number;
  totalImagesFound: number;
  uniqueImagesCount: number;
  brokenImagesCount: number;
  oversizedImagesCount: number; // > threshold
  missingAltCount: number;
  decorativeEmptyAltCount: number;
  missingDimensionsCount: number;
  legacyFormatCount: number; // JPEG/PNG/GIF that could be WebP/AVIF
  aboveFoldLazyCount: number;
  formatBreakdown: Record<string, number>;
  topFindings: string[];
}

export interface CrawlLogEntry {
  url: string;
  statusCode: number;
  title: string | null;
  responseTimeMs: number;
  imagesFound: number;
  status: "success" | "redirect" | "error" | "skipped";
  notes?: string;
}

export interface ImageAuditOptions {
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  includeSubdomains?: boolean;
  sizeThresholdKb?: number;
  saveToGoogleSheets?: boolean;
  sheetTitle?: string;
}

export interface ImageAuditResult {
  summary: ImageAuditSummary;
  items: ImageAuditItem[];
  crawlLog: CrawlLogEntry[];
  xlsxBase64: string;
  filename: string;
  googleSheetUrl?: string | null;
}
