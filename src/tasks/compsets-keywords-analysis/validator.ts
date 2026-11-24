import type { TaskRunFlag } from "@/core/runs";
import type { CompsetsKeywordsAnalysisDraft, CompsetsKeywordsAnalysisInput } from "./schema";

export function validateCompsetKeywordsDraft(
  draft: CompsetsKeywordsAnalysisDraft,
  input: CompsetsKeywordsAnalysisInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.gaps || draft.gaps.length === 0) {
    flags.push({
      code: "empty-compset-gaps",
      message: "No competitive keyword gaps were returned.",
      severity: "error",
    });
    feedback.push("You must provide at least 3 high-impact competitive keyword gaps.");
  }

  const validDomains = new Set(input.compsetDomains.map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")));

  for (const gap of draft.gaps ?? []) {
    const normDomain = gap.competitorDomain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!validDomains.has(normDomain)) {
      flags.push({
        code: "invalid-compset-domain",
        message: `Gap keyword "${gap.keyword}" references domain "${gap.competitorDomain}" which is not in the provided compset list.`,
        severity: "warning",
      });
    }

    if (gap.opportunityScore < 0 || gap.opportunityScore > 100) {
      flags.push({
        code: "invalid-opportunity-score",
        message: `Gap keyword "${gap.keyword}" has out-of-bounds opportunity score ${gap.opportunityScore}.`,
        severity: "error",
      });
      feedback.push(`Opportunity score for "${gap.keyword}" must be between 0 and 100.`);
    }
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
