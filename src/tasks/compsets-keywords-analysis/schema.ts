import { z } from "zod";

export const compsetKeywordGapItemSchema = z.object({
  keyword: z.string().min(1),
  searchVolume: z.number().int().nonnegative(),
  keywordDifficulty: z.number().min(0).max(100).nullable(),
  intent: z.enum(["informational", "navigational", "commercial", "transactional"]).default("commercial"),
  competitorDomain: z.string().min(1),
  competitorEstimatedRank: z.number().int().positive().nullable(),
  propertyCurrentRank: z.number().int().positive().nullable(),
  opportunityScore: z.number().min(0).max(100),
  strategicRationale: z.string().min(5),
});

export type CompsetKeywordGapItem = z.infer<typeof compsetKeywordGapItemSchema>;

export const compsetsKeywordsAnalysisInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url().optional(),
  }),
  compsetDomains: z.array(z.string()).min(1),
  targetKeywords: z.array(z.string()).optional(),
});

export type CompsetsKeywordsAnalysisInput = z.infer<typeof compsetsKeywordsAnalysisInputSchema>;

export const compsetsKeywordsAnalysisDraftSchema = z.object({
  gaps: z.array(compsetKeywordGapItemSchema),
  marketSummary: z.string(),
  topImmediateWins: z.array(z.string()),
});

export type CompsetsKeywordsAnalysisDraft = z.infer<typeof compsetsKeywordsAnalysisDraftSchema>;
