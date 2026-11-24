import type { TaskRunFlag } from "@/core/runs";
import type {
  CompetitorsBacklinkAnalysisDraft,
  CompetitorsBacklinkAnalysisInput,
} from "./schema";

export interface CompetitorsBacklinkAnalysisOutput {
  property: CompetitorsBacklinkAnalysisInput["property"];
  compsetDomains: string[];
  backlinkShareOfVoice: CompetitorsBacklinkAnalysisDraft["backlinkShareOfVoice"];
  referringDomainGaps: CompetitorsBacklinkAnalysisDraft["referringDomainGaps"];
  highValueDirectoryCitations: string[];
  strategicRecommendations: string[];
  analyzedAt: string;
}

export function renderCompetitorsBacklinkAnalysisOutput(opts: {
  input: CompetitorsBacklinkAnalysisInput;
  draft: CompetitorsBacklinkAnalysisDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: CompetitorsBacklinkAnalysisOutput } {
  const output: CompetitorsBacklinkAnalysisOutput = {
    property: opts.input.property,
    compsetDomains: opts.input.compsetDomains,
    backlinkShareOfVoice: opts.draft.backlinkShareOfVoice,
    referringDomainGaps: opts.draft.referringDomainGaps ?? [],
    highValueDirectoryCitations: opts.draft.highValueDirectoryCitations ?? [],
    strategicRecommendations: opts.draft.strategicRecommendations ?? [],
    analyzedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
