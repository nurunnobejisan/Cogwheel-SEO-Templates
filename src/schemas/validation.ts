import { z } from "zod";

/**
 * ============================================================================
 * 1. 78-KEYWORD STRATEGY MATRIX SCHEMAS
 * ============================================================================
 */

export const KeywordItemSchema = z.object({
  id: z.string(),
  keyword: z.string().min(1),
  /**
   * Pack-defined category vocabulary. The hotel matrix keeps its six historic
   * categories; every pack declares its own in `matrix.categories`, and
   * `validatePack` rejects rows whose category is not declared there.
   */
  category: z.string().min(1),
  subCategory: z.string(),
  searchIntent: z.enum([
    "Navigational",
    "Informational",
    "Commercial",
    "Transactional",
    "Conversational/Generative",
  ]),
  searchVolumeTier: z.enum(["High", "Medium", "Low", "Long-Tail / Conversational"]),
  /**
   * Cost-per-click planning figure. Never measured for this dataset, so the
   * source marker is required and only "illustrative" is accepted — widening
   * it to "measured" is a deliberate schema change, not a data entry.
   */
  cpcEstimate: z.object({
    value: z.string().min(1),
    source: z.enum(["illustrative"]),
  }),
  targetPageType: z.string(),
  recommendedSchema: z.string(),
  geoEngineRelevance: z.array(z.string()).min(1),
  targetEntityPrompt: z.string(),
  competitiveContext: z.string(),
});

export const KeywordMetadataSchema = z.object({
  version: z.string(),
  datasetName: z.string(),
  totalKeywords: z.number().int().min(1),
  lastUpdated: z.string(),
  author: z.string(),
  targetIndustries: z.array(z.string()),
  categorySummary: z.record(z.string(), z.number()),
  /**
   * Provenance note shown with the dataset. Every pack states plainly which
   * fields are planning aids rather than measurements.
   */
  notes: z.string().optional(),
});

export const KeywordStrategyMatrixSchema = z.object({
  metadata: KeywordMetadataSchema,
  categories: z.array(z.string()).min(1),
  keywords: z.array(KeywordItemSchema).min(1),
});

export type KeywordItem = z.infer<typeof KeywordItemSchema>;
export type KeywordMetadata = z.infer<typeof KeywordMetadataSchema>;
export type KeywordStrategyMatrix = z.infer<typeof KeywordStrategyMatrixSchema>;

/**
 * ============================================================================
 * 2. HOTEL BRAND GUARDRAILS SCHEMAS
 * ============================================================================
 */

export const ForbiddenTermSchema = z.object({
  term: z.string().min(1),
  reason: z.string().min(1),
  replacement: z.string().min(1),
});

export const BrandRuleSchema = z.object({
  name: z.enum(["Marriott", "Hilton", "IHG", "Hyatt", "Independent", "Generic"]),
  loyaltyProgram: z.string(),
  /** Franchise suffix required after the brand name (hotel brands only). */
  mandatorySuffix: z.string().optional(),
  maxTitleChars: z.number().int().min(30).max(100),
  maxMetaChars: z.number().int().min(80).max(250),
  maxH1Chars: z.number().int().min(20).max(120),
  brandPillColor: z.string(),
  forbiddenTerms: z.array(ForbiddenTermSchema),
});

export const AllBrandGuardrailsSchema = z.record(
  z.enum(["Marriott", "Hilton", "IHG", "Hyatt", "Independent", "Generic"]),
  BrandRuleSchema
);

export type ForbiddenTerm = z.infer<typeof ForbiddenTermSchema>;
export type BrandRule = z.infer<typeof BrandRuleSchema>;
export type AllBrandGuardrails = z.infer<typeof AllBrandGuardrailsSchema>;

/**
 * ============================================================================
 * 3. AUDIT PAYLOAD & SCORE BREAKDOWN SCHEMAS
 * ============================================================================
 */

export const QuickWinItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  impact: z.string(),
  templateIdToFix: z.string().optional(),
  fixActionLabel: z.string().optional(),
});

