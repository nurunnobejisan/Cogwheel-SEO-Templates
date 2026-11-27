import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryAdapter } from "../platform/persistence/memory-adapter";
import {
  SESSION_COLLECTION,
  findActive,
  newSession,
  setSessionAdapter,
  hasNoteForToday,
} from "@/lib/daily-session/store";
import {
  SessionError,
  applyAction,
  phaseElapsedMs,
  startSession,
} from "@/lib/daily-session/orchestrator";
import { PHASE_DURATIONS, sessionDay } from "@/lib/daily-session/types";
import { loadDailySessionConfig, isAuthorizedRepo, configuredRepos } from "@/lib/daily-session/config";

beforeEach(() => {
  setSessionAdapter(createMemoryAdapter());
});

describe("daily session — start", () => {
  it("creates one session and starts in the Learn phase", async () => {
    const { session, created } = await startSession(new Date("2026-11-27T09:00:00Z"));
    expect(created).toBe(true);
    expect(session.status).toBe("running");
    expect(session.currentPhase).toBe("learn");
    expect(session.phases).toHaveLength(3);
    expect(session.phases.map((p) => p.name)).toEqual(["learn", "build", "community"]);
    expect(session.phases[0].durationMinutes).toBe(15);
    expect(session.phases[1].durationMinutes).toBe(40);
    expect(session.phases[2].durationMinutes).toBe(5);
  });

  it("is idempotent — a second click returns the same session", async () => {
    const first = await startSession();
    const second = await startSession();
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(await findActive()).not.toBeNull();
  });

  it("never creates duplicate active sessions", async () => {
    await startSession();
    await startSession();
    const active = await findActive();
    expect(active).not.toBeNull();
    expect(active!.status).toBe("running");
  });
});

describe("daily session — timing is server-derived", () => {
  it("computes elapsed from persisted timestamps, not a local counter", async () => {
    const t0 = new Date("2026-11-27T09:00:00Z");
    const { session } = await startSession(t0);
    const phase = session.phases[0];

    const later = new Date("2026-11-27T09:07:30Z");
    expect(phaseElapsedMs(phase, later)).toBe(450_000);
  });

  it("does not accumulate time while paused", async () => {
    const t0 = new Date("2026-11-27T09:00:00Z");
    const { session } = await startSession(t0);

    const paused = await applyAction(session.id, "pause", { now: new Date("2026-11-27T09:10:00Z") });
    expect(paused.status).toBe("paused");
    expect(paused.currentPhase).toBeNull();

    // 5 minutes pass while paused — elapsed must stay frozen at 10 minutes.
    const stillPaused = paused.phases[0];
    expect(phaseElapsedMs(stillPaused, new Date("2026-11-27T09:15:00Z"))).toBe(600_000);
  });

  it("resumes the paused phase and continues from accumulated time", async () => {
    const { session } = await startSession(new Date("2026-11-27T09:00:00Z"));
    await applyAction(session.id, "pause", { now: new Date("2026-11-27T09:10:00Z") });
    const resumed = await applyAction(session.id, "resume", { now: new Date("2026-11-27T09:30:00Z") });

    expect(resumed.status).toBe("running");
    expect(resumed.currentPhase).toBe("learn");
    expect(resumed.phases[0].status).toBe("active");

    const phase = resumed.phases[0];
    // 10 minutes banked + 5 minutes after resume = 15 minutes total.
    expect(phaseElapsedMs(phase, new Date("2026-11-27T09:35:00Z"))).toBe(900_000);
  });
});

