import type { TaskRunFlag } from "@/core/runs";
import { summarizeTaskFlags, type TaskFlagSummary } from "@/tasks/contract";
import type { SeoVisibilityNarrativeDraft, SeoVisibilityReportInput, SeoVisibilitySummary } from "./schema";

export interface SeoVisibilityReportOutput {
  propertyName: string;
  downloadName: string | null;
  summary: SeoVisibilitySummary;
  executiveSummary: string;
  highlights: string[];
  deterministicFindings: string[];
  flagSummary: TaskFlagSummary;
}

export function renderSeoVisibilityReportOutput(opts: {
  input: SeoVisibilityReportInput;
  draft: SeoVisibilityNarrativeDraft;
  deterministicFindings: string[];
  flags: TaskRunFlag[];
}): SeoVisibilityReportOutput {
  return {
    propertyName: opts.input.summary.property_name,
    downloadName: opts.input.downloadName ?? null,
    summary: opts.input.summary,
    executiveSummary: opts.draft.executiveSummary,
    highlights: opts.draft.highlights,
    deterministicFindings: opts.deterministicFindings,
    flagSummary: summarizeTaskFlags(opts.flags),
  };
}

