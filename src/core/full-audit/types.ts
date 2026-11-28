/**
 * Unified SEO Platform - Full Website Audit Types
 *
 * Combines 11 comprehensive SEO audit dimensions:
 * 1. Executive Summary & Scores
 * 2. Technical Health & Security
 * 3. Crawlability & Indexability
 * 4. On-Page SEO & Content Quality
 * 5. Heading Structure (H1-H6)
 * 6. Image Optimization & Previews
 * 7. Google Search Console & Cannibalization
 * 8. Keyword Intelligence & Competitor Content Gaps
 * 9. Schema.org Structured Data
 * 10. AI Visibility & GEO Citations
 * 11. Prioritized Action Plan (P0-P3)
 */

import type { GeoAuditReport } from "../../../rules/geo/types.ts";

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export interface ActionItem {
  id: string;
  priority: "P0" | "P1" | "P2" | "P3";
  category: "technical" | "headings" | "images" | "gsc" | "keywords" | "schema" | "geo";
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  affectedUrlsCount: number;
  remediationGuide: string;
}

export interface TechnicalHealth {
  statusCode: number;
  isHttps: boolean;
  sslValid: boolean;
  responseTimeMs: number;
  server: string;
  hasCompression: boolean; // Gzip or Brotli
  securityHeaders: {
    hasHsts: boolean;
    hasCsp: boolean;
    hasXFrameOptions: boolean;
    hasXContentTypeOptions: boolean;
  };
}

export interface CrawlabilityIndexability {
  hasRobotsTxt: boolean;
  robotsTxtUrl: string;
  isIndexable: boolean;
  hasNoindex: boolean;
  hasNofollow: boolean;
  canonicalUrl: string | null;
  isCanonicalSelfReferencing: boolean;
  discoveredSitemaps: string[];
  totalInternalLinksDiscovered: number;
  totalExternalLinksDiscovered: number;
}

export interface OnPageSummary {
  title: string;
  titleLength: number;
  titlePixelWidth: number;
  isTitleBudgetCompliant: boolean;
  metaDescription: string;
  metaDescriptionLength: number;
  isMetaBudgetCompliant: boolean;
  wordCount: number;
  readingTimeMinutes: number;
  primaryLanguage: string;
  hasViewportTag: boolean;
}

export interface HeadingAuditSummary {
  totalHeadings: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  h5Count: number;
  h6Count: number;
  hierarchyValid: boolean;
  issuesCount: number;
  sampleH1: string;
}

export interface ImageAuditSummary {
  totalImages: number;
  missingAltCount: number;
  oversizedCount: number;
  legacyFormatCount: number;
  lazyLoadedCount: number;
  optimizationOpportunityBytes: number;
}

export interface GscPerformanceSummary {
  isConnected: boolean;
  siteUrl: string;
  periodDays: number;
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  cannibalizationDetectedCount: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export interface KeywordContentGapSummary {
  totalTargetKeywords: number;
  top10KeywordsCount: number;
  top3KeywordsCount: number;
  averageKeywordDifficulty: number;
  contentGapsIdentified: number;
  topOpportunities: Array<{
    keyword: string;
    searchVolume: number;
    difficulty: number;
    cpc: number;
    intent: string;
    opportunityScore: number;
  }>;
}

export interface SchemaValidationSummary {
  schemasDetected: string[];
  isValidJsonLd: boolean;
  validationErrorsCount: number;
  missingRecommendedSchemas: string[];
  richSnippetEligible: boolean;
}

export interface AiGeoVisibilitySummary {
  visibilityScore: number; // 0 - 100
  brandEntityClarity: number; // 0 - 100
  factDensityScore: number; // 0 - 100
  /** True only when AI-engine citations were actually queried. */
  dataAvailable: boolean;
  /** How the scores were produced (measured vs heuristic estimate). */
  methodology: string;
  engineBreakdown: Record<string, number>;
  estimatedCitationsAcrossEngines: {
    googleAiOverviews: number;
    perplexity: number;
    chatgptSearch: number;
    claude: number;
  };
  keyEntityStrengths: string[];
  recommendations: string[];
}

/**
 * Provenance of each report section. Lets the UI distinguish fields measured
 * from the live page, values produced by a heuristic estimate, and dimensions
 * that require a data source which is not connected (and so are not shown as
 * real numbers).
 */
export interface DataProvenanceReport {
  /** Report sections derived from a live fetch + parse of the target page. */
  measured: string[];
  /** Sections produced by a documented heuristic, not by measurement. */
  estimated: string[];
  /** Sections that require a connection/credentials that are absent. */
  unavailable: string[];
  /** True only when ALLOW_SIMULATED_DATA enabled synthetic demo data. */
  simulated: boolean;
  /** Human-readable notes, e.g. which env vars unlock a section. */
  notes: string[];
}

export interface AlgorithmImpactSummary {
  potentiallyImpactedByRecentUpdates: boolean;
  recentRelevantUpdates: Array<{
    name: string;
    date: string;
    kind: string;
    notes: string;
  }>;
  riskRating: "low" | "medium" | "high";
}

export interface FullWebsiteAuditReport {
  id: string;
  targetUrl: string;
  domain: string;
  createdAt: string;
  durationMs: number;
  overallScore: number; // 0 - 100
  scores: {
    technical: number;
    onPage: number;
    headings: number;
    images: number;
    schema: number;
    gsc: number;
    aiVisibility: number;
  };
  technicalHealth: TechnicalHealth;
  crawlability: CrawlabilityIndexability;
  onPage: OnPageSummary;
  headings: HeadingAuditSummary;
  images: ImageAuditSummary;
  searchConsole: GscPerformanceSummary;
  keywordsAndGaps: KeywordContentGapSummary;
  schemaValidation: SchemaValidationSummary;
  aiGeoVisibility: AiGeoVisibilitySummary;
  /** Deterministic llms.txt / AI-crawler / citability / drift checks (null when GEO is disabled). */
  geoAudit?: GeoAuditReport | null;
  algorithmImpact: AlgorithmImpactSummary;
  actionPlan: ActionItem[];
  /** Where each section's data came from (measured / estimated / unavailable). */
  dataProvenance: DataProvenanceReport;
}
