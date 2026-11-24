import type { TaskRunFlag } from "@/core/runs";
import type {
  AiSeoVisibilityReportDraft,
  AiSeoVisibilityReportInput,
} from "./schema";

export function validateAiSeoVisibilityDraft(
  draft: AiSeoVisibilityReportDraft,
  _input: AiSeoVisibilityReportInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (draft.combinedScore < 0 || draft.combinedScore > 100) {
    flags.push({
      code: "invalid-combined-score",
      message: `Combined visibility score ${draft.combinedScore} is out of bounds (0-100).`,
      severity: "error",
    });
    feedback.push("Combined visibility score must be between 0 and 100.");
  }

  if (!draft.geoPlatformMetrics || draft.geoPlatformMetrics.length === 0) {
    flags.push({
      code: "empty-geo-metrics",
      message: "No AI search platform metrics were reported.",
      severity: "error",
    });
    feedback.push("Include metrics for at least 2 AI platforms (e.g. ChatGPT Search, Google AI Overviews).");
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
