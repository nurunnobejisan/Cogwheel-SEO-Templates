"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Spinner } from "./ui";
import {
  AuditPanel,
  ApprovalsPanel,
  HealPanel,
  HistoryPanel,
  OutcomesPanel,
  OverviewPanel,
  TargetsPanel,
  canApprove,
  type ConsoleData,
} from "./PlatformPanels";
import {
  DEMO_ACTORS,
  PlatformApiError,
  createPlatformClient,
  readActor,
  setActor as persistActor,
  type ActorIdentity,
  type CmsPlatform,
  type SessionStatus,
} from "@/lib/platform/client";

type Tab = "overview" | "approvals" | "history" | "audit" | "targets" | "heal" | "outcomes";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "approvals", label: "Approvals" },
  { id: "history", label: "History" },
  { id: "audit", label: "Audit log" },
  { id: "targets", label: "Targets" },
  { id: "heal", label: "Self-heal" },
  { id: "outcomes", label: "Outcomes" },
];

const EMPTY_DATA: ConsoleData = {
  health: null,
  approvals: [],
  history: [],
  audit: null,
  connectors: [],
  credentials: [],
  schedules: [],
  events: [],
  alerts: [],
  outcomes: null,
  judgment: null,
};

const client = createPlatformClient();

export function OperatorConsole() {
  const [actor, setActorState] = useState<ActorIdentity>({ id: "", role: "viewer" });
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<ConsoleData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  /* Resolve the session (signed cookie) or fall back to dev auth. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = await client.session().catch(() => null);
      if (cancelled) return;
      setSession(status);

      if (status?.authenticated && status.principal) {
        setActorState(status.principal);
        return;
      }
      if (status?.devAuth) {
        const current = readActor();
        const initial = current.id ? current : DEMO_ACTORS[0]!;
        if (!current.id) persistActor(initial);
        setActorState(initial);
        return;
      }
      setActorState({ id: "", role: "viewer" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reportError = useCallback((cause: unknown) => {
    if (cause instanceof PlatformApiError) {
      setError(`${cause.status} · ${cause.code}: ${cause.message}`);
    } else {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const load = useCallback(async () => {
    if (!actor.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [health, approvals, history, audit, events, schedules, connectors, credentials, outcomes, judgment] =
      await Promise.allSettled([
        client.health(),
        client.listApprovals(),
        client.listHistory(),
        client.auditLog(),
        client.events(),
        client.listSchedules(),
        client.listConnectors(),
        client.listCredentials(),
        client.outcomes(),
        client.judge(),
      ]);

    setData({
      health: health.status === "fulfilled" ? health.value : null,
      approvals: approvals.status === "fulfilled" ? approvals.value.approvals.map((item) => item.approval) : [],
      history: history.status === "fulfilled" ? history.value.entries : [],
      audit: audit.status === "fulfilled" ? audit.value : null,
      events: events.status === "fulfilled" ? events.value.events : [],
      alerts: events.status === "fulfilled" ? events.value.alerts : [],
      schedules: schedules.status === "fulfilled" ? schedules.value.schedules : [],
      connectors: connectors.status === "fulfilled" ? connectors.value.targets : [],
      credentials: credentials.status === "fulfilled" ? credentials.value.credentials : [],
      outcomes: outcomes.status === "fulfilled" ? outcomes.value : null,
      judgment: judgment.status === "fulfilled" ? judgment.value.report : null,
    });
    setLoading(false);
  }, [actor.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run<T>(id: string, task: () => Promise<T>, success?: string): Promise<T | null> {
    setBusyId(id);
    setError(null);
    try {
      const result = await task();
      if (success) setError(null);
      await load();
      return result;
    } catch (cause) {
      reportError(cause);
      return null;
    } finally {
      setBusyId(null);
    }
  }

  function switchActor(id: string) {
    const next = DEMO_ACTORS.find((candidate) => candidate.id === id) ?? DEMO_ACTORS[0]!;
    persistActor(next);
    setActorState(next);
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tokenInput.trim()) return;
    setSigningIn(true);
    setError(null);
    try {
      const status = await client.signIn(tokenInput.trim());
      setSession(status);
      if (status.principal) setActorState(status.principal);
      setTokenInput("");
    } catch (cause) {
      reportError(cause);
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    setSigningIn(true);
    try {
      await client.signOut();
    } catch {
      // Clearing the cookie locally still ends the session on this browser.
    } finally {
      setSession({ authenticated: false, principal: null, devAuth: false, signInConfigured: session?.signInConfigured });
      setActorState({ id: "", role: "viewer" });
      setData(EMPTY_DATA);
      setSigningIn(false);
    }
  }

  const role = actor.role;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-caption font-bold text-brand-light dark:bg-brand dark:text-slate-950"
            >
              CW
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-extrabold text-slate-900 dark:text-white">Operator Console</h1>
                <Badge variant="brand" size="sm">Phase 5</Badge>
              </div>
              <p className="text-tiny text-slate-500 dark:text-slate-400">Governance · approvals · history · audit</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-tiny font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${data.health?.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
              {data.health?.ok ? "online" : "offline"}
            </span>
            {session?.devAuth ? (
              <select
                aria-label="Acting role"
                value={actor.id}
                onChange={(event) => switchActor(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-caption font-semibold text-slate-700 focus:border-brand focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                {DEMO_ACTORS.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.role} · {candidate.id}
                  </option>
                ))}
              </select>
            ) : session?.authenticated && session.principal ? (
              <>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-tiny font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {session.principal.role} · {session.principal.id}
                </span>
                <Button size="sm" variant="secondary" onClick={() => void signOut()} disabled={signingIn}>
                  Sign out
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
            <Link href="/" className="rounded-lg px-2.5 py-1.5 text-caption font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Back to studio
            </Link>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {TABS.map((item) => {
            const active = tab === item.id;
            const pending = item.id === "approvals" ? data.approvals.filter((a) => a.status === "pending").length : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-caption font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white dark:bg-brand dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
                {pending > 0 && (
                  <span className={`rounded-full px-1.5 text-micro ${active ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{pending}</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {!session?.authenticated && !session?.devAuth ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-caption text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {session?.signInConfigured ? (
              <form onSubmit={signIn} className="flex flex-wrap items-center gap-2">
                <label htmlFor="operator-token" className="font-semibold text-slate-700 dark:text-slate-200">
                  Operator token
                </label>
                <input
                  id="operator-token"
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  autoComplete="current-password"
                  placeholder="PLATFORM_OPERATOR_TOKEN"
                  className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-caption text-slate-800 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <Button size="sm" type="submit" disabled={signingIn || !tokenInput.trim()}>
                  {signingIn ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            ) : (
              <span>
                <strong>Signed out.</strong> Set <code className="font-mono">PLATFORM_OPERATOR_TOKEN</code> and{" "}
                <code className="font-mono">PLATFORM_SESSION_SECRET</code> on the server to enable sign-in.
              </span>
            )}
          </div>
        ) : session?.devAuth ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-caption text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <span>
              <strong>Development auth.</strong> The acting identity is chosen in the header and is refused when{" "}
              <code className="font-mono">NODE_ENV=production</code>.
            </span>
            <span className="font-mono">role: {role}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-caption text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span>
              <strong>Signed session.</strong> Requests carry an HMAC-verified <code className="font-mono">cw_session</code> cookie.
            </span>
            <span className="font-mono">role: {role}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-body text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <span className="font-medium">{error}</span>
            <button type="button" className="text-caption font-bold uppercase tracking-wide opacity-70 hover:opacity-100" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loading && !data.health ? (
          <div className="flex items-center justify-center gap-3 py-24 text-body text-slate-400">
            <Spinner /> Loading platform runtime…
          </div>
        ) : (
          <>
            {tab === "overview" && <OverviewPanel data={data} onRefresh={() => void load()} />}

            {tab === "approvals" && (
              <ApprovalsPanel
                data={data}
                role={role}
                busyId={busyId}
                onApprove={(id, note) => void run(id, () => client.approve(id, note))}
                onReject={(id, note) => void run(id, () => client.reject(id, note))}
              />
            )}

            {tab === "history" && (
              <HistoryPanel data={data} busyId={busyId} onUndo={(id) => void run(id, () => client.undo(id))} />
            )}

            {tab === "audit" && (
              <AuditPanel
                data={data}
                verifying={verifying}
                onVerify={() => {
                  setVerifying(true);
                  void run("audit", () => client.auditLog()).finally(() => setVerifying(false));
                }}
              />
            )}

            {tab === "targets" && (
              <TargetsPanel
                data={data}
                busy={busyId !== null}
                onRegisterConnector={async (input) => {
                  const result = await run("connector", () => client.registerConnector(input));
                  return result !== null;
                }}
                onCreateCredential={async (input: {
                  platform: CmsPlatform;
                  label: string;
                  meta: Record<string, string>;
                  secret: Record<string, unknown>;
                }) => {
                  const result = await run("credential", () => client.createCredential(input));
                  return result !== null;
                }}
                onCreateSchedule={async (input) => {
                  const result = await run("schedule", () => client.createSchedule(input));
                  return result !== null;
                }}
              />
            )}

            {tab === "heal" && (
              <HealPanel
                role={role}
                busy={busyId !== null}
                onAudit={async (url) => {
                  try {
                    return await client.audit(url);
                  } catch (cause) {
                    reportError(cause);
                    return null;
                  }
                }}
                onHeal={async (report, opts) => {
                  return run("heal", () => client.heal({ report, ...opts }));
                }}
              />
            )}

            {tab === "outcomes" && (
              <OutcomesPanel
                data={data}
                busy={busyId !== null}
                onMeasure={() => void run("outcomes-measure", () => client.measureOutcomes())}
                onJudge={() => void run("outcomes-judge", () => client.judge())}
              />
            )}
          </>
        )}

        <p className="pb-4 text-center text-tiny text-slate-400">
          Every action is recorded in the hash-chained audit log. High-risk changes require an admin.
          {role === "specialist" && " Your specialist role can approve up to medium risk."}
          {role === "viewer" && " Your viewer role is read-only."}
          {role === "admin" && ` You can approve ${canApprove(role, "high") ? "any" : "low/medium"}-risk change.`}
        </p>
      </main>
    </div>
  );
}