import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import type { SeoVisibilityNarrativeDraft, SeoVisibilityReportInput, SeoVisibilitySummary } from "./schema";

const FORBIDDEN_PLACEHOLDER_PATTERNS = [
  /\[property name\]/i,
  /remove these instructions/i,
  /\btbd\b/i,
  /lorem ipsum/i,
];

export function runDeterministicReportChecks(
  summary: SeoVisibilitySummary,
  input: SeoVisibilityReportInput,
): { flags: TaskRunFlag[]; findings: string[] } {
  const flags: TaskRunFlag[] = [];
  const findings: string[] = [];

  if (!summary.pdf_included) {
    flags.push({
      code: "MISSING_AUDIT_PDF",
      message: "Semrush Site Audit PDF was not provided; Slide 5 technical error snapshot may be omitted.",
      severity: "warning",
      section: "Slide 5",
    });
    findings.push("No Semrush Site Audit PDF uploaded.");
  }

  if (summary.tracked_count === 0) {
    flags.push({
      code: "NO_TRACKED_KEYWORDS",
      message: "No tracked keywords were populated on Slide 2.",
      severity: "warning",
      section: "Slide 2",
    });
    findings.push("Zero tracked keywords detected.");
  }

  if (summary.ancillary_count === 0) {
    flags.push({
      code: "NO_ANCILLARY_KEYWORDS",
      message: "No ancillary keywords were populated on Slide 3.",
      severity: "warning",
      section: "Slide 3",
    });
    findings.push("Zero ancillary keywords detected.");
  }

  if (summary.top10_count === 0) {
    findings.push("No keywords currently rank in the top 10.");
  } else {
    findings.push(`${summary.top10_count} keyword(s) currently rank in positions 1-10.`);
  }

  if (input.targetUrl) {
    findings.push(`Live site service detection ran against ${input.targetUrl}.`);
  }

  return { flags, findings };
}

export function validateSeoVisibilityDraft(
  draft: SeoVisibilityNarrativeDraft,
  summary: SeoVisibilitySummary,
): ValidationOutcome<SeoVisibilityNarrativeDraft> {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.executiveSummary || draft.executiveSummary.trim().length < 20) {
    feedback.push("executiveSummary must be at least 20 characters.");
  }

  const combined = `${draft.executiveSummary}\n${draft.highlights.join("\n")}`;
  for (const pattern of FORBIDDEN_PLACEHOLDER_PATTERNS) {
    if (pattern.test(combined)) {
      feedback.push(`Output contains forbidden placeholder text matching ${pattern.source}.`);
      flags.push({
        code: "PLACEHOLDER_TEXT",
        message: `Forbidden placeholder text detected (${pattern.source}).`,
        severity: "error",
      });
    }
  }

  if (summary.slide_count < 4) {
    flags.push({
      code: "UNEXPECTED_SLIDE_COUNT",
      message: `Generated deck has ${summary.slide_count} slides (expected at least 4).`,
      severity: "warning",
    });
  }

  if (feedback.length > 0) {
    return { valid: false, flags, feedback };
  }

  return {
    valid: true,
    flags,
    normalized: draft,
  };
}

