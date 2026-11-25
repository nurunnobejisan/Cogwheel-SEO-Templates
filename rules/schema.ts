/**
 * Cogwheel Universal SEO Engine — AuditReport Validation
 *
 * Strict Zod schema enforcing the standardized Universal Audit JSON payload
 * before it leaves the engine. Freeform output is rejected here, mirroring the
 * backend validation layer described in the roadmap.
 */

import { z } from "zod";
import type { AuditReport } from "./types.ts";

export const ISSUE_CATEGORIES = [
  "metadata",
  "content",
  "media",
  "technical",
  "accessibility",
  "schema",
  "hospitality",
] as const;

export const ISSUE_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

export const AuditIssueContextSchema = z
  .object({
    currentValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    selector: z.string(),
    imageSrc: z.string().optional(),
    recommendedAction: z.string(),
  })
  .strict();

export const AuditIssueSchema = z
  .object({
    issueId: z.string().min(1),
    category: z.enum(ISSUE_CATEGORIES),
    severity: z.enum(ISSUE_SEVERITIES),
    fixable: z.boolean(),
    cmsTargetField: z.string().nullable(),
    context: AuditIssueContextSchema,
  })
  .strict();

export const ModeDetectionSchema = z
  .object({
    mode: z.enum(["universal", "hotel"]),
    confidence: z.number().min(0).max(1),
    signals: z.array(z.string()),
    overridden: z.boolean(),
  })
  .strict();

export const AuditSummarySchema = z
  .object({
    totalIssues: z.number().int().nonnegative(),
    bySeverity: z
      .object({
        critical: z.number().int().nonnegative(),
        high: z.number().int().nonnegative(),
        medium: z.number().int().nonnegative(),
        low: z.number().int().nonnegative(),
        info: z.number().int().nonnegative(),
      })
      .strict(),
    byCategory: z
      .object({
        metadata: z.number().int().nonnegative().optional(),
        content: z.number().int().nonnegative().optional(),
        media: z.number().int().nonnegative().optional(),
        technical: z.number().int().nonnegative().optional(),
        accessibility: z.number().int().nonnegative().optional(),
        schema: z.number().int().nonnegative().optional(),
        hospitality: z.number().int().nonnegative().optional(),
      })
      .strict(),
    score: z.number().min(0).max(100),
  })
  .strict();

export const AuditReportSchema = z
  .object({
    auditId: z.string().min(1),
    domain: z.string().min(1),
    pageUrl: z.string().min(1),
    timestamp: z.string().min(1),
    mode: z.enum(["universal", "hotel"]),
    modeDetection: ModeDetectionSchema,
    issues: z.array(AuditIssueSchema),
    summary: AuditSummarySchema,
  })
  .strict();

/** Parse + validate an AuditReport payload. Throws on malformed output. */
export function validateAuditReport(data: unknown): AuditReport {
  return AuditReportSchema.parse(data) as AuditReport;
}

/** Non-throwing variant for guardrails and CI checks. */
export function isValidAuditReport(data: unknown): boolean {
  return AuditReportSchema.safeParse(data).success;
}
