import type { PipelineResult } from "@/core/pipeline";
import { runHeadingStructureTask } from "@/tasks/heading-structure";
import { runKeywordResearchTask } from "@/tasks/keyword-research";
import { runSiteCrawlTask } from "@/tasks/site-crawl";
import { getTaskConfig, type TaskConfig } from "@/tasks/tasks.config";
import { runTitleMetaTask } from "@/tasks/title-meta";
import { runUspHeadlineTask } from "@/tasks/usp-headline-optimization";

export type TaskRunner = (rawInput: unknown) => Promise<PipelineResult<unknown>>;

export const TASK_RUNNERS: Record<string, TaskRunner> = {
  "keyword-research": runKeywordResearchTask,
  "usp-headline-optimization": runUspHeadlineTask,
  "site-crawl": runSiteCrawlTask,
  "title-meta": runTitleMetaTask,
  "heading-structure": runHeadingStructureTask,
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

