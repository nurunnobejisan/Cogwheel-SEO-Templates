import { NextResponse } from "next/server";
import { listTaskRuns } from "@/core/runs";
import { getTaskConfig } from "@/tasks/tasks.config";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: { taskId: string } }) {
  const { taskId } = context.params;
  const config = getTaskConfig(taskId);
  if (!config) {
    return NextResponse.json({ error: `Unknown taskId: ${taskId}` }, { status: 404 });
  }

  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") || undefined;
  const runs = await listTaskRuns(taskId, propertyId);

  return NextResponse.json({
    taskId: config.id,
    runs,
  });
}

