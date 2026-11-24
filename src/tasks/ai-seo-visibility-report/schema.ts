import { z } from "zod";

export const geoPlatformMetricSchema = z.object({
  platform: z.enum(["chatgpt_search", "google_ai_overviews", "perplexity", "copilot", "gemini"]),
  brandMentionRatePercent: z.number().min(0).max(100),
  directCitationRatePercent: z.number().min(0).max(100),
  topCitedUrl: z.string().url().optional(),
  competitorComparisonText: z.string().min(5),
});

export const aiSeoVisibilityReportInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
  }),
  quarterPeriod: z.string().default("Quarterly Review"),
  totalTrackedKeywords: z.number().int().positive().default(78),
  observedGeoQueriesCount: z.number().int().nonnegative().default(25),
});

export type AiSeoVisibilityReportInput = z.infer<
  typeof aiSeoVisibilityReportInputSchema
>;

export const aiSeoVisibilityReportDraftSchema = z.object({
  executiveOverview: z.string().min(20),
  combinedScore: z.number().min(0).max(100),
  organicSeoTrends: z.object({
    top3KeywordsCount: z.number().int().nonnegative(),
    top10KeywordsCount: z.number().int().nonnegative(),
    organicClicksEstimate: z.number().int().nonnegative(),
    primaryGrowthDriver: z.string(),
  }),
  geoPlatformMetrics: z.array(geoPlatformMetricSchema),
  topAiCitationsEarned: z.array(
    z.object({
      queryPrompt: z.string(),
      platform: z.string(),
      citationUrl: z.string().url(),
      evidenceSnippet: z.string(),
    }),
  ),
  strategicActionsNextQuarter: z.array(z.string()).min(2),
});

export type AiSeoVisibilityReportDraft = z.infer<
  typeof aiSeoVisibilityReportDraftSchema
>;
