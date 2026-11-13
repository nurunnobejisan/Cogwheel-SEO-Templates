import { NextResponse } from "next/server";
import { TaskExecutionError } from "@/tasks/keyword-research";
import { runSiteCrawlTask } from "@/tasks/site-crawl";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Starts a new Site Crawl or advances the next batch for an existing `crawlRunId`.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const result = await runSiteCrawlTask(body);
    return NextResponse.json({
      runId: result.runId,
      taskId: result.taskId,
      status: result.status,
      outputUrl: result.outputUrl,
      flags: result.flags,
      data: result.output,
    });
  } catch (e) {
    if (e instanceof TaskExecutionError) {
      return NextResponse.json({ error: e.message, ...(e.details ?? {}) }, { status: e.statusCode });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
