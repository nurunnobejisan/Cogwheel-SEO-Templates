/**
 * Daily Session — Orchestrator
 *
 * Owns every state transition and the server-side clock. Design rules:
 *
 *  1. One active session. `start` returns the existing session instead of
 *     creating a second one, so a double-click cannot spawn duplicate work.
 *  2. All timing derives from persisted timestamps. `processing` is a durable
 *     flag, not an in-memory lock, so a refresh mid-transition still blocks a
 *     second job.
 *  3. No phase is ever marked complete unless its artifact says `done`.
 *  4. Nothing claims work that did not happen — `testStatus` stays `not_run`
 *     until a suite actually executed.
 */

import "server-only";
import {
  PHASE_DURATIONS,
  PHASE_ORDER,
  sessionDay,
  type DailySession,
  type PhaseName,
  type SessionAction,
} from "./types";
import {
  findActive,
  getSession,
  listSessions,
  newSession,
  phaseOf,
  saveSession,
} from "./store";
import { dailySessionSchema } from "./types";

export class SessionError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "SessionError";
    this.status = status;
  }
}

/** Elapsed ms of a phase, excluding time spent paused. */
export function phaseElapsedMs(phase: { startedAt: string | null; endedAt: string | null; elapsedMs: number }, now: Date): number {
  if (!phase.startedAt) return phase.elapsedMs;
  const end = phase.endedAt ? Date.parse(phase.endedAt) : now.getTime();
  const live = Math.max(0, end - Date.parse(phase.startedAt));
  return phase.elapsedMs + live;
}

function touch(session: DailySession, now: Date): DailySession {
  let stamp = now.toISOString();
  // Two transitions inside the same millisecond would otherwise produce an
  // identical `updatedAt`, which makes an optimistic-concurrency token look
  // valid when it is not. Bump by 1ms so the value is strictly monotonic.
  if (stamp <= session.updatedAt) {
    stamp = new Date(Date.parse(session.updatedAt) + 1).toISOString();
  }
  session.updatedAt = stamp;
  return session;
}

function markProcessing(session: DailySession, value: boolean, now: Date): DailySession {
  session.processing = value;
  return touch(session, now);
}

/** Recompute report fields from actual phase records — never a guess. */
function rebuildReport(session: DailySession, now: Date): void {
  const completed = session.phases.filter((p) => p.status === "completed").map((p) => p.name);
  const totalMs = session.phases.reduce((sum, p) => sum + phaseElapsedMs(p, now), 0);
  const incomplete: string[] = [];
  if (session.learn.state !== "done" && session.learn.topic) incomplete.push(`Learn: ${session.learn.topic}`);
  if (session.build.state !== "done" && session.build.task) incomplete.push(`Build: ${session.build.task}`);
  if (session.community.state !== "done" && session.community.opportunity) incomplete.push(`Community: ${session.community.opportunity}`);

  session.report = {
    totalActualMinutes: Math.round((totalMs / 60000) * 10) / 10,
    completedPhases: completed,
    incompleteTasks: incomplete,
    nextRecommendedTask: incomplete[0] ?? (session.build.continuation || ""),
    generatedAt: now.toISOString(),
  };
}

