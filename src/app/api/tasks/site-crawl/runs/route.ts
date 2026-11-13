import { NextResponse } from "next/server";
import { getCrawlRun, listCrawlRuns } from "@/core/crawler";
import { listTaskRuns } from "@/core/runs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const crawlRunId = url.searchParams.get("crawlRunId");
  const propertyId = url.searchParams.get("propertyId") || undefined;

  if (crawlRunId) {
    const crawlRun = await getCrawlRun(crawlRunId);
    if (!crawlRun) {
      return NextResponse.json({ error: `Crawl run ${crawlRunId} not found` }, { status: 404 });
    }
    return NextResponse.json({
      crawlRun: {
        id: crawlRun.id,
        propertyId: crawlRun.propertyId,
        taskRunId: crawlRun.taskRunId,
        startUrl: crawlRun.startUrl,
        status: crawlRun.status,
        progress: {
          crawled: crawlRun.pagesCrawled,
          discovered: crawlRun.pagesDiscovered,
        },
        startedAt: crawlRun.startedAt,
        finishedAt: crawlRun.finishedAt,
        siteSummary: crawlRun.siteSummary,
      },
    });
  }

  const [crawlRuns, taskRuns] = await Promise.all([
    listCrawlRuns(propertyId),
    listTaskRuns("site-crawl", propertyId),
  ]);

  return NextResponse.json({
    taskId: "site-crawl",
    runs: taskRuns,
    crawlRuns: crawlRuns.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      taskRunId: r.taskRunId,
      startUrl: r.startUrl,
      status: r.status,
      progress: {
        crawled: r.pagesCrawled,
        discovered: r.pagesDiscovered,
      },
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      siteSummary: r.siteSummary,
    })),
  });
}