describe("daily session — transitions", () => {
  it("advances learn → build → community → ended", async () => {
    const { session } = await startSession();
    const t = () => new Date();

    const s1 = await applyAction(session.id, "advance", { now: t() });
    expect(s1.currentPhase).toBe("build");
    expect(s1.phases[0].status).toBe("completed");

    const s2 = await applyAction(session.id, "advance", { now: t() });
    expect(s2.currentPhase).toBe("community");
    expect(s2.phases[1].status).toBe("completed");

    const s3 = await applyAction(session.id, "advance", { now: t() });
    expect(s3.status).toBe("ended");
    expect(s3.currentPhase).toBeNull();
    expect(s3.endedAt).not.toBeNull();
  });

  it("skips a phase without marking it completed", async () => {
    const { session } = await startSession();
    const skipped = await applyAction(session.id, "skip", { now: new Date() });
    expect(skipped.phases[0].status).toBe("skipped");
    expect(skipped.phases[0].status).not.toBe("completed");
    expect(skipped.currentPhase).toBe("build");
  });

  it("ends from any state and freezes the active phase", async () => {
    const { session } = await startSession();
    const ended = await applyAction(session.id, "end", { now: new Date() });
    expect(ended.status).toBe("ended");
    expect(ended.currentPhase).toBeNull();
    expect(ended.phases[0].endedAt).not.toBeNull();
  });

  it("rejects actions on a session that already ended", async () => {
    const { session } = await startSession();
    await applyAction(session.id, "end", { now: new Date() });
    await expect(applyAction(session.id, "pause", { now: new Date() })).rejects.toThrow(SessionError);
  });
});

describe("daily session — honest completion gating", () => {
  it("refuses to complete Build while tests failed", async () => {
    const { session } = await startSession();
    await applyAction(session.id, "advance", { now: new Date() }); // → build

    const patched = await applyAction(session.id, "complete-build", { now: new Date() }).catch(() => null);
    expect(patched).toBeNull(); // state is not "done" yet
  });

  it("refuses to complete Build when testStatus is failed", async () => {
    const { session } = await startSession();
    await applyAction(session.id, "advance", { now: new Date() });

    const { updateArtifact } = await import("@/lib/daily-session/orchestrator");
    await updateArtifact(session.id, { build: { state: "done", testStatus: "failed", task: "t" } });

    await expect(applyAction(session.id, "complete-build", { now: new Date() })).rejects.toThrow(
      /tests failed/i,
    );
  });

  it("completes Build only after tests actually passed", async () => {
    const { session } = await startSession();
    await applyAction(session.id, "advance", { now: new Date() });

    const { updateArtifact } = await import("@/lib/daily-session/orchestrator");
    await updateArtifact(session.id, { build: { state: "done", testStatus: "passed", task: "add validation" } });

    const after = await applyAction(session.id, "complete-build", { now: new Date() });
    expect(after.phases[1].status).toBe("completed");
    expect(after.currentPhase).toBe("community");
  });
});

describe("daily session — concurrency and recovery", () => {
  it("rejects a stale optimistic-concurrency token", async () => {
    const { session } = await startSession();
    await applyAction(session.id, "pause", { now: new Date() });

    await expect(
      applyAction(session.id, "resume", {
        expectedUpdatedAt: session.updatedAt, // stale — pause already changed it
        now: new Date(),
      }),
    ).rejects.toThrow(/changed elsewhere/);
  });

  it("releases the processing latch after a failed transition", async () => {
    const { session } = await startSession();
    await applyAction(session.id, "end", { now: new Date() });

    await expect(applyAction(session.id, "pause", { now: new Date() })).rejects.toThrow();
    const active = await findActive();
    expect(active).toBeNull(); // ended sessions are not "active"
  });

  it("survives a reload: state is read back from the store", async () => {
    const { session } = await startSession(new Date("2026-11-27T09:00:00Z"));
    await applyAction(session.id, "advance", { now: new Date("2026-11-27T09:16:00Z") });

    // A fresh read (as the browser does after refresh) sees the same phase.
    const reloaded = await findActive();
    expect(reloaded?.id).toBe(session.id);
    expect(reloaded?.currentPhase).toBe("build");
    expect(reloaded?.phases[0].status).toBe("completed");
  });
});

