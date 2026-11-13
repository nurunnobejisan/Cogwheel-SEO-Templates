import { z } from "zod";
import type { HeadingEntry } from "@/core/crawler";
import { propertySchema } from "@/lib/schemas";

export const headingStructureInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: propertySchema.optional(),
  crawlRunId: z.string().uuid().optional(),
  keywordRunId: z.string().uuid().optional(),
  pageUrls: z.array(z.string().url()).optional(),
  keywordMap: z.record(z.string()).optional(),
  templatePath: z.string().optional(),
});

export type HeadingStructureInput = z.infer<typeof headingStructureInputSchema>;

export interface HeadingStructurePageInput {
  page: string;
  url: string;
  title: string;
  wordCount: number;
  headings: HeadingEntry[];
  primaryKeyword: string;
  deterministicIssues: string[];
}

export interface HeadingStructureRowDraft {
  page: string;
  url: string;
  currentH1: string;
  proposedH1: string;
  currentH2List: string[];
  proposedH2List: string[];
  /** Proposed H3+ levels if present in outline (used for hierarchy check). */
  proposedOutlineLevels?: number[];
  issue: string;
  primaryKeyword: string;
  notes: string;
}

