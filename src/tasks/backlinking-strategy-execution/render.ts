import type { TaskRunFlag } from "@/core/runs";
import type {
  BacklinkingStrategyExecutionDraft,
  BacklinkingStrategyExecutionInput,
} from "./schema";

export interface BacklinkingStrategyExecutionOutput {
  property: BacklinkingStrategyExecutionInput["property"];
  roadmapPhases: BacklinkingStrategyExecutionDraft["roadmapPhases"];
  outreachPipeline: BacklinkingStrategyExecutionDraft["outreachPipeline"];
  kpiTargets: BacklinkingStrategyExecutionDraft["kpiTargets"];
  pipelineCount: number;
  plannedAt: string;
}

export function renderBacklinkingStrategyExecutionOutput(opts: {
  input: BacklinkingStrategyExecutionInput;
  draft: BacklinkingStrategyExecutionDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: BacklinkingStrategyExecutionOutput } {
  const output: BacklinkingStrategyExecutionOutput = {
    property: opts.input.property,
    roadmapPhases: opts.draft.roadmapPhases ?? [],
    outreachPipeline: opts.draft.outreachPipeline ?? [],
    kpiTargets: opts.draft.kpiTargets,
    pipelineCount: opts.draft.outreachPipeline?.length ?? 0,
    plannedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
