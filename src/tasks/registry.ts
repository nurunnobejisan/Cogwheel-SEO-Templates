import type { PipelineResult } from "@/core/pipeline";
import { runAiSeoVisibilityReportTask } from "@/tasks/ai-seo-visibility-report";
import { runBacklinkingStrategyExecutionTask } from "@/tasks/backlinking-strategy-execution";
import { runCompetitorsBacklinkAnalysisTask } from "@/tasks/competitors-backlink-analysis";
import { runCompsetsKeywordsAnalysisTask } from "@/tasks/compsets-keywords-analysis";
import { runDuplicateContentAuditTask } from "@/tasks/duplicate-content-audit";
import { runEmailOutreachFormattingTask } from "@/tasks/email-outreach-formatting";
import { runFinalSeoGeoProjectReportTask } from "@/tasks/final-seo-geo-project-report";
import { runGoogleMapCitationTask } from "@/tasks/google-map-citation";
import { runHeadingStructureTask } from "@/tasks/heading-structure";
import { runImageOptimizationTask } from "@/tasks/image-optimization";
import { runInternalKickoffStrategyListTask } from "@/tasks/internal-kickoff-strategy-list";
import { runKeywordRankingReportCompSetTask } from "@/tasks/keyword-ranking-report-comp-set";
import { runKeywordResearchTask } from "@/tasks/keyword-research";
import { runSchemaMarkupTask } from "@/tasks/schema-markup";
import { runSeoBaselineAiVisibility } from "@/tasks/seo-baseline-ai-visibility";
import { runSeoOnlyVisibilityReport } from "@/tasks/seo-only-visibility-report";
import { runSiteCrawlTask } from "@/tasks/site-crawl";
import { runSiteTechReAuditReportTask } from "@/tasks/site-tech-re-audit-report";
import { runSitemapNavigationOptimizationTask } from "@/tasks/sitemap-navigation-optimization";
import { getTaskConfig, type TaskConfig } from "@/tasks/tasks.config";
import { runTechnicalAuditTask } from "@/tasks/technical-audit";
import { runTitleMetaTask } from "@/tasks/title-meta";
import { runUspHeadlineTask } from "@/tasks/usp-headline-optimization";

export type TaskRunner = (rawInput: unknown) => Promise<PipelineResult<unknown>>;

export const TASK_RUNNERS: Record<string, TaskRunner> = {
  // On Page
  "seo-baseline-ai-visibility": runSeoBaselineAiVisibility,
  "keyword-research": runKeywordResearchTask,
  "compsets-keywords-analysis": runCompsetsKeywordsAnalysisTask,
  "keyword-ranking-report-comp-set": runKeywordRankingReportCompSetTask,
  "title-meta": runTitleMetaTask,
  "usp-headline-optimization": runUspHeadlineTask,
  "heading-structure": runHeadingStructureTask,
  "image-optimization": runImageOptimizationTask,

  // Technical
  "site-crawl": runSiteCrawlTask,
  "technical-audit": runTechnicalAuditTask,
  "sitemap-navigation-optimization": runSitemapNavigationOptimizationTask,
  "duplicate-content-audit": runDuplicateContentAuditTask,
  "schema-markup": runSchemaMarkupTask,
  "site-tech-re-audit-report": runSiteTechReAuditReportTask,

  // Off Page
  "internal-kickoff-strategy-list": runInternalKickoffStrategyListTask,
  "email-outreach-formatting": runEmailOutreachFormattingTask,
  "competitors-backlink-analysis": runCompetitorsBacklinkAnalysisTask,
  "backlinking-strategy-execution": runBacklinkingStrategyExecutionTask,

  // Local
  "google-map-citation": runGoogleMapCitationTask,

  // Reporting
  "seo-only-visibility-report": runSeoOnlyVisibilityReport,
  "ai-seo-visibility-report": runAiSeoVisibilityReportTask,
  "final-seo-geo-project-report": runFinalSeoGeoProjectReportTask,
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