export const ScoreBreakdownSchema = z.object({
  overall: z.number().min(0).max(100),
  onPage: z.number().min(0).max(100),
  schemaTechnical: z.number().min(0).max(100),
  geoAiReadiness: z.number().min(0).max(100),
  grade: z.enum(["A+", "A", "B", "C", "NEEDS AUDIT"]),
  gradeColor: z.string(),
  passedGates: z.number().int().min(0).max(10),
  totalGates: z.number().int().min(1),
  quickWins: z.array(QuickWinItemSchema),
});

export const PageAuditDataSchema = z.object({
  url: z.string().url(),
  origin: z.string(),
  pathname: z.string(),
  protocol: z.string(),
  hostname: z.string(),
  title: z.string(),
  titlePixelWidth: z.number().optional(),
  metaDesc: z.string(),
  metaDescPixelWidth: z.number().optional(),
  metaRobots: z.string().optional(),
  language: z.string().optional(),
  canonical: z.string(),
  h1Elements: z.array(z.string()),
  h2Elements: z.array(z.string()),
  h3Elements: z.array(z.string()),
  allHeadings: z.array(z.object({ tag: z.string(), text: z.string() })).optional(),
  totalImages: z.number().int().min(0),
  imagesWithoutAlt: z.number().int().min(0),
  oversizedImages: z.number().int().min(0),
  imagesList: z
    .array(z.object({ src: z.string(), alt: z.string(), loading: z.string().optional() }))
    .optional(),
  words: z.number().int().min(0),
  extractedAmenities: z.array(z.string()).optional(),
  topKeywords: z
    .array(z.object({ term: z.string(), count: z.number(), density: z.string() }))
    .optional(),
  schemas: z.array(z.record(z.string(), z.any())),
  links: z.object({
    internal: z.number().int().min(0),
    external: z.number().int().min(0),
    nofollow: z.number().int().min(0),
  }),
  internalUrls: z.array(z.string()).optional(),
  hasViewport: z.boolean(),
  hasOgTitle: z.boolean(),
  hasOgImage: z.boolean(),
  ogTitle: z.string(),
  ogDescription: z.string(),
  ogImage: z.string(),
  twitterTags: z
    .object({
      card: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
    })
    .optional(),
  detectedNap: z
    .object({
      phone: z.string().optional(),
      address: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
  loadTimeMs: z.number().optional(),
});

export const AuditPayloadSchema = z.object({
  pageData: PageAuditDataSchema,
  scores: ScoreBreakdownSchema,
  timestamp: z.string().optional(),
});

export type QuickWinItem = z.infer<typeof QuickWinItemSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
export type PageAuditData = z.infer<typeof PageAuditDataSchema>;
export type AuditPayload = z.infer<typeof AuditPayloadSchema>;

/**
 * ============================================================================
 * 4. OTA CONFIGURATION SCHEMAS
 * ============================================================================
 */

export const PixelLimitsSchema = z.object({
  titleMaxPx: z.number().int().positive(),
  descriptionMaxPx: z.number().int().positive(),
});

export const ScoringWeightsSchema = z.object({
  onPage: z.number().min(0).max(1),
  schema: z.number().min(0).max(1),
  geoAi: z.number().min(0).max(1),
});

export const OtaConfigSchema = z.object({
  schemaVersion: z.string(),
  updatedAt: z.string(),
  pixelLimits: PixelLimitsSchema,
  scoringWeights: ScoringWeightsSchema,
  keywordMatrixUrl: z.string().url(),
  brandGuardrailsUrl: z.string().url(),
});

export type PixelLimits = z.infer<typeof PixelLimitsSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type OtaConfig = z.infer<typeof OtaConfigSchema>;

/**
 * ============================================================================
 * HELPER VALIDATION FUNCTIONS (Type-Safe Single Source of Truth)
 * ============================================================================
 */

export function validateKeywordMatrix(data: unknown): KeywordStrategyMatrix {
  return KeywordStrategyMatrixSchema.parse(data);
}

export function validateBrandGuardrails(data: unknown): AllBrandGuardrails {
  return AllBrandGuardrailsSchema.parse(data);
}

export function validateAuditPayload(data: unknown): AuditPayload {
  return AuditPayloadSchema.parse(data);
}

export function validatePageAuditData(data: unknown): PageAuditData {
  return PageAuditDataSchema.parse(data);
}

export function validateOtaConfig(data: unknown): OtaConfig {
  return OtaConfigSchema.parse(data);
}
