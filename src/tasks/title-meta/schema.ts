import { z } from "zod";
import { propertySchema } from "@/lib/schemas";

export const titleMetaInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: propertySchema.optional(),
  crawlRunId: z.string().uuid().optional(),
  keywordRunId: z.string().uuid().optional(),
  pageUrls: z.array(z.string().url()).optional(),
  /** Optional inline keyword map `{ [urlOrPath]: primaryKeyword }` when not loading from Supabase. */
  keywordMap: z.record(z.string()).optional(),
});

export type TitleMetaInput = z.infer<typeof titleMetaInputSchema>;

export interface TitleMetaPageInput {
  page: string;
  url: string;
  currentTitle: string;
  currentMeta: string;
  h1: string;
  wordCount: number;
  canonical: string | null;
  robotsMeta: string | null;
  primaryKeyword: string;
}

export interface TitleMetaRowDraft {
  page: string;
  url: string;
  currentTitle: string;
  proposedTitle: string;
  currentMeta: string;
  proposedMeta: string;
  primaryKeyword: string;
  notes: string;
}

