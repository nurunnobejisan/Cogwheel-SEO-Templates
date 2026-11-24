import type { TaskRunFlag } from "@/core/runs";
import type {
  SiteTechReAuditReportDraft,
  SiteTechReAuditReportInput,
} from "./schema";

export function validateSiteTechReAuditDraft(
  draft: SiteTechReAuditReportDraft,
  _input: SiteTechReAuditReportInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  const { resolvedCount, persistentCount, regressionCount, resolutionRatePercent } = draft.metrics;
  if (resolutionRatePercent < 0 || resolutionRatePercent > 100) {
    flags.push({
      code: "invalid-resolution-rate",
      message: `Resolution rate percentage ${resolutionRatePercent}% is outside 0-100 range.`,
      severity: "error",
    });
    feedback.push("Resolution rate percentage must be between 0 and 100.");
  }

  if (resolvedCount + persistentCount === 0 && regressionCount === 0 && draft.issueDeltas.length > 0) {
    flags.push({
      code: "metric-delta-mismatch",
      message: "Metrics counts do not match issue deltas array.",
      severity: "warning",
    });
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
