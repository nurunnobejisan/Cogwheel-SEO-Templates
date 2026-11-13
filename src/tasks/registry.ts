import type { PipelineResult } from "@/core/pipeline";
import { runDuplicateContentAuditTask } from "@/tasks/duplicate-content-audit";
import { runHeadingStructureTask } from "@/tasks/heading-structure";
import { runImageOptimizationTask } from "@/tasks/image-optimization";
import { runKeywordResearchTask } from "@/tasks/keyword-research";
import { runSchemaMarkupTask } from "@/tasks/schema-markup";
import { runSeoBaselineAiVisibility } from "@/tasks/seo-baseline-ai-visibility";
import { runSeoOnlyVisibilityReport } from "@/tasks/seo-only-visibility-report";
import { runSiteCrawlTask } from "@/tasks/site-crawl";
import { getTaskConfig, type TaskConfig } from "@/tasks/tasks.config";
import { runTechnicalAuditTask } from "@/tasks/technical-audit";
import { runTitleMetaTask } from "@/tasks/title-meta";
import { runUspHeadlineTask } from "@/tasks/usp-headline-optimization";

export type TaskRunner = (rawInput: unknown) => Promise<PipelineResult<unknown>>;

export const TASK_RUNNERS: Record<string, TaskRunner> = {
  "seo-baseline-ai-visibility": runSeoBaselineAiVisibility,
  "keyword-research": runKeywordResearchTask,
  "usp-headline-optimization": runUspHeadlineTask,
  "image-optimization": runImageOptimizationTask,
  "site-crawl": runSiteCrawlTask,
  "technical-audit": runTechnicalAuditTask,
  "duplicate-content-audit": runDuplicateContentAuditTask,
  "schema-markup": runSchemaMarkupTask,
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

