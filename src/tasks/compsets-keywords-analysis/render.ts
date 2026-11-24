import type { TaskRunFlag } from "@/core/runs";
import type { CompsetsKeywordsAnalysisDraft, CompsetsKeywordsAnalysisInput } from "./schema";

export interface CompsetsKeywordsAnalysisOutput {
  property: CompsetsKeywordsAnalysisInput["property"];
  compsetDomains: string[];
  totalGaps: number;
  averageOpportunityScore: number;
  marketSummary: string;
  topImmediateWins: string[];
  gaps: CompsetsKeywordsAnalysisDraft["gaps"];
  exportedAt: string;
}

export function renderCompsetsKeywordsAnalysisOutput(opts: {
  input: CompsetsKeywordsAnalysisInput;
  draft: CompsetsKeywordsAnalysisDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: CompsetsKeywordsAnalysisOutput } {
  const gaps = opts.draft.gaps ?? [];
  const avgScore =
    gaps.length > 0
      ? Math.round(gaps.reduce((acc, g) => acc + g.opportunityScore, 0) / gaps.length)
      : 0;

  const output: CompsetsKeywordsAnalysisOutput = {
    property: opts.input.property,
    compsetDomains: opts.input.compsetDomains,
    totalGaps: gaps.length,
    averageOpportunityScore: avgScore,
    marketSummary: opts.draft.marketSummary,
    topImmediateWins: opts.draft.topImmediateWins ?? [],
    gaps,
    exportedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
