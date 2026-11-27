/**
 * Daily Session — Store
 *
 * Wraps the existing platform persistence adapter so sessions survive a page
 * refresh, a process restart, and (with Supabase configured) a serverless
 * redeploy. One session can be active at a time — `findActive` is the single
 * source of truth the API consults before creating anything.
 */

import "server-only";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PersistenceAdapter } from "../../../platform/persistence/adapter.ts";
import { createJsonFileAdapter } from "../../../platform/persistence/jsonl-adapter.ts";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import { seoStudioDataDir } from "@/lib/platform/data-dir";
import {
  dailySessionSchema,
  PHASE_DURATIONS,
  PHASE_ORDER,
  sessionDay,
  type DailySession,
  type PhaseName,
  type PhaseRecord,
} from "./types";

export const SESSION_COLLECTION = "daily_sessions";

let defaultAdapter: PersistenceAdapter | null = null;

/** NDJSON adapter on a writable local dir; Supabase when credentials exist. */
export function getSessionAdapter(): PersistenceAdapter {
  if (defaultAdapter) return defaultAdapter;

  if (isSupabaseConfigured()) {
    defaultAdapter = createSupabaseSessionAdapter();
  } else {
    defaultAdapter = createJsonFileAdapter({ dir: path.join(seoStudioDataDir(), "daily-session") });
  }
  return defaultAdapter;
}

/** Test seam: replace the adapter (memory adapter in unit tests). */
export function setSessionAdapter(adapter: PersistenceAdapter | null): void {
  defaultAdapter = adapter;
}

function createSupabaseSessionAdapter(): PersistenceAdapter {
  return {
    async readAll<T>(collection: string): Promise<T[]> {
      const db = getSupabase();
      const { data, error } = await db.from(collection).select("*").order("created_at", { ascending: true });
      if (error) throw new Error(`daily session read failed: ${error.message}`);
      return (data ?? []).map(rowToSession) as T[];
    },
    async append<T>(collection: string, record: T): Promise<void> {
      await this.put(collection, (record as { id: string }).id, record);
      void collection;
    },
    async put<T>(collection: string, key: string, record: T): Promise<void> {
      const db = getSupabase();
      const { error } = await db.from(collection).upsert(sessionToRow(key, record as DailySession));
      if (error) throw new Error(`daily session write failed: ${error.message}`);
    },
    async remove(collection: string, key: string): Promise<void> {
      const db = getSupabase();
      const { error } = await db.from(collection).delete().eq("id", key);
      if (error) throw new Error(`daily session delete failed: ${error.message}`);
    },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function sessionToRow(id: string, s: DailySession): Record<string, any> {
  return {
    id,
    status: s.status,
    day: s.day,
    current_phase: s.currentPhase,
    payload: s as any,
    updated_at: new Date().toISOString(),
    created_at: s.createdAt,
  };
}

function rowToSession(row: any): DailySession {
  return row.payload ?? row;
}

function blankPhases(): PhaseRecord[] {
  return PHASE_ORDER.map((name) => ({
    name,
    status: "pending" as const,
    durationMinutes: PHASE_DURATIONS[name],
    startedAt: null,
    endedAt: null,
    elapsedMs: 0,
  }));
}

/** Fresh session skeleton. `status: "idle"` until the operator presses Start. */
export function newSession(now: Date = new Date()): DailySession {
  const iso = now.toISOString();
  return dailySessionSchema.parse({
    id: randomUUID(),
    status: "idle",
    createdAt: iso,
    updatedAt: iso,
    endedAt: null,
    currentPhase: null,
    phases: blankPhases(),
    learn: { topic: "", explanation: "", example: "", projectRelation: "", knowledgeCheck: "", notePath: null, noteSaved: false, noteBlockedReason: null, state: "not_started" },
    build: { task: "", plan: [], branch: null, prUrl: null, filesChanged: [], testsRun: "", testStatus: "not_run", summary: "", continuation: "", state: "not_started" },
    community: { opportunity: "", repository: null, draft: "", approvalStatus: "none", posted: false, state: "not_started" },
    report: { totalActualMinutes: 0, completedPhases: [], incompleteTasks: [], nextRecommendedTask: "", generatedAt: null },
    errors: [],
    processing: false,
    day: sessionDay(now),
  });
}

/**
 * Deep-copy a record read from the store.
 *
 * The NDJSON/Supabase adapters already return fresh objects, but the in-memory
 * adapter (and any future cached adapter) may hand back a live reference.
 * Cloning here guarantees a caller can never mutate persisted state by
 * accident, and it is what makes optimistic-concurrency checks meaningful: a
 * stale token stays stale instead of being mutated in place.
 */
function detach<T>(record: T): T {
  return JSON.parse(JSON.stringify(record)) as T;
}

/** The single active session (running or paused), else null. */
export async function findActive(): Promise<DailySession | null> {
  const all = await getSessionAdapter().readAll<DailySession>(SESSION_COLLECTION);
  const active = all.find((s) => s && (s.status === "running" || s.status === "paused"));
  return active ? detach(active) : null;
}

export async function getSession(id: string): Promise<DailySession | null> {
  const all = await getSessionAdapter().readAll<DailySession>(SESSION_COLLECTION);
  const found = all.find((s) => s && s.id === id);
  return found ? detach(found) : null;
}

/** Most recent sessions, newest first, capped for the history panel. */
export async function listSessions(limit = 14): Promise<DailySession[]> {
  const all = await getSessionAdapter().readAll<DailySession>(SESSION_COLLECTION);
  return all
    .filter(Boolean)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map(detach);
}

export async function saveSession(session: DailySession): Promise<void> {
  await getSessionAdapter().put(SESSION_COLLECTION, session.id, session);
}

/** Sessions from `day` that already saved a note for `topic` (dedupe guard). */
export async function hasNoteForToday(topic: string, day = sessionDay()): Promise<boolean> {
  const all = await getSessionAdapter().readAll<DailySession>(SESSION_COLLECTION);
  return all.some(
    (s) =>
      s &&
      s.day === day &&
      s.learn.noteSaved &&
      s.learn.topic.trim().toLowerCase() === topic.trim().toLowerCase(),
  );
}

/** Phase lookup with a typed result; unknown names are impossible by schema. */
export function phaseOf(session: DailySession, name: PhaseName): PhaseRecord {
  const phase = session.phases.find((p) => p.name === name);
  if (!phase) throw new Error(`phase ${name} missing from session ${session.id}`);
  return phase;
}
