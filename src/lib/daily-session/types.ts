/**
 * Daily Session — Domain Types
 *
 * Every transition is timestamped on the server. The browser renders elapsed
 * time from `phaseStartedAt`/`sessionStartedAt` returned by the API, never from
 * a locally incremented counter, so a refresh, a closed laptop, or a lost
 * connection cannot invent progress.
 */

import { z } from "zod";

/** Fixed phase lengths, in minutes. Total planned duration: 60. */
export const PHASE_DURATIONS = {
  learn: 15,
  build: 40,
  community: 5,
} as const;

export type PhaseName = keyof typeof PHASE_DURATIONS;
export const PHASE_ORDER: readonly PhaseName[] = ["learn", "build", "community"] as const;

export type PhaseStatus = "pending" | "active" | "paused" | "completed" | "skipped" | "unavailable";
export type SessionStatus = "idle" | "running" | "paused" | "ended";

export const phaseStatusSchema = z.enum(["pending", "active", "paused", "completed", "skipped", "unavailable"]);
export const sessionStatusSchema = z.enum(["idle", "running", "paused", "ended"]);

/** Explicit provenance so a phase never claims work it did not do. */
export type WorkState = "not_started" | "in_progress" | "done" | "blocked" | "unavailable";

export const workStateSchema = z.enum(["not_started", "in_progress", "done", "blocked", "unavailable"]);

export const learnArtifactSchema = z.object({
  topic: z.string().max(300),
  explanation: z.string().max(8000).default(""),
  example: z.string().max(8000).default(""),
  projectRelation: z.string().max(4000).default(""),
  knowledgeCheck: z.string().max(2000).default(""),
  notePath: z.string().max(500).nullable().default(null),
  noteSaved: z.boolean().default(false),
  /** Set when the note could not be written — explains exactly why. */
  noteBlockedReason: z.string().max(500).nullable().default(null),
  state: workStateSchema.default("not_started"),
});
export type LearnArtifact = z.infer<typeof learnArtifactSchema>;

export const buildArtifactSchema = z.object({
  task: z.string().max(500),
  plan: z.array(z.string().max(500)).default([]),
  branch: z.string().max(200).nullable().default(null),
  prUrl: z.string().max(500).nullable().default(null),
  filesChanged: z.array(z.string().max(500)).default([]),
  testsRun: z.string().max(2000).default(""),
  testStatus: z.enum(["not_run", "passed", "failed", "unavailable"]).default("not_run"),
  summary: z.string().max(8000).default(""),
  /** Continuation plan when the task did not fit inside the phase. */
  continuation: z.string().max(4000).default(""),
  state: workStateSchema.default("not_started"),
});
export type BuildArtifact = z.infer<typeof buildArtifactSchema>;

export const communityArtifactSchema = z.object({
  opportunity: z.string().max(1000).default(""),
  repository: z.string().max(200).nullable().default(null),
  draft: z.string().max(8000).default(""),
  approvalStatus: z.enum(["none", "pending_review", "approved", "rejected"]).default("none"),
  posted: z.boolean().default(false),
  state: workStateSchema.default("not_started"),
});
export type CommunityArtifact = z.infer<typeof communityArtifactSchema>;

export const phaseRecordSchema = z.object({
  name: z.enum(["learn", "build", "community"]),
  status: phaseStatusSchema,
  durationMinutes: z.number().int().positive(),
  /** Server timestamp when this phase became active. */
  startedAt: z.string().nullable().default(null),
  endedAt: z.string().nullable().default(null),
  /** Accumulated paused-free elapsed ms, recomputed from timestamps. */
  elapsedMs: z.number().int().nonnegative().default(0),
});
export type PhaseRecord = z.infer<typeof phaseRecordSchema>;

export const sessionReportSchema = z.object({
  totalActualMinutes: z.number().nonnegative().default(0),
  completedPhases: z.array(z.string()).default([]),
  incompleteTasks: z.array(z.string()).default([]),
  nextRecommendedTask: z.string().max(1000).default(""),
  generatedAt: z.string().nullable().default(null),
});
export type SessionReport = z.infer<typeof sessionReportSchema>;

export const dailySessionSchema = z.object({
  id: z.string().min(1),
  status: sessionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  endedAt: z.string().nullable().default(null),
  currentPhase: z.enum(["learn", "build", "community"]).nullable().default(null),
  phases: z.array(phaseRecordSchema).default([]),
  learn: learnArtifactSchema,
  build: buildArtifactSchema,
  community: communityArtifactSchema,
  report: sessionReportSchema,
  errors: z.array(z.object({ at: z.string(), message: z.string() })).default([]),
  /** True while a phase transition is running — blocks duplicate clicks. */
  processing: z.boolean().default(false),
  day: z.string(),
});
export type DailySession = z.infer<typeof dailySessionSchema>;

export type SessionAction =
  | "start"
  | "pause"
  | "resume"
  | "skip"
  | "end"
  | "advance"
  | "complete-learn"
  | "complete-build"
  | "complete-community";

export const actionSchema = z.enum([
  "start",
  "pause",
  "resume",
  "skip",
  "end",
  "advance",
  "complete-learn",
  "complete-build",
  "complete-community",
]);

export const actionRequestSchema = z.object({
  action: actionSchema,
  /** Optional optimistic-concurrency token; stale writes are rejected. */
  expectedUpdatedAt: z.string().optional(),
});

/** Today in the server's local day, used to deduplicate notes per day. */
export function sessionDay(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO timestamp without milliseconds, safe for filenames and branches. */
export function fileStamp(now: Date = new Date()): string {
  return sessionDay(now);
}
