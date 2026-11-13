import type { PipelineResult } from "@/core/pipeline";
import { runKeywordResearchTask } from "@/tasks/keyword-research";
import { getTaskConfig, type TaskConfig } from "@/tasks/tasks.config";
import { runUspHeadlineTask } from "@/tasks/usp-headline-optimization";

export type TaskRunner = (rawInput: unknown) => Promise<PipelineResult<unknown>>;

export const TASK_RUNNERS: Record<string, TaskRunner> = {
  "keyword-research": runKeywordResearchTask,
  "usp-headline-optimization": runUspHeadlineTask,
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

