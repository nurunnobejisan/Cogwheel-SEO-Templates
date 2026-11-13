import { NextResponse } from "next/server";
import { TaskExecutionError } from "@/tasks/keyword-research";
import { resolveTaskRunner } from "@/tasks/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, context: { params: { taskId: string } }) {
  const { taskId } = context.params;
  const { config, runner } = resolveTaskRunner(taskId);

  if (!config) {
    return NextResponse.json({ error: `Unknown taskId: ${taskId}` }, { status: 404 });
  }

  if (!runner) {
    return NextResponse.json(
      {
        error: `Task "${config.name}" (${config.id}) is scheduled for Phase ${config.phase} and is not yet implemented.`,
        taskId: config.id,
        phase: config.phase,
        status: config.status,
      },
      { status: 501 },
    );
  }

  const body = await req.json().catch(() => null);
  try {
    const result = await runner(body);
    return NextResponse.json({
      runId: result.runId,
      taskId: result.taskId,
      status: result.status,
      outputUrl: result.outputUrl,
      flags: result.flags,
      retries: result.retries,
      data: result.output,
    });
  } catch (e) {
    if (e instanceof TaskExecutionError) {
      return NextResponse.json({ error: e.message, ...(e.details ?? {}) }, { status: e.statusCode });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

