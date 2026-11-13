import { z } from "zod";
import { propertySchema } from "@/lib/schemas";

export const startSiteCrawlSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: propertySchema.optional(),
  url: z.string().trim().min(1, "Property URL is required"),
  maxPages: z.number().int().min(1).max(1000).default(150),
  crawlDepth: z.number().int().min(0).max(10).default(4),
  includePatterns: z.array(z.string()).optional().default([]),
  excludePatterns: z.array(z.string()).optional().default([]),
  batchSize: z.number().int().min(1).max(50).default(10),
  runAllBatches: z.boolean().optional().default(false),
});

export const stepSiteCrawlSchema = z.object({
  crawlRunId: z.string().uuid(),
  batchSize: z.number().int().min(1).max(50).default(10),
  runAllBatches: z.boolean().optional().default(false),
});

export const siteCrawlInputSchema = z.union([stepSiteCrawlSchema, startSiteCrawlSchema]);

export type SiteCrawlInput = z.infer<typeof siteCrawlInputSchema>;
export type StartSiteCrawlInput = z.infer<typeof startSiteCrawlSchema>;
export type StepSiteCrawlInput = z.infer<typeof stepSiteCrawlSchema>;

