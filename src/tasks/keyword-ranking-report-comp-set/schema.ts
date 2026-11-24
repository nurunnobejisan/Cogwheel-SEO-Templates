import { z } from "zod";

export const compsetRankEntrySchema = z.object({
  domain: z.string().min(1),
  rank: z.number().int().positive().nullable(),
  previousRank: z.number().int().positive().nullable().optional(),
  url: z.string().url().optional(),
});

export const trackedRankingItemSchema = z.object({
  keyword: z.string().min(1),
  searchVolume: z.number().int().nonnegative(),
  category: z.string().default("Brand"),
  propertyRank: z.number().int().positive().nullable(),
  propertyPreviousRank: z.number().int().positive().nullable().optional(),
  compsetRanks: z.array(compsetRankEntrySchema),
  serpFeatures: z.array(z.string()).default([]),
  bestCompetitor: z.string().nullable().optional(),
  visibilityIndex: z.number().min(0).max(100),
});

export type TrackedRankingItem = z.infer<typeof trackedRankingItemSchema>;

export const keywordRankingReportCompSetInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url().optional(),
  }),
  compsetDomains: z.array(z.string()).min(1),
  trackedKeywords: z.array(z.string()).min(1),
});

export type KeywordRankingReportCompSetInput = z.infer<
  typeof keywordRankingReportCompSetInputSchema
>;

export const keywordRankingReportCompSetDraftSchema = z.object({
  rankings: z.array(trackedRankingItemSchema),
  summary: z.object({
    top3Count: z.number().int().nonnegative(),
    top10Count: z.number().int().nonnegative(),
    averageRank: z.number().nullable(),
    propertyShareOfVoice: z.number().min(0).max(100),
  }),
  strategicInsights: z.array(z.string()),
});

export type KeywordRankingReportCompSetDraft = z.infer<
  typeof keywordRankingReportCompSetDraftSchema
>;
