import type { TaskRunFlag } from "@/core/runs";
import type {
  FinalSeoGeoProjectReportDraft,
  FinalSeoGeoProjectReportInput,
} from "./schema";

export function validateFinalProjectReportDraft(
  draft: FinalSeoGeoProjectReportDraft,
  _input: FinalSeoGeoProjectReportInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (draft.overallProjectScore < 0 || draft.overallProjectScore > 100) {
    flags.push({
      code: "invalid-project-score",
      message: `Overall project score ${draft.overallProjectScore} is out of bounds (0-100).`,
      severity: "error",
    });
    feedback.push("Overall project score must be between 0 and 100.");
  }

  if (!draft.deliverableMilestones || draft.deliverableMilestones.length === 0) {
    flags.push({
      code: "empty-deliverable-milestones",
      message: "No deliverable milestones were summarized.",
      severity: "error",
    });
    feedback.push("Summarize at least 3 major deliverable milestones from the engagement.");
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
