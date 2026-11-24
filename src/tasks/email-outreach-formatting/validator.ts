import type { TaskRunFlag } from "@/core/runs";
import type {
  EmailOutreachFormattingDraft,
  EmailOutreachFormattingInput,
} from "./schema";

export function validateEmailOutreachDraft(
  draft: EmailOutreachFormattingDraft,
  input: EmailOutreachFormattingInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.templates || draft.templates.length === 0) {
    flags.push({
      code: "empty-outreach-templates",
      message: "No outreach email templates were generated.",
      severity: "error",
    });
    feedback.push("Generate outreach email templates for all selected personas.");
  }

  const generatedPersonas = new Set(draft.templates?.map((t) => t.persona) ?? []);
  for (const expected of input.targetPersonas) {
    if (!generatedPersonas.has(expected)) {
      flags.push({
        code: "missing-persona-template",
        message: `Missing outreach template for expected persona "${expected}".`,
        severity: "warning",
      });
    }
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
