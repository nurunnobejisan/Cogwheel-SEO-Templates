import type { TaskRunFlag } from "@/core/runs";
import type {
  SiteTechReAuditReportDraft,
  SiteTechReAuditReportInput,
} from "./schema";

export interface SiteTechReAuditReportOutput {
  property: SiteTechReAuditReportInput["property"];
  baselineDate: string;
  metrics: SiteTechReAuditReportDraft["metrics"];
  issueDeltas: SiteTechReAuditReportDraft["issueDeltas"];
  overallHealthStatus: SiteTechReAuditReportDraft["overallHealthStatus"];
  executiveSummary: string;
  nextActionChecklist: string[];
  reAuditedAt: string;
}

export function renderSiteTechReAuditReportOutput(opts: {
  input: SiteTechReAuditReportInput;
  draft: SiteTechReAuditReportDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: SiteTechReAuditReportOutput } {
  const output: SiteTechReAuditReportOutput = {
    property: opts.input.property,
    baselineDate: opts.input.baselineDate ?? "Initial Baseline",
    metrics: opts.draft.metrics,
    issueDeltas: opts.draft.issueDeltas ?? [],
    overallHealthStatus: opts.draft.overallHealthStatus,
    executiveSummary: opts.draft.executiveSummary,
    nextActionChecklist: opts.draft.nextActionChecklist ?? [],
    reAuditedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
