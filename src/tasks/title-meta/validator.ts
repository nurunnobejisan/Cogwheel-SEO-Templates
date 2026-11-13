import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { stripDiffMarkers } from "@/lib/hilton-validator";
import type { TitleMetaRowDraft } from "./schema";

const CTA_END_RE = /\b(?:book|reserve|explore|discover|view|plan|stay|learn|contact|inquire|shop|visit|check)\b[^.!?]*[.!]$/i;
const PLACEHOLDER_RE = /(?:\{\{[^}]+\}\}|\[TBD\]|lorem ipsum|remove these instructions)/i;

function countOccurrences(haystack: string, needle: string): number {
  if (!needle.trim()) return 0;
  const escaped = needle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, "gi"));
  return matches ? matches.length : 0;
}

export function validateTitleMetaRows(opts: {
  rows: TitleMetaRowDraft[];
  brand: string;
  initialFlags?: TaskRunFlag[];
}): ValidationOutcome<TitleMetaRowDraft[]> {
  const flags: TaskRunFlag[] = [...(opts.initialFlags ?? [])];
  const feedback: string[] = [];
  const seenTitles = new Map<string, string>();
  const seenMetas = new Map<string, string>();
  let hasHardFailure = false;

  const normalizedRows = opts.rows.map((row) => ({
    ...row,
    proposedTitle: row.proposedTitle.trim(),
    proposedMeta: row.proposedMeta.trim(),
  }));

  for (const row of normalizedRows) {
    const cleanTitle = stripDiffMarkers(row.proposedTitle);
    const cleanMeta = stripDiffMarkers(row.proposedMeta);

    if (PLACEHOLDER_RE.test(cleanTitle) || PLACEHOLDER_RE.test(cleanMeta)) {
      hasHardFailure = true;
      const msg = `${row.url}: Contains unresolved placeholder or instruction text.`;
      flags.push({ code: "placeholder-leftover", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    // Title length: 50-60 chars
    if (cleanTitle.length < 50 || cleanTitle.length > 60) {
      hasHardFailure = true;
      const msg = `${row.url}: Title length is ${cleanTitle.length} chars (must be 50-60).`;
      flags.push({ code: "title-length", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    // Primary keyword within first 40 chars
    if (row.primaryKeyword.trim()) {
      const kwIdx = cleanTitle.toLowerCase().indexOf(row.primaryKeyword.toLowerCase());
      if (kwIdx === -1 || kwIdx > 40) {
        hasHardFailure = true;
        const msg = `${row.url}: Title must contain primary keyword "${row.primaryKeyword}" within first 40 chars.`;
        flags.push({ code: "title-keyword-position", message: msg, severity: "error", section: row.url });
        feedback.push(msg);
      }
    }

    // Brand name at most once (when brand is set)
    if (opts.brand.trim() && countOccurrences(cleanTitle, opts.brand) > 1) {
      hasHardFailure = true;
      const msg = `${row.url}: Title includes brand "${opts.brand}" more than once.`;
      flags.push({ code: "title-duplicate-brand", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    // Duplicate title check
    const titleKey = cleanTitle.toLowerCase();
    if (titleKey && seenTitles.has(titleKey)) {
      hasHardFailure = true;
      const msg = `${row.url}: Duplicate title also used on ${seenTitles.get(titleKey)}.`;
      flags.push({ code: "duplicate-title", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    } else if (titleKey) {
      seenTitles.set(titleKey, row.url);
    }

    // Meta description: 150-160 chars
    if (cleanMeta.length < 150 || cleanMeta.length > 160) {
      hasHardFailure = true;
      const msg = `${row.url}: Meta description is ${cleanMeta.length} chars (must be 150-160).`;
      flags.push({ code: "meta-length", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    // Meta contains primary keyword
    if (row.primaryKeyword.trim() && !cleanMeta.toLowerCase().includes(row.primaryKeyword.toLowerCase())) {
      hasHardFailure = true;
      const msg = `${row.url}: Meta description must contain primary keyword "${row.primaryKeyword}".`;
      flags.push({ code: "meta-missing-keyword", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    // Meta ends with CTA
    if (!CTA_END_RE.test(cleanMeta)) {
      hasHardFailure = true;
      const msg = `${row.url}: Meta description must end with a clear call to action.`;
      flags.push({ code: "meta-missing-cta", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    }

    // Duplicate meta check
    const metaKey = cleanMeta.toLowerCase();
    if (metaKey && seenMetas.has(metaKey)) {
      hasHardFailure = true;
      const msg = `${row.url}: Duplicate meta description also used on ${seenMetas.get(metaKey)}.`;
      flags.push({ code: "duplicate-meta", message: msg, severity: "error", section: row.url });
      feedback.push(msg);
    } else if (metaKey) {
      seenMetas.set(metaKey, row.url);
    }
  }

  return {
    valid: !hasHardFailure,
    flags,
    normalized: normalizedRows,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
