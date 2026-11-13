import { z } from "zod";

export const technicalAuditInputSchema = z
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

export type TechnicalAuditInput = z.infer<typeof technicalAuditInputSchema>;

export interface TechnicalFinding {
  url: string;
  category:
    | "broken-link"
    | "redirect-chain"
    | "orphan-page"
    | "js-rendering"
    | "canonical"
    | "indexability"
    | "sitemap"
    | "performance";
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
}

export interface TechnicalAuditRowDraft {
  url: string;
  category: TechnicalFinding["category"];
  severity: TechnicalFinding["severity"];
  issue: string;
  recommendation: string;
  owner: "Dev" | "SEO" | "Content";
  impact: string;
}

export const technicalAuditRowSchema = z.object({
  url: z.string().trim().min(1),
  category: z.enum([
    "broken-link",
    "redirect-chain",
    "orphan-page",
    "js-rendering",
    "canonical",
    "indexability",
    "sitemap",
    "performance",
  ]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  issue: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  owner: z.enum(["Dev", "SEO", "Content"]),
  impact: z.string().trim().min(1),
});

export interface TechnicalAuditSummary {
  totalPages: number;
  brokenCount: number;
  redirectCount: number;
  orphanCount: number;
  jsRenderedCount: number;
  missingCanonicalCount: number;
  noindexCount: number;
  missingFromSitemapCount: number;
  slowPagesCount: number;
}

