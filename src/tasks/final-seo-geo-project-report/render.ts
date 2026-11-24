import type { TaskRunFlag } from "@/core/runs";
import type {
  FinalSeoGeoProjectReportDraft,
  FinalSeoGeoProjectReportInput,
} from "./schema";

export interface FinalSeoGeoProjectReportOutput {
  property: FinalSeoGeoProjectReportInput["property"];
  engagementPeriod: {
    start: string;
    end: string;
  };
  overallProjectScore: number;
  executiveSummary: string;
  deliverableMilestones: FinalSeoGeoProjectReportDraft["deliverableMilestones"];
  quantifiableResults: FinalSeoGeoProjectReportDraft["quantifiableResults"];
  ongoingMaintenanceChecklist: string[];
  strategicRoadmapNext12Months: string[];
  completedDeliverablesCount: number;
  reportCompletedAt: string;
}

export function renderFinalProjectReportOutput(opts: {
  input: FinalSeoGeoProjectReportInput;
  draft: FinalSeoGeoProjectReportDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: FinalSeoGeoProjectReportOutput } {
  const output: FinalSeoGeoProjectReportOutput = {
    property: opts.input.property,
    engagementPeriod: {
      start: opts.input.engagementStartDate,
      end: opts.input.engagementEndDate,
    },
    overallProjectScore: opts.draft.overallProjectScore,
    executiveSummary: opts.draft.executiveSummary,
    deliverableMilestones: opts.draft.deliverableMilestones ?? [],
    quantifiableResults: opts.draft.quantifiableResults,
    ongoingMaintenanceChecklist: opts.draft.ongoingMaintenanceChecklist ?? [],
    strategicRoadmapNext12Months: opts.draft.strategicRoadmapNext12Months ?? [],
    completedDeliverablesCount: opts.draft.deliverableMilestones?.length ?? 0,
    reportCompletedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
