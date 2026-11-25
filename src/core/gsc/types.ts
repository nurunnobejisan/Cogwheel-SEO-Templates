export interface GscSite {
  siteUrl: string;
  permissionLevel: "siteOwner" | "siteFullUser" | "siteRestrictedUser" | "siteUnverifiedUser";
}

export interface GscSearchAnalyticsQuery {
  siteUrl: string;
  startDate?: string;
  endDate?: string;
  dimensions?: Array<"query" | "page" | "device" | "country" | "date">;
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: Array<{
    groupType?: string;
    filters?: Array<{
      dimension: "query" | "page" | "device" | "country";
      operator: "contains" | "equals" | "notEquals" | "notContains" | "includingRegex" | "excludingRegex";
      expression: string;
    }>;
  }>;
}

export interface GscSearchRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceOverview {
  siteUrl: string;
  periodDays: number;
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
  deviceBreakdown: Record<string, { clicks: number; impressions: number }>;
  countryBreakdown: Record<string, { clicks: number; impressions: number }>;
}

export interface GscPeriodComparison {
  siteUrl: string;
  currentPeriod: { startDate: string; endDate: string; clicks: number; impressions: number; ctr: number; position: number };
  previousPeriod: { startDate: string; endDate: string; clicks: number; impressions: number; ctr: number; position: number };
  deltas: {
    clicks: number;
    clicksPercent: number;
    impressions: number;
    impressionsPercent: number;
    ctrDelta: number;
    positionDelta: number;
  };
  gainingQueries: Array<{ query: string; clicksDelta: number; currentPosition: number }>;
  decliningQueries: Array<{ query: string; clicksDelta: number; currentPosition: number }>;
}

export interface GscCannibalizationIssue {
  query: string;
  competingPages: Array<{
    pageUrl: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  severity: "high" | "medium" | "low";
  recommendation: string;
}

export interface GscUrlInspectionResult {
  inspectionUrl: string;
  indexStatusResult: {
    verdict: "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL";
    coverageState: string;
    crawledAs?: string;
    googleCanonical: string;
    userCanonical: string;
    indexingState:
      | "INDEXING_ALLOWED"
      | "BLOCKED_BY_META_TAG"
      | "BLOCKED_BY_ROBOTS_TXT"
      | "NOT_INDEXED"
      | "INDEXING_STATE_UNSPECIFIED";
    lastCrawlTime?: string;
    pageFetchState?: string;
    robotsTxtState?: string;
  };
  mobileUsabilityResult?: {
    verdict: "PASS" | "FAIL" | "NEUTRAL";
    issues?: string[];
  };
  richResultsResult?: {
    verdict: "PASS" | "FAIL" | "NEUTRAL";
    detectedItems?: string[];
  };
}

export interface GscSitemapInfo {
  path: string;
  lastSubmitted: string;
  lastDownloaded?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  type: string;
  warningsCount: number;
  errorsCount: number;
  contents?: Array<{
    type: string;
    submitted: number;
    indexed: number;
  }>;
}
