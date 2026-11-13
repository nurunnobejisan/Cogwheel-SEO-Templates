import { z } from "zod";

export const duplicateContentAuditInputSchema = z
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
  })
  .refine((d) => Boolean(d.propertyId || d.property), {
    message: "Provide either propertyId or property details.",
  });

export type DuplicateContentAuditInput = z.infer<typeof duplicateContentAuditInputSchema>;

export interface DuplicateCluster {
  clusterType: "exact-duplicate" | "duplicate-title" | "duplicate-meta" | "thin-content";
  key: string;
  urls: Array<{
    url: string;
    canonical: string | null;
    wordCount: number;
    title: string | null;
  }>;
}

export interface DuplicateContentRowDraft {
  clusterType: DuplicateCluster["clusterType"];
  primaryUrl: string;
  affectedUrls: string[];
  severity: "high" | "medium" | "low";
  recommendedAction: "canonicalize" | "301-redirect" | "noindex" | "expand-content" | "differentiate-meta";
  rationale: string;
}

export const duplicateContentRowSchema = z.object({
  clusterType: z.enum(["exact-duplicate", "duplicate-title", "duplicate-meta", "thin-content"]),
  primaryUrl: z.string().trim().min(1),
  affectedUrls: z.array(z.string().trim().min(1)).min(1),
  severity: z.enum(["high", "medium", "low"]),
  recommendedAction: z.enum([
    "canonicalize",
    "301-redirect",
    "noindex",
    "expand-content",
    "differentiate-meta",
  ]),
  rationale: z.string().trim().min(1),
});

export interface DuplicateContentSummary {
  totalPages: number;
  exactDuplicateClusters: number;
  duplicateTitleGroups: number;
  duplicateMetaGroups: number;
  thinPageCount: number;
}

