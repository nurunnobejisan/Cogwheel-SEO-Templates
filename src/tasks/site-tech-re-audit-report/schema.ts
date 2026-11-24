import { z } from "zod";

export const technicalIssueDeltaItemSchema = z.object({
  url: z.string().url(),
  issueType: z.string().min(1),
  status: z.enum(["resolved", "persistent", "regression", "new"]),
  previousEvidence: z.string().optional(),
  currentEvidence: z.string().optional(),
  impact: z.enum(["Critical", "High", "Medium", "Low"]),
  resolutionVerification: z.string().min(3),
});

export type TechnicalIssueDeltaItem = z.infer<typeof technicalIssueDeltaItemSchema>;

export const siteTechReAuditReportInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
  }),
  baselineRunId: z.string().optional(),
  baselineDate: z.string().optional(),
  priorIssues: z
    .array(
      z.object({
        url: z.string().url(),
        issueType: z.string(),
        severity: z.string(),
      }),
    )
    .optional(),
  currentFindings: z
    .array(
      z.object({
        url: z.string().url(),
        issueType: z.string(),
        severity: z.string(),
      }),
    )
    .optional(),
});

export type SiteTechReAuditReportInput = z.infer<typeof siteTechReAuditReportInputSchema>;

export const siteTechReAuditReportDraftSchema = z.object({
  metrics: z.object({
    resolvedCount: z.number().int().nonnegative(),
    persistentCount: z.number().int().nonnegative(),
    regressionCount: z.number().int().nonnegative(),
    resolutionRatePercent: z.number().min(0).max(100),
  }),
  issueDeltas: z.array(technicalIssueDeltaItemSchema),
  overallHealthStatus: z.enum(["significant_improvement", "moderate_progress", "stagnant", "regressed"]),
  executiveSummary: z.string().min(10),
  nextActionChecklist: z.array(z.string()),
});

export type SiteTechReAuditReportDraft = z.infer<typeof siteTechReAuditReportDraftSchema>;
