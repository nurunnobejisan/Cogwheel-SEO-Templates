import type { TaskRunFlag } from "@/core/runs";
import type {
  KeywordRankingReportCompSetDraft,
  KeywordRankingReportCompSetInput,
} from "./schema";

export interface KeywordRankingReportCompSetOutput {
  property: KeywordRankingReportCompSetInput["property"];
  compsetDomains: string[];
  totalKeywordsTracked: number;
  summary: KeywordRankingReportCompSetDraft["summary"];
  rankings: KeywordRankingReportCompSetDraft["rankings"];
  strategicInsights: string[];
  generatedAt: string;
}

export function renderKeywordRankingReportCompSetOutput(opts: {
  input: KeywordRankingReportCompSetInput;
  draft: KeywordRankingReportCompSetDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: KeywordRankingReportCompSetOutput } {
  const output: KeywordRankingReportCompSetOutput = {
    property: opts.input.property,
    compsetDomains: opts.input.compsetDomains,
    totalKeywordsTracked: opts.draft.rankings?.length ?? 0,
    summary: opts.draft.summary,
    rankings: opts.draft.rankings ?? [],
    strategicInsights: opts.draft.strategicInsights ?? [],
    generatedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
