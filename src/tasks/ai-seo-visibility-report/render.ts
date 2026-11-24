import type { TaskRunFlag } from "@/core/runs";
import type {
  AiSeoVisibilityReportDraft,
  AiSeoVisibilityReportInput,
} from "./schema";

export interface AiSeoVisibilityReportOutput {
  property: AiSeoVisibilityReportInput["property"];
  quarterPeriod: string;
  combinedScore: number;
  executiveOverview: string;
  organicSeoTrends: AiSeoVisibilityReportDraft["organicSeoTrends"];
  geoPlatformMetrics: AiSeoVisibilityReportDraft["geoPlatformMetrics"];
  topAiCitationsEarned: AiSeoVisibilityReportDraft["topAiCitationsEarned"];
  strategicActionsNextQuarter: string[];
  reportGeneratedAt: string;
}

export function renderAiSeoVisibilityReportOutput(opts: {
  input: AiSeoVisibilityReportInput;
  draft: AiSeoVisibilityReportDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: AiSeoVisibilityReportOutput } {
  const output: AiSeoVisibilityReportOutput = {
    property: opts.input.property,
    quarterPeriod: opts.input.quarterPeriod,
    combinedScore: opts.draft.combinedScore,
    executiveOverview: opts.draft.executiveOverview,
    organicSeoTrends: opts.draft.organicSeoTrends,
    geoPlatformMetrics: opts.draft.geoPlatformMetrics ?? [],
    topAiCitationsEarned: opts.draft.topAiCitationsEarned ?? [],
    strategicActionsNextQuarter: opts.draft.strategicActionsNextQuarter ?? [],
    reportGeneratedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
