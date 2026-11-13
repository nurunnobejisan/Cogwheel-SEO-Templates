import { NextResponse } from "next/server";
import { runKeywordResearchTask, TaskExecutionError } from "@/tasks/keyword-research";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Thin wrapper delegating to the registered `keyword-research` task. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const result = await runKeywordResearchTask(body);
    return NextResponse.json({
      ...result.output,
      runId: result.runId,
      flags: result.flags,
    });
  } catch (e) {
    if (e instanceof TaskExecutionError) {
      return NextResponse.json({ error: e.message, ...(e.details ?? {}) }, { status: e.statusCode });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
