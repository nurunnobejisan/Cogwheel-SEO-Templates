import { z } from "zod";

export const propertySummaryInputSchema = z.object({
  name: z.string().optional(),
  brand: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export const trackedKeywordPreviewSchema = z.object({
  keyword: z.string(),
  start: z.string(),
  current: z.string(),
  delta: z.string(),
});

export const ancillaryKeywordPreviewSchema = z.object({
  keyword: z.string(),
  rank: z.string(),
  volume: z.string(),
});

export const rankBucketsSchema = z.object({
  top3: z.number().int().min(0),
  pos4_10: z.number().int().min(0),
  pos11_20: z.number().int().min(0),
  pos21_40: z.number().int().min(0),
});

export const seoVisibilitySummarySchema = z.object({
  property_name: z.string().min(1),
  slide_count: z.number().int().min(1),
  is_brand_hosted: z.boolean(),
  pdf_included: z.boolean(),
  tracked_count: z.number().int().min(0),
  ancillary_count: z.number().int().min(0),
  top10_count: z.number().int().min(0),
  rank_buckets: rankBucketsSchema,
  tracked_preview: z.array(trackedKeywordPreviewSchema).default([]),
  ancillary_preview: z.array(ancillaryKeywordPreviewSchema).default([]),
});

export type SeoVisibilitySummary = z.infer<typeof seoVisibilitySummarySchema>;

export const seoVisibilityReportInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: propertySummaryInputSchema.optional(),
  targetUrl: z.string().url().optional().or(z.literal("")),
  templateFileName: z.string().optional(),
  xlsxFileName: z.string().optional(),
  pdfFileName: z.string().optional(),
  downloadName: z.string().optional(),
  summary: seoVisibilitySummarySchema,
});

export type SeoVisibilityReportInput = z.infer<typeof seoVisibilityReportInputSchema>;

export interface SeoVisibilityNarrativeDraft {
  executiveSummary: string;
  highlights: string[];
}
