import { z } from "zod";
import { keywordSchema, pageSchema, propertySchema, templateSchema } from "@/lib/schemas";
import type { MatrixRow, PoolEntry, Property, SitemapPage, TemplateId } from "@/lib/types";

const refSchema = z
  .object({
    id: z.string(),
    keyword: z.string(),
    volume: z.number(),
    kd: z.number().nullable(),
    bucketId: z.string().optional(),
  })
  .nullable();

export const directPayloadSchema = z.object({
  property: propertySchema,
  pages: z.array(pageSchema),
  template: templateSchema,
  allocation: z.object({
    pool: z.array(
      keywordSchema.extend({
        role: z.enum(["primary", "secondary", "fill", "reserve"]),
        pageId: z.string().optional(),
      }),
    ),
  }),
  matrix: z.array(
    z.object({
      pageId: z.string(),
      path: z.string(),
      title: z.string(),
      primary: refSchema,
      secondary: refSchema,
      alternatives: z.array(refSchema.unwrap()).default([]),
      exceptionCandidate: refSchema.default(null),
      flags: z.array(z.string()).default([]),
      status: z.enum(["pending", "approved", "edited"]),
    }),
  ),
});

export const keywordResearchInputSchema = z.union([
  z.object({ runId: z.string().uuid() }),
  directPayloadSchema,
]);

export type KeywordResearchInput = z.infer<typeof keywordResearchInputSchema>;

export interface ResolvedKeywordRun {
  runId?: string;
  property: Property;
  pages: SitemapPage[];
  template: TemplateId;
  matrix: MatrixRow[];
  pool: PoolEntry[];
}
