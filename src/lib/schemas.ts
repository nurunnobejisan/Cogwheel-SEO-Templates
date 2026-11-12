import { z } from "zod";

export const propertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required"),
  url: z.string().trim().optional().default(""),
  brand: z.string().trim().default(""),
  city: z.string().trim().min(1, "City is required"),
  state: z
    .string()
    .trim()
    .length(2, "State must be a 2-letter code")
    .transform((s) => s.toUpperCase()),
  notes: z.string().trim().optional().default(""),
  petFriendly: z.boolean().optional().default(true),
  attractions: z.array(z.string()).optional().default([]),
  rationaleStyle: z.enum(["arrive", "catbird", "reitz"]).optional().default("catbird"),
  templateDocUrl: z.string().trim().optional().default(""),
  allowedLocations: z.array(z.string()).default([]),
  excludedLocations: z.array(z.string()).default([]),
});

export const pageSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  title: z.string().min(1),
  buckets: z.array(z.string()),
  active: z.boolean(),
  ignoreKdLimit: z.boolean().optional(),
});

const flagSchema = z.enum([
  "kd-na",
  "low-sv-exception",
  "kd-unknown",
  "kd-exception",
  "high-sv-exception-available",
  "no-candidates",
  "manual-override",
]);

export const keywordSchema = z.object({
  id: z.string(),
  keyword: z.string(),
  volume: z.number(),
  kd: z.number().nullable(),
  cpc: z.number().nullable(),
  intent: z.string().nullable(),
  sourceGroup: z.string(),
  sourceFiles: z.array(z.string()),
  flags: z.array(flagSchema),
  bucketId: z.string().optional(),
  bucketName: z.string().optional(),
  bucketSource: z.enum(["keyword", "group", "custom", "fallback"]).optional(),
});

export const rulesOverrideSchema = z
  .object({
    quotaTotal: z.number().int().min(1).max(500),
    minVolume: z.number().min(0),
    lowVolumeExceptionMaxKd: z.number().min(0).max(100),
    kdPreferredMax: z.number().min(0).max(100),
    highVolumeException: z.object({ multiplier: z.number().min(1), minVolume: z.number().min(0) }).partial(),
    maxPerBucket: z.number().int().min(1).nullable(),
    alternativesPerPage: z.number().int().min(0).max(25),
    includeUnassignedInPool: z.boolean(),
  })
  .partial()
  .optional();

export const templateSchema = z.enum(["A", "B"]);

export const selectionRequestSchema = z.object({
  keywords: z.array(keywordSchema).max(100_000),
  pages: z.array(pageSchema).max(200),
  template: templateSchema.default("A"),
  rules: rulesOverrideSchema,
});

