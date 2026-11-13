import type { CrawlRunRecord } from "@/core/crawler";
import type { TaskRunFlag } from "@/core/runs";

export interface SiteCrawlOutput {
  crawlRunId: string;
  taskRunId: string | null;
  status: CrawlRunRecord["status"];
  progress: {
    crawled: number;
    discovered: number;
  };
  siteSummary: CrawlRunRecord["siteSummary"];
  flags: TaskRunFlag[];
}

export function renderSiteCrawlOutput(run: CrawlRunRecord, flags: TaskRunFlag[]): SiteCrawlOutput {
  return {
    crawlRunId: run.id,
    taskRunId: run.taskRunId,
    status: run.status,
    progress: {
      crawled: run.pagesCrawled,
      discovered: run.pagesDiscovered,
    },
    siteSummary: run.siteSummary,
    flags,
  };
}

