import { z } from "zod";

export const backlinkGapItemSchema = z.object({
  domain: z.string().min(1),
  domainAuthority: z.number().int().min(0).max(100).nullable().optional(),
  category: z.string().default("Travel & Tourism"),
  competitorLinksCount: z.number().int().positive(),
  competitorsLinking: z.array(z.string()).min(1),
  propertyHasLink: z.boolean().default(false),
  acquisitionDifficulty: z.enum(["Easy", "Moderate", "Hard"]),
  recommendedAnchorText: z.string().optional(),
  targetPageRecommendation: z.string().optional(),
});

export type BacklinkGapItem = z.infer<typeof backlinkGapItemSchema>;

export const competitorsBacklinkAnalysisInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
  }),
  compsetDomains: z.array(z.string()).min(1),
  sampleBacklinks: z
    .array(
      z.object({
        sourceDomain: z.string(),
        targetUrl: z.string().url(),
        anchorText: z.string().optional(),
      }),
    )
    .optional(),
});

export type CompetitorsBacklinkAnalysisInput = z.infer<
  typeof competitorsBacklinkAnalysisInputSchema
>;

export const competitorsBacklinkAnalysisDraftSchema = z.object({
  backlinkShareOfVoice: z.object({
    propertyEstimatedRefDomains: z.number().int().nonnegative(),
    compsetAverageRefDomains: z.number().int().nonnegative(),
    estimatedBacklinkGap: z.number().int(),
  }),
  referringDomainGaps: z.array(backlinkGapItemSchema),
  highValueDirectoryCitations: z.array(z.string()),
  strategicRecommendations: z.array(z.string()),
});

export type CompetitorsBacklinkAnalysisDraft = z.infer<
  typeof competitorsBacklinkAnalysisDraftSchema
>;
