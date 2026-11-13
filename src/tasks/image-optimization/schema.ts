import { z } from "zod";

export const imageOptimizationInputSchema = z
  .object({
    propertyId: z.string().uuid().optional(),
    property: z
      .object({
        name: z.string().trim().min(1),
        brand: z.string().trim().min(1),
        city: z.string().trim().min(1),
        state: z.string().trim().min(1),
        url: z.string().trim().url().optional(),
        notes: z.string().trim().optional(),
      })
      .optional(),
    crawlRunId: z.string().uuid().optional(),
    keywordRunId: z.string().uuid().optional(),
    keywordMap: z.record(z.string(), z.string()).optional(),
    pageUrls: z.array(z.string().trim().url()).optional(),
  })
  .refine((d) => Boolean(d.propertyId || d.property), {
    message: "Provide either propertyId or property details.",
  });

export type ImageOptimizationInput = z.infer<typeof imageOptimizationInputSchema>;

export interface ImageAuditCandidate {
  pageUrl: string;
  pageTitle: string;
  primaryKeyword: string;
  imageSrc: string;
  currentAlt: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  issues: string[];
}

export interface ImageOptimizationRowDraft {
  pageUrl: string;
  imageSrc: string;
  currentAlt: string;
  proposedAlt: string;
  issue: string;
  recommendation: string;
}

export const imageOptimizationRowSchema = z.object({
  pageUrl: z.string().trim().min(1),
  imageSrc: z.string().trim().min(1),
  currentAlt: z.string().trim(),
  proposedAlt: z.string().trim().min(1),
  issue: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
});

export interface ImageOptimizationSummary {
  totalImages: number;
  missingAltCount: number;
  genericAltCount: number;
  oversizedCount: number;
  missingDimensionsCount: number;
  nonNextGenCount: number;
}

