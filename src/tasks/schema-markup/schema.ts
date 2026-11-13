import { z } from "zod";

export const schemaMarkupInputSchema = z
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
    pageUrls: z.array(z.string().trim().url()).optional(),
  })
  .refine((d) => Boolean(d.propertyId || d.property), {
    message: "Provide either propertyId or property details.",
  });

export type SchemaMarkupInput = z.infer<typeof schemaMarkupInputSchema>;

export interface SchemaPageCandidate {
  pageUrl: string;
  title: string;
  metaDescription: string;
  h1: string;
  existingTypes: string[];
  existingJsonLdRaw: string[];
  openGraph: Record<string, string>;
}

export interface SchemaMarkupItemDraft {
  pageUrl: string;
  schemaType: string;
  existingTypes: string[];
  status: "missing" | "incomplete" | "valid";
  jsonLd: Record<string, unknown>;
  notes: string;
}

export const schemaMarkupItemSchema = z.object({
  pageUrl: z.string().trim().min(1),
  schemaType: z.string().trim().min(1),
  existingTypes: z.array(z.string()),
  status: z.enum(["missing", "incomplete", "valid"]),
  jsonLd: z.record(z.string(), z.unknown()),
  notes: z.string().trim().min(1),
});

export interface SchemaMarkupSummary {
  pagesAudited: number;
  missingSchemaPages: number;
  incompleteSchemaPages: number;
  validSchemaPages: number;
}

