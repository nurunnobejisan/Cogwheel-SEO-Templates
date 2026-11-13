import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { stripDiffMarkers } from "@/lib/hilton-validator";
import type { HeadingStructureRowDraft } from "./schema";

const PLACEHOLDER_RE = /(?:\{\{[^}]+\}\}|\[TBD\]|lorem ipsum|remove these instructions)/i;

export function validateHeadingStructureRows(opts: {
  rows: HeadingStructureRowDraft[];
  initialFlags?: TaskRunFlag[];
}): ValidationOutcome<HeadingStructureRowDraft[]> {
  const flags: TaskRunFlag[] = [...(opts.initialFlags ?? [])];
  const feedback: string[] = [];
  const seenH1s = new Map<string, string>();
  let hasHardFailure = false;

  for (const row of opts.rows) {
    const cleanH1 = stripDiffMarkers(row.proposedH1);
    const cleanH2s = row.proposedH2List.map((h) => stripDiffMarkers(h));

    if (!cleanH1) {
      hasHardFailure = true;
      const msg = `${row.url}: Missing proposed H1 (must have exactly one H1).`;
      flags.push({ code: "missing-h1", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
      continue;
    }

    if (cleanH1.length >= 70) {
      hasHardFailure = true;
      const msg = `${row.url}: Proposed H1 is ${cleanH1.length} chars (must be under 70).`;
      flags.push({ code: "h1-too-long", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    if (PLACEHOLDER_RE.test(cleanH1) || cleanH2s.some((h) => PLACEHOLDER_RE.test(h))) {
      hasHardFailure = true;
      const msg = `${row.url}: Contains unresolved placeholder or instruction text.`;
      flags.push({ code: "placeholder-leftover", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    const h1Key = cleanH1.toLowerCase();
    if (seenH1s.has(h1Key)) {
      hasHardFailure = true;
      const msg = `${row.url}: Duplicate H1 "${cleanH1}" also used on ${seenH1s.get(h1Key)}.`;
      flags.push({ code: "duplicate-h1", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    } else {
      seenH1s.set(h1Key, row.url);
    }

    if (row.proposedOutlineLevels && row.proposedOutlineLevels.length > 0) {
      const h1Count = row.proposedOutlineLevels.filter((l) => l === 1).length;
      if (h1Count !== 1) {
        hasHardFailure = true;
        const msg = `${row.url}: Proposed outline has ${h1Count} H1 tags (must be exactly 1).`;
        flags.push({ code: "multiple-h1", message: msg, severity: "error", section: row.url });
        feedback.push(msg);
      }
      for (let i = 1; i < row.proposedOutlineLevels.length; i++) {
        if (row.proposedOutlineLevels[i] - row.proposedOutlineLevels[i - 1] > 1) {
          hasHardFailure = true;
          const msg = `${row.url}: Skipped heading level (H${row.proposedOutlineLevels[i - 1]} to H${row.proposedOutlineLevels[i]}).`;
          flags.push({ code: "skipped-heading-level", message: msg, severity: "error", section: row.url });
          feedback.push(msg);
          break;
        }
      }
    }

    if (row.primaryKeyword.trim()) {
      const kw = row.primaryKeyword.toLowerCase();
      if (!cleanH1.toLowerCase().includes(kw)) {
        hasHardFailure = true;
        const msg = `${row.url}: Proposed H1 must include primary keyword "${row.primaryKeyword}".`;
        flags.push({ code: "h1-missing-keyword", message: msg, severity: "error", section: row.url });
        feedback.push(msg);
      }
      if (cleanH2s.length > 0 && !cleanH2s.some((h) => h.toLowerCase().includes(kw))) {
        hasHardFailure = true;
        const msg = `${row.url}: At least one proposed H2 must include primary keyword "${row.primaryKeyword}".`;
        flags.push({ code: "h2-missing-keyword", message: msg, severity: "error", section: row.url });
        feedback.push(msg);
      }
    }
  }

  return {
    valid: !hasHardFailure,
    flags,
    normalized: opts.rows,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}

