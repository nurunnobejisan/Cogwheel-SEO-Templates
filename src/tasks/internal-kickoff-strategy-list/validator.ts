import type { TaskRunFlag } from "@/core/runs";
import type {
  InternalKickoffStrategyListDraft,
  InternalKickoffStrategyListInput,
} from "./schema";

export function validateInternalKickoffStrategyDraft(
  draft: InternalKickoffStrategyListDraft,
  _input: InternalKickoffStrategyListInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.linkableAssets || draft.linkableAssets.length === 0) {
    flags.push({
      code: "empty-linkable-assets",
      message: "No linkable assets were generated.",
      severity: "error",
    });
    feedback.push("You must identify at least 2 distinct linkable assets for this hotel property.");
  }

  if (!draft.outreachCategories || draft.outreachCategories.length === 0) {
    flags.push({
      code: "empty-outreach-categories",
      message: "No outreach publication categories were defined.",
      severity: "error",
    });
    feedback.push("Define target publication categories (e.g. Travel, Wedding, Culinary, Regional).");
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
