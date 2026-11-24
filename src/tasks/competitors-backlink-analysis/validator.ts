import type { TaskRunFlag } from "@/core/runs";
import type {
  CompetitorsBacklinkAnalysisDraft,
  CompetitorsBacklinkAnalysisInput,
} from "./schema";

export function validateCompetitorsBacklinkDraft(
  draft: CompetitorsBacklinkAnalysisDraft,
  _input: CompetitorsBacklinkAnalysisInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.referringDomainGaps || draft.referringDomainGaps.length === 0) {
    flags.push({
      code: "empty-backlink-gaps",
      message: "No competitor referring domain gaps were provided.",
      severity: "error",
    });
    feedback.push("Identify at least 2 high-value competitor referring domain gaps.");
  }

  for (const gap of draft.referringDomainGaps ?? []) {
    if (gap.domainAuthority !== null && gap.domainAuthority !== undefined) {
      if (gap.domainAuthority < 0 || gap.domainAuthority > 100) {
        flags.push({
          code: "invalid-domain-authority",
          message: `Domain ${gap.domain} has out-of-bounds domain authority ${gap.domainAuthority}.`,
          severity: "error",
        });
        feedback.push(`Domain authority for "${gap.domain}" must be between 0 and 100.`);
      }
    }
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
