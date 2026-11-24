import type { TaskRunFlag } from "@/core/runs";
import type {
  InternalKickoffStrategyListDraft,
  InternalKickoffStrategyListInput,
} from "./schema";

export interface InternalKickoffStrategyListOutput {
  property: InternalKickoffStrategyListInput["property"];
  executiveOffPageVision: string;
  linkableAssets: InternalKickoffStrategyListDraft["linkableAssets"];
  outreachCategories: InternalKickoffStrategyListDraft["outreachCategories"];
  immediateNextSteps: string[];
  generatedAt: string;
}

export function renderInternalKickoffStrategyListOutput(opts: {
  input: InternalKickoffStrategyListInput;
  draft: InternalKickoffStrategyListDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: InternalKickoffStrategyListOutput } {
  const output: InternalKickoffStrategyListOutput = {
    property: opts.input.property,
    executiveOffPageVision: opts.draft.executiveOffPageVision,
    linkableAssets: opts.draft.linkableAssets ?? [],
    outreachCategories: opts.draft.outreachCategories ?? [],
    immediateNextSteps: opts.draft.immediateNextSteps ?? [],
    generatedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
