import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import type { ImageAuditCandidate, ImageOptimizationRowDraft } from "./schema";

const BAD_ALT_RE = /^(?:image|photo|picture|img|banner)$/i;

export function validateImageOptimizationRows(opts: {
  draft: ImageOptimizationRowDraft[];
  candidates: ImageAuditCandidate[];
}): ValidationOutcome<ImageOptimizationRowDraft[]> {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (opts.candidates.length > 0 && opts.draft.length === 0) {
    feedback.push("Draft returned 0 rows despite image optimization candidates.");
  }

  const allowedPairs = new Set(opts.candidates.map((c) => `${c.pageUrl}::${c.imageSrc}`));

  for (const row of opts.draft) {
    if (!allowedPairs.has(`${row.pageUrl}::${row.imageSrc}`)) {
      feedback.push(`Row references ungrounded pageUrl/imageSrc pair: ${row.pageUrl} -> ${row.imageSrc}`);
    }
    if (row.proposedAlt.length > 125) {
      feedback.push(`proposedAlt exceeds 125 chars (${row.proposedAlt.length}) for ${row.imageSrc}`);
    }
    if (BAD_ALT_RE.test(row.proposedAlt.trim())) {
      feedback.push(`proposedAlt "${row.proposedAlt}" is generic and non-descriptive for ${row.imageSrc}`);
    }
  }

  if (opts.candidates.length > opts.draft.length) {
    flags.push({
      code: "partial-image-coverage",
      message: `${opts.draft.length} of ${opts.candidates.length} flagged images included in output.`,
      severity: "warning",
    });
  }

  if (feedback.length > 0) {
    return { valid: false, feedback, flags };
  }

  return { valid: true, normalized: opts.draft, flags };
}
