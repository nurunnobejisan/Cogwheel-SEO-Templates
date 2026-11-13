import { z } from "zod";

export const DEFAULT_BASELINE_SLIDES_TEMPLATE_ID =
  "1EfhGAw3vIcJroTvhi8LBz3E6MzSSQbG2cC0BZOBrjn4";

export const semrushSummarySchema = z.object({
  organicTraffic: z.number().int().min(0).optional(),
  totalRankingKeywords: z.number().int().min(0).optional(),
  nonBrandKeywords: z.number().int().min(0).optional(),
  brandKeywords: z.number().int().min(0).optional(),
  referringDomains: z.number().int().min(0).optional(),
  backlinks: z.number().int().min(0).optional(),
  indexedPages: z.number().int().min(0).optional(),
  keywordReportUrl: z.string().url().optional().or(z.literal("")),
});

export const trendNotesSchema = z.object({
  trafficNote: z.string().optional(),
  keywordNote: z.string().optional(),
});

export const aiVisibilityMetricsSchema = z.object({
  visibilityScore: z.number().min(0).max(100).optional(),
  brandSentiment: z.number().min(0).max(100).optional(),
  brandMentions: z.number().int().min(0).optional(),
  pagesCited: z.number().int().min(0).optional(),
  shareOfVoice: z.number().min(0).max(100).optional(),
  topCitedDomains: z.array(z.string().min(1)).default([]),
});

export const seoBaselineInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1, "Property name is required"),
    url: z.string().url("Valid property URL is required"),
    brand: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  }),
  templateId: z.string().optional(),
  semrushSummary: semrushSummarySchema.default({}),
  mobileTrends: trendNotesSchema.default({}),
  desktopTrends: trendNotesSchema.default({}),
  compSetNotes: z.string().optional(),
  aiVisibility: aiVisibilityMetricsSchema.default({}),
});

export type SeoBaselineInput = z.infer<typeof seoBaselineInputSchema>;

export interface SeoBaselineDraft {
  mobileTrafficSummary: string;
  mobileKeywordsSummary: string;
  mobileAnalysis: string;
  desktopTrafficSummary: string;
  desktopKeywordsSummary: string;
  desktopAnalysis: string;
  compSetTakeaway: string;
  aiVisibilityTakeaway: string;
}
