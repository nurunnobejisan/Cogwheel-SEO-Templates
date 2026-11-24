import type { TaskRunFlag } from "@/core/runs";
import type {
  KeywordRankingReportCompSetDraft,
  KeywordRankingReportCompSetInput,
} from "./schema";

export function validateKeywordRankingCompSetDraft(
  draft: KeywordRankingReportCompSetDraft,
  input: KeywordRankingReportCompSetInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.rankings || draft.rankings.length === 0) {
    flags.push({
      code: "empty-rankings",
      message: "No keyword rankings were evaluated.",
      severity: "error",
    });
    feedback.push("You must evaluate rankings for all tracked keywords.");
  }

  const compsetSet = new Set(
    input.compsetDomains.map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")),
  );

  for (const r of draft.rankings ?? []) {
    for (const c of r.compsetRanks ?? []) {
      const normDomain = c.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!compsetSet.has(normDomain)) {
        flags.push({
          code: "unrecognized-compset-domain",
          message: `Rank item "${r.keyword}" references unrecognized compset domain "${c.domain}".`,
          severity: "warning",
        });
      }
    }
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