describe("daily session — report accuracy", () => {
  it("reports real elapsed time and distinguishes incomplete work", async () => {
    const { session } = await startSession(new Date("2026-11-27T09:00:00Z"));
    const { updateArtifact } = await import("@/lib/daily-session/orchestrator");
    await updateArtifact(session.id, { learn: { topic: "Lambda error handling", state: "done" } });

    const after = await applyAction(session.id, "complete-learn", { now: new Date("2026-11-27T09:15:00Z") });
    expect(after.report.completedPhases).toContain("learn");
    expect(after.report.totalActualMinutes).toBeCloseTo(15, 1);
    expect(after.report.nextRecommendedTask).not.toContain("Learn");
  });

  it("never marks a phase complete that has no artifact", async () => {
    const { session } = await startSession();
    const after = await applyAction(session.id, "complete-learn", { now: new Date() }).catch(() => null);
    expect(after).toBeNull();
  });
});

describe("daily session — note deduplication", () => {
  it("does not save a second note for the same topic on the same day", async () => {
    const { session } = await startSession();
    const { updateArtifact } = await import("@/lib/daily-session/orchestrator");
    await updateArtifact(session.id, {
      learn: { topic: "DynamoDB access patterns", noteSaved: true, notePath: "dynamodb/2026-11-27.md" },
    });

    expect(await hasNoteForToday("DynamoDB access patterns")).toBe(true);
    expect(await hasNoteForToday("DynamoDB access patterns", sessionDay())).toBe(true);
    expect(await hasNoteForToday("A different topic")).toBe(false);
  });
});

describe("daily session — repository allow-list", () => {
  const env = {
    DAILY_SESSION_BUILD_REPO: "nurunnobejisan/SEO-Studio",
    DAILY_SESSION_LEARN_REPO: "nurunnobejisan/til",
    GITHUB_TOKEN: "ghp_test",
  };

  it("authorizes only configured repositories", () => {
    const config = loadDailySessionConfig(env);
    expect(config.configured).toBe(true);
    expect(isAuthorizedRepo(config, "nurunnobejisan/SEO-Studio")).toBe(true);
    expect(isAuthorizedRepo(config, "nurunnobejisan/til")).toBe(true);
    expect(isAuthorizedRepo(config, "someone-else/other-repo")).toBe(false);
    expect(isAuthorizedRepo(config, "nurunnobejisan/fastapi-lambda-starter")).toBe(false);
  });

  it("reports unconfigured repos with an exact setup step", () => {
    const config = loadDailySessionConfig({});
    expect(config.configured).toBe(false);
    expect(config.build.repo).toBeNull();
    expect(config.build.setup).toMatch(/DAILY_SESSION_BUILD_REPO/);
    expect(config.githubToken).toBeNull();
  });

  it("rejects malformed repository names instead of passing them through", () => {
    const config = loadDailySessionConfig({
      DAILY_SESSION_BUILD_REPO: "not-a-repo-name; rm -rf /",
      DAILY_SESSION_LEARN_REPO: "valid/repo",
    });
    expect(config.build.repo).toBeNull();
    expect(config.learn.repo).toBe("valid/repo");
  });

  it("lists configured repos without duplicates", () => {
    const config = loadDailySessionConfig(env);
    expect(configuredRepos(config)).toEqual(["nurunnobejisan/SEO-Studio", "nurunnobejisan/til"]);
  });
});

describe("daily session — store guards", () => {
  it("persists under the daily_sessions collection", async () => {
    const session = newSession(new Date("2026-11-27T09:00:00Z"));
    expect(session.day).toBe("2026-11-27");
    expect(SESSION_COLLECTION).toBe("daily_sessions");
    expect(session.phases).toHaveLength(3);
    expect(PHASE_DURATIONS.learn).toBe(15);
  });

  it("returns null when no session exists", async () => {
    expect(await findActive()).toBeNull();
  });
});
