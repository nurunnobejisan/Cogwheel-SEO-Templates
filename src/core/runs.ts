import { randomUUID } from "node:crypto";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TaskStatus } from "@/tasks/tasks.config";

export interface TaskRunFlag {
  code: string;
  message: string;
  severity: "warning" | "error";
  section?: string;
}

export interface TaskRunRecord {
  id: string;
  propertyId: string | null;
  taskId: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  flags: TaskRunFlag[];
  status: TaskStatus;
  outputUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const memoryRuns: TaskRunRecord[] = [];

export async function createTaskRun(opts: {
  propertyId: string | null;
  taskId: string;
  inputs: Record<string, unknown>;
}): Promise<TaskRunRecord> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured() || !opts.propertyId) {
    const rec: TaskRunRecord = {
      id: randomUUID(),
      propertyId: opts.propertyId,
      taskId: opts.taskId,
      inputs: opts.inputs,
      outputs: {},
      flags: [],
      status: "Running",
      outputUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    memoryRuns.unshift(rec);
    if (memoryRuns.length > 100) memoryRuns.pop();
    return rec;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("task_runs")
    .insert({
      property_id: opts.propertyId,
      task_id: opts.taskId,
      inputs: opts.inputs,
      outputs: {},
      flags: [],
      status: "Running",
      output_url: null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create task_run");
  }

  return mapRowToRecord(data);
}

export async function updateTaskRun(
  runId: string,
  patch: {
    status: TaskStatus;
    outputs?: Record<string, unknown>;
    flags?: TaskRunFlag[];
    outputUrl?: string | null;
  },
): Promise<TaskRunRecord | null> {
  const now = new Date().toISOString();

  const memIdx = memoryRuns.findIndex((r) => r.id === runId);
  if (memIdx !== -1) {
    memoryRuns[memIdx] = {
      ...memoryRuns[memIdx],
      status: patch.status,
      outputs: patch.outputs ?? memoryRuns[memIdx].outputs,
      flags: patch.flags ?? memoryRuns[memIdx].flags,
      outputUrl: patch.outputUrl !== undefined ? patch.outputUrl : memoryRuns[memIdx].outputUrl,
      updatedAt: now,
    };
    return memoryRuns[memIdx];
  }

  if (!isSupabaseConfigured()) return null;

  const db = getSupabase();
  const { data, error } = await db
    .from("task_runs")
    .update({
      status: patch.status,
      ...(patch.outputs !== undefined ? { outputs: patch.outputs } : {}),
      ...(patch.flags !== undefined ? { flags: patch.flags } : {}),
      ...(patch.outputUrl !== undefined ? { output_url: patch.outputUrl } : {}),
      updated_at: now,
    })
    .eq("id", runId)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRowToRecord(data);
}

export async function listTaskRuns(taskId: string, propertyId?: string): Promise<TaskRunRecord[]> {
  if (!isSupabaseConfigured()) {
    return memoryRuns.filter((r) => r.taskId === taskId && (!propertyId || r.propertyId === propertyId));
  }

  const db = getSupabase();
  let query = db
    .from("task_runs")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return memoryRuns.filter((r) => r.taskId === taskId && (!propertyId || r.propertyId === propertyId));
  }
  return data.map(mapRowToRecord);
}

function mapRowToRecord(row: Record<string, unknown>): TaskRunRecord {
  return {
    id: row.id as string,
    propertyId: (row.property_id as string | null) ?? null,
    taskId: row.task_id as string,
    inputs: (row.inputs as Record<string, unknown>) ?? {},
    outputs: (row.outputs as Record<string, unknown>) ?? {},
    flags: (row.flags as TaskRunFlag[]) ?? [],
    status: row.status as TaskStatus,
    outputUrl: (row.output_url as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