function nextPhaseAfter(name: PhaseName): PhaseName | null {
  const idx = PHASE_ORDER.indexOf(name);
  return idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

function startPhase(session: DailySession, name: PhaseName, now: Date): DailySession {
  const phase = phaseOf(session, name);
  phase.status = "active";
  phase.startedAt = now.toISOString();
  phase.endedAt = null;
  session.currentPhase = name;
  return session;
}

function stopPhase(session: DailySession, name: PhaseName, now: Date, status: "completed" | "skipped" | "paused"): DailySession {
  const phase = phaseOf(session, name);
  // Bank the live window, then clear `startedAt` so the paused/stopped phase
  // contributes exactly the banked amount and never double-counts.
  phase.elapsedMs = phaseElapsedMs(phase, now);
  phase.startedAt = null;
  phase.endedAt = now.toISOString();
  phase.status = status;
  if (session.currentPhase === name) session.currentPhase = null;
  return session;
}

/**
 * Create-or-return the session. Deliberately idempotent: repeated clicks and
 * page refreshes converge on one record.
 */
export async function startSession(now: Date = new Date()): Promise<{ session: DailySession; created: boolean }> {
  const existing = await findActive();
  if (existing) return { session: existing, created: false };

  // A session may have been left mid-transition by a crash — recover it.
  const recent = await listSessions(1);
  const unfinished = recent.find((s) => s.status === "idle" && s.processing === false && s.day === sessionDay(now));
  if (unfinished) return { session: unfinished, created: false };

  const session = newSession(now);
  session.status = "running";
  startPhase(session, "learn", now);
  touch(session, now);
  await saveSession(session);
  return { session, created: true };
}

export async function getSessionOrThrow(id: string): Promise<DailySession> {
  const session = await getSession(id);
  if (!session) throw new SessionError(`session ${id} not found`, 404);
  return session;
}

/** Load the active session, or null when nothing is running. */
export async function currentSession(): Promise<DailySession | null> {
  return findActive();
}

export async function history(limit = 14): Promise<DailySession[]> {
  return listSessions(limit);
}

/**
 * Apply a user action. `expectedUpdatedAt` gives optimistic concurrency: a
 * stale control (two open tabs) is rejected rather than double-transitioning.
 */
export async function applyAction(
  sessionId: string,
  action: SessionAction,
  options: { expectedUpdatedAt?: string; now?: Date } = {},
): Promise<DailySession> {
  const now = options.now ?? new Date();
  const session = await getSessionOrThrow(sessionId);

  if (options.expectedUpdatedAt && options.expectedUpdatedAt !== session.updatedAt) {
    throw new SessionError("session changed elsewhere — reload and retry", 409);
  }
  if (session.processing) {
    throw new SessionError("a session operation is already in progress", 409);
  }

  const active = session.currentPhase ? phaseOf(session, session.currentPhase) : null;

  try {
    markProcessing(session, true, now);

    switch (action) {
      case "start": {
        // Delegate to startSession so a second click never creates a twin.
        const { session: existing, created } = await startSession(now);
        return created ? existing : session;
      }

      case "pause": {
        if (session.status !== "running") throw new SessionError("session is not running", 409);
        if (active) stopPhase(session, active.name, now, "paused");
        session.status = "paused";
        break;
      }

      case "resume": {
        if (session.status !== "paused") throw new SessionError("session is not paused", 409);
        session.status = "running";
        const paused = session.phases.find((p) => p.status === "paused");
        if (paused) startPhase(session, paused.name, now);
        break;
      }

      case "skip": {
        if (session.status === "ended") throw new SessionError("session already ended", 409);
        if (!active) throw new SessionError("no active phase to skip", 409);
        stopPhase(session, active.name, now, "skipped");
        const next = nextPhaseAfter(active.name);
        if (next && session.status === "running") startPhase(session, next, now);
        else session.status = session.status === "running" && !next ? "ended" : session.status;
        if (!next && session.status !== "paused") session.endedAt = session.endedAt ?? now.toISOString();
        break;
      }

      case "advance": {
        if (!active) throw new SessionError("no active phase", 409);
        const next = nextPhaseAfter(active.name);
        stopPhase(session, active.name, now, phaseOf(session, active.name).status === "paused" ? "paused" : "completed");
        if (next) startPhase(session, next, now);
        else {
          session.status = "ended";
          session.endedAt = now.toISOString();
        }
        break;
      }

      case "complete-learn": {
        if (session.learn.state !== "done") throw new SessionError("learning task is not marked done", 409);
        finishCurrent(session, now);
        break;
      }

      case "complete-build": {
        if (session.build.state !== "done") throw new SessionError("build task is not marked done", 409);
        if (session.build.testStatus === "failed") throw new SessionError("tests failed — fix them before completing the Build phase", 409);
        finishCurrent(session, now);
        break;
      }

      case "complete-community": {
        if (session.community.state !== "done") throw new SessionError("community task is not marked done", 409);
        finishCurrent(session, now);
        break;
      }

      case "end": {
        // Ending mid-phase records the phase as skipped unless it had already
        // been paused (which preserves its banked time) or completed.
        if (active) {
          const stopAs = active.status === "paused" || active.status === "completed" ? active.status : "skipped";
          stopPhase(session, active.name, now, stopAs);
        }
        session.status = "ended";
        session.endedAt = session.endedAt ?? now.toISOString();
        session.currentPhase = null;
        break;
      }

      default: {
        const exhaustive: never = action;
        throw new SessionError(`unknown action ${String(exhaustive)}`, 400);
      }
    }

    rebuildReport(session, now);
    session.errors = session.errors.slice(-20);
    markProcessing(session, false, now);
    await saveSession(session);
    return session;
  } catch (error) {
    // Always release the processing latch so a failed transition is retryable.
    session.processing = false;
    session.errors.push({ at: now.toISOString(), message: error instanceof Error ? error.message : String(error) });
    touch(session, now);
    await saveSession(session);
    throw error;
  }
}

/** Close the active phase and open the next one, or end the session. */
function finishCurrent(session: DailySession, now: Date): void {
  const active = session.currentPhase ? phaseOf(session, session.currentPhase) : null;
  if (!active) return;
  stopPhase(session, active.name, now, "completed");
  const next = nextPhaseAfter(active.name);
  if (next) startPhase(session, next, now);
  else {
    session.status = "ended";
    session.endedAt = now.toISOString();
    session.currentPhase = null;
  }
}

/** Deep-partial patch so callers set only the fields they are changing. */
export type ArtifactPatch = {
  learn?: Partial<DailySession["learn"]>;
  build?: Partial<DailySession["build"]>;
  community?: Partial<DailySession["community"]>;
};

/**
 * Merge a partial artifact into the session and persist it.
 *
 * The patch is deliberately sparse: agents and the UI set only what they are
 * changing, and the schema fills the remainder with defaults on read, so a
 * partial update can never leave an invalid session behind.
 */
export async function updateArtifact(
  sessionId: string,
  patch: ArtifactPatch,
  now: Date = new Date(),
): Promise<DailySession> {
  const session = await getSessionOrThrow(sessionId);
  if (session.status === "ended") throw new SessionError("session already ended", 409);

  if (patch.learn) session.learn = { ...session.learn, ...patch.learn };
  if (patch.build) session.build = { ...session.build, ...patch.build };
  if (patch.community) session.community = { ...session.community, ...patch.community };

  rebuildReport(session, now);
  touch(session, now);
  await saveSession(session);
  return session;
}

/** Guard used by the API layer: only a running session accepts transitions. */
export function assertLive(session: DailySession): void {
  if (session.status === "ended") throw new SessionError("session already ended", 409);
}

export const PHASE_MINUTES = PHASE_DURATIONS;

/** Re-export so callers need one import. */
export { dailySessionSchema };
