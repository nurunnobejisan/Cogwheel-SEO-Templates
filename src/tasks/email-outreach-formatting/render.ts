import type { TaskRunFlag } from "@/core/runs";
import type {
  EmailOutreachFormattingDraft,
  EmailOutreachFormattingInput,
} from "./schema";

export interface EmailOutreachFormattingOutput {
  property: EmailOutreachFormattingInput["property"];
  templatesCount: number;
  templates: EmailOutreachFormattingDraft["templates"];
  outreachBestPractices: string[];
  generatedAt: string;
}

export function renderEmailOutreachFormattingOutput(opts: {
  input: EmailOutreachFormattingInput;
  draft: EmailOutreachFormattingDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: EmailOutreachFormattingOutput } {
  const output: EmailOutreachFormattingOutput = {
    property: opts.input.property,
    templatesCount: opts.draft.templates?.length ?? 0,
    templates: opts.draft.templates ?? [],
    outreachBestPractices: opts.draft.outreachBestPractices ?? [],
    generatedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
