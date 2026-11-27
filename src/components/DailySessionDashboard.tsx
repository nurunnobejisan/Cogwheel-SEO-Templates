"use client";

/**
 * Daily Session Dashboard
 *
 * Renders the session state returned by /api/daily-session. Elapsed time is
 * always derived from the server's `startedAt`/`endedAt` timestamps, so a page
 * refresh, a closed tab, or a lost connection never fabricates progress — the
 * clock simply recomputes from the persisted state.
 *
 * Controls are disabled while `processing` is true, which is the durable latch
 * the server holds during a transition or an agent run.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Spinner } from "@/components/ui";

type PhaseName = "learn" | "build" | "community";
type SessionStatus = "idle" | "running" | "paused" | "ended";
type WorkState = "not_started" | "in_progress" | "done" | "blocked" | "unavailable";
type Action = "start" | "pause" | "resume" | "skip" | "end" | "advance" | "complete-learn" | "complete-build" | "complete-community";

interface PhaseRecord {
  name: PhaseName;
  status: string;
  durationMinutes: number;
  startedAt: string | null;
  endedAt: string | null;
  elapsedMs: number;
}

interface Session {
  id: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  currentPhase: PhaseName | null;
  phases: PhaseRecord[];
  learn: { topic: string; explanation: string; example: string; projectRelation: string; knowledgeCheck: string; notePath: string | null; noteSaved: boolean; noteBlockedReason: string | null; state: WorkState };
  build: { task: string; plan: string[]; branch: string | null; prUrl: string | null; filesChanged: string[]; testsRun: string; testStatus: string; summary: string; continuation: string; state: WorkState };
  community: { opportunity: string; repository: string | null; draft: string; approvalStatus: string; posted: boolean; state: WorkState };
  report: { totalActualMinutes: number; completedPhases: string[]; incompleteTasks: string[]; nextRecommendedTask: string; generatedAt: string | null };
  errors: { at: string; message: string }[];
  processing: boolean;
  day: string;
}

interface ConfigView {
  configured: boolean;
  buildRepo: string | null;
  learnRepo: string | null;
  researchRepo: string | null;
  setup: { build: string | null; learn: string | null; research: string | null };
  github: string;
  authorizedRepos: string[];
}

interface ApiState {
  session: Session | null;
  history: Session[];
  config: ConfigView;
  phases: Record<PhaseName, number>;
}

const PHASE_META: Record<PhaseName, { label: string; minutes: number; icon: string; run: "learn" | "build" | "community" }> = {
  learn: { label: "Learn", minutes: 15, icon: "📖", run: "learn" },
  build: { label: "Build", minutes: 40, icon: "🛠️", run: "build" },
  community: { label: "Community", minutes: 5, icon: "🌐", run: "community" },
};

const WORK_BADGE: Record<WorkState, string> = {
  not_started: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  in_progress: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  blocked: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  unavailable: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

/** Phase headline. Narrowed by phase name so the union stays type-safe. */
function phaseTitle(phase: PhaseName, session: Session): string {
  if (phase === "learn") return session.learn.topic;
  if (phase === "build") return session.build.task;
  return session.community.opportunity;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Elapsed for a phase, from server timestamps only. */
function phaseElapsed(phase: PhaseRecord, nowMs: number): number {
  if (!phase.startedAt) return phase.elapsedMs;
  const start = Date.parse(phase.startedAt);
  const end = phase.endedAt ? Date.parse(phase.endedAt) : nowMs;
  return phase.elapsedMs + Math.max(0, end - start);
}

export function DailySessionDashboard() {
  const [data, setData] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [agentBusy, setAgentBusy] = useState<PhaseName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const updatedAtRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-session", { cache: "no-store" });
      if (!res.ok) throw new Error(`(${res.status}) ${(await res.json().catch(() => ({}))).error ?? "load failed"}`);
      const json = (await res.json()) as ApiState & { session: Session | null };
      setData(json);
      updatedAtRef.current = json.session?.updatedAt ?? null;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Server-derived clock tick — recompute from timestamps, don't accumulate.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.parse(new Date().toISOString()) || Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Refetch when the server reports a change (another tab, agent finishing).
  useEffect(() => {
    const id = setInterval(() => {
      if (updatedAtRef.current && data?.session && data.session.updatedAt !== updatedAtRef.current) void load();
    }, 5000);
    return () => clearInterval(id);
  }, [data?.session, load]);

  const session = data?.session ?? null;
  const locked = busy || (session?.processing ?? false) || agentBusy !== null;

  async function act(action: Action) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedUpdatedAt: updatedAtRef.current ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `(${res.status})`);
      setData((prev) => (prev ? { ...prev, session: json.session } : prev));
      updatedAtRef.current = json.session.updatedAt;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runAgent(phase: PhaseName) {
    setAgentBusy(phase);
    setError(null);
    try {
      const res = await fetch("/api/daily-session/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `(${res.status})`);
      setData((prev) => (prev ? { ...prev, session: json.session } : prev));
      updatedAtRef.current = json.session.updatedAt;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAgentBusy(null);
    }
  }

  async function markDone(phase: PhaseName) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session!.id, [phase]: { state: "done" } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `(${res.status})`);
      setData((prev) => (prev ? { ...prev, session: json.session } : prev));
      updatedAtRef.current = json.session.updatedAt;
      await act(`complete-${phase}` as Action);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card title="Daily Session" subtitle="Loading session state…">
        <div className="flex items-center gap-3 py-8">
          <Spinner /> <span className="text-sm text-slate-500">Loading…</span>
        </div>
      </Card>
    );
  }

  const config = data?.config;
  const activePhase = session?.currentPhase ?? null;
  const activeRecord = activePhase ? session?.phases.find((p) => p.name === activePhase) ?? null : null;
  const remainingMs = activeRecord
    ? Math.max(0, activeRecord.durationMinutes * 60_000 - phaseElapsed(activeRecord, nowMs))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Setup notice ─────────────────────────────────────────────── */}
      {config && !config.configured && (
        <Card title="Setup required" subtitle="The Daily Session feature targets repositories you must declare first.">
          <ul className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400">
            {Object.values(config.setup).map((step) => step && <li key={step}>• {step}</li>)}
            <li className="text-slate-500">Token in use: {config.github === "token" ? "GITHUB_TOKEN (server-side)" : "anonymous read-only"}</li>
          </ul>
        </Card>
      )}

      {/* ── Hero + Start button ──────────────────────────────────────── */}
      <Card
        title="Daily Session"
        subtitle="Learn 15m · Build 40m · Community 5m"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!session || session.status === "idle" ? (
              <Button variant="primary" onClick={() => void act("start")} disabled={locked}>
                {locked ? "Starting…" : "▶ Start Daily Session"}
              </Button>
            ) : (
              <>
                {session.status === "running" && (
                  <Button variant="secondary" onClick={() => void act("pause")} disabled={locked}>⏸ Pause</Button>
                )}
                {session.status === "paused" && (
                  <Button variant="primary" onClick={() => void act("resume")} disabled={locked}>▶ Resume</Button>
                )}
                {session.status !== "ended" && (
                  <>
                    <Button variant="ghost" onClick={() => void act("skip")} disabled={locked}>⏭ Skip</Button>
                    <Button variant="danger" onClick={() => void act("end")} disabled={locked}>⏹ End</Button>
                  </>
                )}
              </>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={session?.status === "running" ? "success" : session?.status === "paused" ? "warning" : session?.status === "ended" ? "neutral" : "info"}>
            {session ? session.status : "no session"}
          </Badge>
          {session && <span className="text-xs text-slate-500">session {session.id.slice(0, 8)} · day {session.day}</span>}
          {locked && <span className="flex items-center gap-1 text-xs text-slate-500"><Spinner size="sm" /> working…</span>}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {error}
          </p>
        )}
      </Card>

      {/* ── Phases ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PHASE_META) as PhaseName[]).map((name) => {
          const meta = PHASE_META[name];
          const record = session?.phases.find((p) => p.name === name) ?? null;
          const isActive = activePhase === name;
          const artifact = session?.[name];
          const elapsed = record ? phaseElapsed(record, nowMs) : 0;
          const pct = record ? Math.min(100, Math.round((elapsed / (record.durationMinutes * 60_000)) * 100)) : 0;

          return (
            <Card
              key={name}
              title={<span className="flex items-center gap-2">{meta.icon} {meta.label} <span className="text-xs font-normal text-slate-400">{meta.minutes}m</span></span>}
              subtitle={record ? `status: ${record.status}` : "not started"}
              actions={isActive ? <Badge variant="info">active</Badge> : undefined}
            >
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-brand"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-mono text-lg font-bold text-slate-800 dark:text-slate-100">
                  {isActive ? clock(remainingMs) : clock(Math.max(0, (record?.durationMinutes ?? meta.minutes) * 60_000 - elapsed))}
                </span>
                <span className="text-xs text-slate-400">{pct}% of phase</span>
              </div>

              {artifact && name && (
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                      {phaseTitle(name, session) || <span className="text-slate-400">— nothing selected yet</span>}
                    </span>
                    <Badge variant="neutral" className={WORK_BADGE[artifact.state]}>{artifact.state}</Badge>
                  </div>

                  {name === "learn" && session.learn.noteBlockedReason && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">{session.learn.noteBlockedReason}</p>
                  )}
                  {name === "build" && (
                    <p className="text-xs text-slate-500">tests: {session.build.testStatus}</p>
                  )}
                  {name === "community" && (
                    <p className="text-xs text-slate-500">approval: {session.community.approvalStatus} · posted: {String(session.community.posted)}</p>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={locked || !isActive} onClick={() => void runAgent(name)}>
                  {agentBusy === name ? "Running…" : "Run agent"}
                </Button>
                <Button variant="subtle" size="sm" disabled={locked || !isActive || artifact?.state === "done"} onClick={() => void markDone(name)}>
                  Mark done
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Active phase detail ──────────────────────────────────────── */}
      {session && activePhase && session[activePhase] && (
        <Card
          title={`${PHASE_META[activePhase].label} detail`}
          subtitle={activePhase === "learn" ? "Learning output" : activePhase === "build" ? "Implementation plan" : "Contribution draft (requires approval before posting)"}
          actions={activeRecord && <Badge variant="neutral">{clock(Math.max(0, activeRecord.durationMinutes * 60_000 - phaseElapsed(activeRecord, nowMs)))} left</Badge>}
        >
          <PhaseDetail phase={activePhase} session={session} />
        </Card>
      )}

      {/* ── Report ───────────────────────────────────────────────────── */}
      {session && session.report.generatedAt && (
        <Card title="Session report" subtitle={`Generated ${new Date(session.report.generatedAt).toLocaleTimeString()}`}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Actual time</dt><dd className="font-semibold">{session.report.totalActualMinutes} min</dd></div>
            <div><dt className="text-slate-500">Completed phases</dt><dd className="font-semibold">{session.report.completedPhases.join(", ") || "—"}</dd></div>
            <div><dt className="text-slate-500">Incomplete</dt><dd className="font-semibold">{session.report.incompleteTasks.length ? session.report.incompleteTasks.join("; ") : "none"}</dd></div>
            <div><dt className="text-slate-500">Next recommended</dt><dd className="font-semibold">{session.report.nextRecommendedTask || "—"}</dd></div>
          </dl>
        </Card>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      {data && data.history.length > 0 && (
        <Card title="Session history" subtitle="Most recent sessions">
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {data.history.slice(0, 8).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-mono text-slate-500">{h.day} · {h.id.slice(0, 8)}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={h.status === "ended" ? "success" : h.status === "paused" ? "warning" : "info"}>{h.status}</Badge>
                  <span className="text-slate-400">{h.report.totalActualMinutes}m</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Errors ───────────────────────────────────────────────────── */}
      {session && session.errors.length > 0 && (
        <Card title="Session errors" subtitle="Recovery information kept for the report">
          <ul className="flex flex-col gap-1 text-xs text-slate-500">
            {session.errors.slice(-5).map((e, i) => (
              <li key={`${e.at}-${i}`}><span className="font-mono">{new Date(e.at).toLocaleTimeString()}</span> — {e.message}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function PhaseDetail({ phase, session }: { phase: PhaseName; session: Session }) {
  if (phase === "learn") {
    const a = session.learn;
    return (
      <div className="flex flex-col gap-3 text-sm">
        {!a.topic && <p className="text-slate-400">Press <b>Run agent</b> to select a topic and prepare the note.</p>}
        {a.topic && (
          <>
            <Row label="Topic" value={a.topic} />
            {a.explanation && <Section label="Explanation" body={a.explanation} />}
            {a.example && <Section label="Practical example" body={a.example} />}
            {a.projectRelation && <Section label="Relation to the project" body={a.projectRelation} />}
            {a.knowledgeCheck && <Section label="Knowledge check" body={a.knowledgeCheck} />}
            <Row label="Note" value={a.noteSaved ? `saved → ${a.notePath}` : a.notePath ?? "not saved"} />
          </>
        )}
      </div>
    );
  }

  if (phase === "build") {
    const a = session.build;
    return (
      <div className="flex flex-col gap-3 text-sm">
        {!a.task && <p className="text-slate-400">Press <b>Run agent</b> to inspect the repository and pick a task.</p>}
        {a.task && (
          <>
            <Row label="Task" value={a.task} />
            {a.plan.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
                <ol className="list-decimal space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                  {a.plan.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            )}
            <Row label="Branch" value={a.branch ?? "not created"} />
            <Row label="Files" value={a.filesChanged.length ? a.filesChanged.join(", ") : "—"} />
            <Row label="Tests" value={`${a.testStatus}${a.testsRun ? ` — ${a.testsRun.slice(0, 200)}` : ""}`} />
            {a.summary && <Section label="Summary" body={a.summary} />}
            {a.continuation && <Section label="Continuation plan" body={a.continuation} />}
            <p className="text-xs text-slate-400">Changes await human review — no branch is merged automatically.</p>
          </>
        )}
      </div>
    );
  }

  const a = session.community;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {!a.opportunity && <p className="text-slate-400">Press <b>Run agent</b> to identify one useful activity.</p>}
      {a.opportunity && (
        <>
          <Row label="Opportunity" value={a.opportunity} />
          <Row label="Repository" value={a.repository ?? "local"} />
          {a.draft && <Section label="Draft (proposal — awaiting your approval)" body={a.draft} />}
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Nothing is posted automatically. Approval status: {a.approvalStatus}.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-700 dark:text-slate-300">{value}</span>
    </div>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{body}</p>
    </div>
  );
}
