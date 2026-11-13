import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import type { DuplicateCluster, DuplicateContentRowDraft } from "./schema";

export function validateDuplicateContentRows(opts: {
  draft: DuplicateContentRowDraft[];
  clusters: DuplicateCluster[];
  allowedUrls: Set<string>;
}): ValidationOutcome<DuplicateContentRowDraft[]> {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (opts.clusters.length > 0 && opts.draft.length === 0) {
    feedback.push("Draft returned 0 rows despite deterministic duplicate/thin content clusters.");
  }

  for (const row of opts.draft) {
    if (!opts.allowedUrls.has(row.primaryUrl)) {
      feedback.push(`primaryUrl "${row.primaryUrl}" is not in the crawled URL set.`);
    }
    for (const u of row.affectedUrls) {
      if (!opts.allowedUrls.has(u)) {
        feedback.push(`affectedUrl "${u}" is not in the crawled URL set.`);
      }
    }
  }

  if (opts.clusters.length > opts.draft.length) {
    flags.push({
      code: "partial-cluster-coverage",
      message: `${opts.draft.length} of ${opts.clusters.length} duplicate/thin clusters included.`,
      severity: "warning",
    });
  }

  if (feedback.length > 0) {
    return { valid: false, feedback, flags };
  }

  return { valid: true, normalized: opts.draft, flags };
}
