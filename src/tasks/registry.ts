import type { PipelineResult } from "@/core/pipeline";
import { runHeadingStructureTask } from "@/tasks/heading-structure";
import { runKeywordResearchTask } from "@/tasks/keyword-research";
import { runSeoBaselineAiVisibility } from "@/tasks/seo-baseline-ai-visibility";
import { runSeoOnlyVisibilityReport } from "@/tasks/seo-only-visibility-report";
import { runSiteCrawlTask } from "@/tasks/site-crawl";
import { getTaskConfig, type TaskConfig } from "@/tasks/tasks.config";
import { runTitleMetaTask } from "@/tasks/title-meta";
import { runUspHeadlineTask } from "@/tasks/usp-headline-optimization";

export type TaskRunner = (rawInput: unknown) => Promise<PipelineResult<unknown>>;

export const TASK_RUNNERS: Record<string, TaskRunner> = {
  "seo-baseline-ai-visibility": runSeoBaselineAiVisibility,
  "keyword-research": runKeywordResearchTask,
  "usp-headline-optimization": runUspHeadlineTask,
  "site-crawl": runSiteCrawlTask,
  "title-meta": runTitleMetaTask,
  "heading-structure": runHeadingStructureTask,
  "seo-only-visibility-report": runSeoOnlyVisibilityReport,
};

export function resolveTaskRunner(taskId: string): {
  config: TaskConfig | undefined;
  runner: TaskRunner | undefined;
} {
  return {
    config: getTaskConfig(taskId),
    runner: TASK_RUNNERS[taskId],
  };
}

