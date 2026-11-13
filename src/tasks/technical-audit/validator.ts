import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import type { TechnicalAuditRowDraft, TechnicalFinding } from "./schema";

export function validateTechnicalAuditRows(opts: {
  draft: TechnicalAuditRowDraft[];
  findings: TechnicalFinding[];
  allowedUrls: Set<string>;
}): ValidationOutcome<TechnicalAuditRowDraft[]> {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (opts.findings.length > 0 && opts.draft.length === 0) {
    feedback.push("Draft returned 0 remediation rows despite deterministic technical findings.");
  }

  for (const row of opts.draft) {
    if (row.url !== "site-wide" && !opts.allowedUrls.has(row.url)) {
      feedback.push(`Row references ungrounded URL "${row.url}" not present in crawl results.`);
    }
  }

  const criticalFindings = opts.findings.filter((f) => f.severity === "critical");
  const draftUrls = new Set(opts.draft.map((r) => r.url));
  const missedCriticals = criticalFindings.filter((f) => !draftUrls.has(f.url));
  if (missedCriticals.length > 0) {
    flags.push({
      code: "missed-critical-findings",
      message: `${missedCriticals.length} critical technical finding(s) were not prioritized in the draft.`,
      severity: "warning",
    });
  }

  if (feedback.length > 0) {
    return { valid: false, feedback, flags };
  }

  return { valid: true, normalized: opts.draft, flags };
}
