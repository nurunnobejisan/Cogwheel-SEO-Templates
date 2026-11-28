/**
 * Validation for audit reports submitted to the export endpoint.
 *
 * The browser already holds the report it rendered, so exports render that exact
 * payload instead of re-crawling the site. Validation keeps malformed or
 * unexpected JSON out of the report writers.
 */

import { z } from "zod";

const priority = z.enum(["P0", "P1", "P2", "P3"]);
const effort = z.enum(["low", "medium", "high"]);

const actionItem = z.object({
  id: z.string(),
  priority,
  category: z.enum(["technical", "headings", "images", "gsc", "keywords", "schema", "geo"]),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  effort,
  affectedUrlsCount: z.number(),
  remediationGuide: z.string(),
});

const technicalHealth = z.object({
  statusCode: z.number(),
  isHttps: z.boolean(),
  sslValid: z.boolean(),
  responseTimeMs: z.number(),
  server: z.string(),
  hasCompression: z.boolean(),
  securityHeaders: z.object({
    hasHsts: z.boolean(),
    hasCsp: z.boolean(),
    hasXFrameOptions: z.boolean(),
    hasXContentTypeOptions: z.boolean(),
  }),
});

const crawlability = z.object({
  hasRobotsTxt: z.boolean(),
  robotsTxtUrl: z.string(),
  isIndexable: z.boolean(),
  hasNoindex: z.boolean(),
  hasNofollow: z.boolean(),
  canonicalUrl: z.string().nullable(),
  isCanonicalSelfReferencing: z.boolean(),
  discoveredSitemaps: z.array(z.string()),
  totalInternalLinksDiscovered: z.number(),
  totalExternalLinksDiscovered: z.number(),
});

const onPage = z.object({
  title: z.string(),
  titleLength: z.number(),
  titlePixelWidth: z.number(),
  isTitleBudgetCompliant: z.boolean(),
  metaDescription: z.string(),
  metaDescriptionLength: z.number(),
  isMetaBudgetCompliant: z.boolean(),
  wordCount: z.number(),
  readingTimeMinutes: z.number(),
  primaryLanguage: z.string(),
  hasViewportTag: z.boolean(),
});

const headings = z.object({
  totalHeadings: z.number(),
  h1Count: z.number(),
  h2Count: z.number(),
  h3Count: z.number(),
  h4Count: z.number(),
  h5Count: z.number(),
  h6Count: z.number(),
  hierarchyValid: z.boolean(),
  issuesCount: z.number(),
  sampleH1: z.string(),
});

const images = z.object({
  totalImages: z.number(),
  missingAltCount: z.number(),
  oversizedCount: z.number(),
  legacyFormatCount: z.number(),
  lazyLoadedCount: z.number(),
  optimizationOpportunityBytes: z.number(),
});

const searchConsole = z.object({
  isConnected: z.boolean(),
  siteUrl: z.string(),
  periodDays: z.number(),
  totalClicks: z.number(),
  totalImpressions: z.number(),
  averageCtr: z.number(),
  averagePosition: z.number(),
  cannibalizationDetectedCount: z.number(),
  source: z.enum(["google-api", "csv-upload"]).optional(),
  window: z
    .object({
      startDate: z.string(),
      endDate: z.string(),
      previousStartDate: z.string(),
      previousEndDate: z.string(),
    })
    .optional(),
  cannibalizationDetails: z
    .array(
      z.object({
        query: z.string(),
        competingPages: z.array(
          z.object({
            pageUrl: z.string(),
            clicks: z.number(),
            impressions: z.number(),
            ctr: z.number(),
            position: z.number(),
          })
        ),
        severity: z.enum(["high", "medium", "low"]),
        recommendation: z.string(),
        severityScore: z.number().optional(),
        preferredUrl: z.string().optional(),
        normalizedUrls: z.array(z.string()).optional(),
        topUrlClickShare: z.number().optional(),
        positionSpreadFactor: z.number().optional(),
      })
    )
    .optional(),
  notes: z.array(z.string()).optional(),
  topQueries: z.array(
    z.object({
      query: z.string(),
      clicks: z.number(),
      impressions: z.number(),
      ctr: z.number(),
      position: z.number(),
    }),
  ),
});

const keywords = z.object({
  totalTargetKeywords: z.number(),
  top10KeywordsCount: z.number(),
  top3KeywordsCount: z.number(),
  averageKeywordDifficulty: z.number(),
  contentGapsIdentified: z.number(),
  topOpportunities: z.array(
    z.object({
      keyword: z.string(),
      searchVolume: z.number(),
      difficulty: z.number(),
      cpc: z.number(),
      intent: z.string(),
      opportunityScore: z.number(),
    }),
  ),
});

const schemaValidation = z.object({
  schemasDetected: z.array(z.string()),
  isValidJsonLd: z.boolean(),
  validationErrorsCount: z.number(),
  missingRecommendedSchemas: z.array(z.string()),
  richSnippetEligible: z.boolean(),
});

const aiGeoVisibility = z.object({
  visibilityScore: z.number(),
  brandEntityClarity: z.number(),
  factDensityScore: z.number(),
  dataAvailable: z.boolean(),
  methodology: z.string(),
  engineBreakdown: z.record(z.number()),
  estimatedCitationsAcrossEngines: z.object({
    googleAiOverviews: z.number(),
    perplexity: z.number(),
    chatgptSearch: z.number(),
    claude: z.number(),
  }),
  keyEntityStrengths: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const algorithmImpact = z.object({
  potentiallyImpactedByRecentUpdates: z.boolean(),
  recentRelevantUpdates: z.array(
    z.object({
      name: z.string(),
      date: z.string(),
      kind: z.string(),
      notes: z.string(),
    }),
  ),
  riskRating: z.enum(["low", "medium", "high"]),
});

const dataProvenance = z.object({
  measured: z.array(z.string()),
  estimated: z.array(z.string()),
  unavailable: z.array(z.string()),
  simulated: z.boolean(),
  notes: z.array(z.string()),
});

export const auditReportSchema = z.object({
  id: z.string(),
  targetUrl: z.string(),
  domain: z.string(),
  createdAt: z.string(),
  durationMs: z.number(),
  overallScore: z.number(),
  scores: z.object({
    technical: z.number(),
    onPage: z.number(),
    headings: z.number(),
    images: z.number(),
    schema: z.number(),
    gsc: z.number(),
    aiVisibility: z.number(),
  }),
  technicalHealth,
  crawlability,
  onPage,
  headings,
  images,
  searchConsole,
  keywordsAndGaps: keywords,
  schemaValidation,
  aiGeoVisibility,
  algorithmImpact,
  actionPlan: z.array(actionItem),
  dataProvenance,
});

export type ValidatedAuditReport = z.infer<typeof auditReportSchema>;
