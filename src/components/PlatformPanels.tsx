"use client";

import { useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, Input, Select, Stat } from "./ui";
import type {
  ApprovalRequest,
  AuditLogEntry,
  AuditReport,
  CmsPlatform,
  DeploymentHistoryEntry,
  HealingRunResult,
  HealthResponse,
  PatchTriage,
  PublicCredential,
  RiskTier,
  Role,
  ScheduleView,
} from "@/lib/platform/client";

/* ------------------------------------------------------------- utilities -- */

export interface ConsoleData {
  health: HealthResponse | null;
  approvals: ApprovalRequest[];
  history: DeploymentHistoryEntry[];
  audit: { entries: AuditLogEntry[]; verification: { valid: boolean; entries: number; brokenAt: number | null } } | null;
  connectors: string[];
  credentials: PublicCredential[];
  schedules: ScheduleView[];
  events: Array<{ type: string; at: string }>;
  alerts: Array<{ type: string; at: string }>;
}

const RISK_ORDER: Record<RiskTier, number> = { low: 0, medium: 1, high: 2 };
const ROLE_CEILING: Record<Role, RiskTier | null> = { viewer: null, specialist: "medium", admin: "high" };

export function canApprove(role: Role, risk: RiskTier): boolean {
  const ceiling = ROLE_CEILING[role];
  return ceiling !== null && RISK_ORDER[risk] <= RISK_ORDER[ceiling];
}

function riskBadge(risk: RiskTier) {
  const variant = risk === "high" ? "danger" : risk === "medium" ? "warning" : "success";
  return <Badge variant={variant} size="sm">{risk}</Badge>;
}

export function statusBadge(status: string) {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
    deployed: "success",
    auto_approved: "success",
    approved: "success",
    queued: "warning",
    pending: "warning",
    rolled_back: "danger",
    rejected: "danger",
    failed: "danger",
  };
  return <Badge variant={map[status] ?? "neutral"} size="sm">{status.replace(/_/g, " ")}</Badge>;
}

function time(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function DiffList({ triage }: { triage: PatchTriage }) {
  if (triage.mutations.length === 0) {
    return <p className="text-xs text-slate-400">No deployable mutations.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {triage.mutations.map((mutation, index) => (
        <li key={`${mutation.field}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
          <span className="font-mono text-slate-700 dark:text-slate-300">{mutation.field}</span>
          <span className="flex items-center gap-2">
            <span className="text-slate-400">{mutation.action}</span>
            {riskBadge(mutation.risk)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- overview -- */

export function OverviewPanel({ data, onRefresh }: { data: ConsoleData; onRefresh: () => void }) {
  const pending = data.approvals.filter((a) => a.status === "pending").length;
  const undoable = data.history.filter((h) => !h.undone && h.snapshotId).length;
  const integrity = data.audit?.verification;
  const recent = (data.audit?.entries ?? []).slice(-6).reverse();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending approvals" value={pending} tone={pending > 0 ? "warn" : "good"} subtext="awaiting an operator" />
        <Stat label="Undoable changes" value={undoable} tone={undoable > 0 ? "brand" : "default"} subtext="snapshot available" />
        <Stat
          label="Audit integrity"
          value={integrity ? (integrity.valid ? "Verified" : "Broken") : "—"}
          tone={integrity?.valid ? "good" : "danger"}
          subtext={integrity ? `${integrity.entries} entries` : undefined}
        />
        <Stat label="Connected targets" value={data.connectors.length} subtext={`${data.schedules.length} schedules`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Runtime status"
          subtitle="Gateway health and storage"
          actions={<Button size="sm" variant="secondary" onClick={onRefresh}>Refresh</Button>}
        >
          {data.health ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Version</dt>
                <dd className="mt-0.5 font-mono text-slate-800 dark:text-slate-200">{data.health.version}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Uptime</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{Math.round(data.health.uptimeMs / 1000)}s</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</dt>
                <dd className="mt-0.5"><Badge variant={data.health.ok ? "success" : "danger"} size="sm">{data.health.ok ? "online" : "offline"}</Badge></dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audit log</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{data.audit?.entries.length ?? 0} entries</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Health endpoint unreachable.</p>
          )}
        </Card>

        <Card title="Recent activity" subtitle="Latest audited actions">
          {recent.length === 0 ? (
            <EmptyState title="No activity yet" description="Actions you take in the console are recorded in the tamper-evident audit log." />
          ) : (
            <ul className="space-y-2.5">
              {recent.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                      <span className="font-mono text-xs text-brand-dark dark:text-brand">{entry.action}</span>
                      {entry.targetUrl ? <span className="ml-2 text-slate-500">{shortUrl(entry.targetUrl)}</span> : null}
                    </p>
                    <p className="text-xs text-slate-400">{entry.actor} · {entry.role}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{time(entry.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- approvals -- */

export function ApprovalsPanel({
  data,
  role,
  onApprove,
  onReject,
  busyId,
}: {
  data: ConsoleData;
  role: Role;
  onApprove: (id: string, note?: string) => void;
  onReject: (id: string, note?: string) => void;
  busyId: string | null;
}) {
  const pending = data.approvals.filter((a) => a.status === "pending");
  if (pending.length === 0) {
    return <EmptyState title="No approvals waiting" description="High- and medium-risk patches queue here for review before they touch the live site." />;
  }
  return (
    <div className="space-y-4">
      {pending.map((approval) => {
        const allowed = canApprove(role, approval.triage.overallRisk);
        const busy = busyId === approval.id;
        return (
          <Card
            key={approval.id}
            title={<span className="flex items-center gap-2">{shortUrl(approval.targetUrl)} {riskBadge(approval.triage.overallRisk)}</span>}
            subtitle={`Patch ${approval.patchId} · requested ${time(approval.createdAt)}`}
            actions={
              <>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => onReject(approval.id)}>Reject</Button>
                <Button
                  size="sm"
                  disabled={busy || !allowed}
                  title={allowed ? undefined : `Requires admin clearance for ${approval.triage.overallRisk}-risk changes`}
                  onClick={() => onApprove(approval.id)}
                >
                  {busy ? "Working…" : "Approve & deploy"}
                </Button>
              </>
            }
          >
            <DiffList triage={approval.triage} />
            {!allowed && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Your role cannot approve {approval.triage.overallRisk}-risk changes. An admin must approve.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- history -- */

export function HistoryPanel({
  data,
  onUndo,
  busyId,
}: {
  data: ConsoleData;
  onUndo: (id: string) => void;
  busyId: string | null;
}) {
  if (data.history.length === 0) {
    return <EmptyState title="No deployments yet" description="Deploy a patch or run the self-healing pipeline and it will appear here with a one-click undo." />;
  }
  return (
    <Card title="Deployment history" subtitle="Every applied change is snapshot-backed" className="overflow-hidden">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-2 py-2 font-semibold">Target</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold">Platform</th>
              <th className="px-2 py-2 font-semibold">Applied</th>
              <th className="px-2 py-2 font-semibold">Actor</th>
              <th className="px-2 py-2 font-semibold">When</th>
              <th className="px-2 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...data.history].reverse().map((entry) => {
              const undoable = !entry.undone && Boolean(entry.snapshotId);
              return (
                <tr key={entry.id} className="align-middle">
                  <td className="px-2 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{shortUrl(entry.targetUrl)}</p>
                    <p className="font-mono text-[11px] text-slate-400">{entry.patchId}</p>
                  </td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-1.5">
                      {statusBadge(entry.status)}
                      {entry.undone && <Badge variant="neutral" size="sm">undone</Badge>}
                    </span>
                  </td>
                  <td className="px-2 py-3 capitalize text-slate-600 dark:text-slate-400">{entry.platform}</td>
                  <td className="px-2 py-3 tabular-nums text-slate-600 dark:text-slate-400">{entry.applied}</td>
                  <td className="px-2 py-3 text-xs text-slate-500">{entry.actor}</td>
                  <td className="px-2 py-3 text-xs text-slate-500">{time(entry.at)}</td>
                  <td className="px-2 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!undoable || busyId === entry.id}
                      title={undoable ? "Restore the pre-change snapshot" : entry.undone ? "Already undone" : "No snapshot stored"}
                      onClick={() => onUndo(entry.id)}
                    >
                      {busyId === entry.id ? "Restoring…" : "Undo"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- audit -- */

export function AuditPanel({
  data,
  onVerify,
  verifying,
}: {
  data: ConsoleData;
  onVerify: () => void;
  verifying: boolean;
}) {
  const verification = data.audit?.verification;
  return (
    <div className="space-y-4">
      <Card
        title="Immutable audit log"
        subtitle="Append-only, SHA-256 hash-chained"
        actions={<Button size="sm" variant="secondary" disabled={verifying} onClick={onVerify}>{verifying ? "Verifying…" : "Verify chain"}</Button>}
      >
        {verification ? (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
            verification.valid
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          }`}>
            <span className="text-lg">{verification.valid ? "✓" : "⚠"}</span>
            <div>
              <p className="font-semibold">{verification.valid ? "Chain verified" : "Tampering detected"}</p>
              <p className="text-xs opacity-80">
                {verification.entries} entries{verification.brokenAt !== null ? ` · first break at #${verification.brokenAt}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No verification result yet.</p>
        )}
      </Card>

      <Card title="Entries" subtitle={`${data.audit?.entries.length ?? 0} recorded actions`} className="overflow-hidden">
        {data.audit && data.audit.entries.length > 0 ? (
          <div className="-mx-2 max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-900">
                <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-2 py-2 font-semibold">#</th>
                  <th className="px-2 py-2 font-semibold">Action</th>
                  <th className="px-2 py-2 font-semibold">Actor</th>
                  <th className="px-2 py-2 font-semibold">Target</th>
                  <th className="px-2 py-2 font-semibold">When</th>
                  <th className="px-2 py-2 font-semibold">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...data.audit.entries].reverse().map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-2 py-2.5 tabular-nums text-slate-400">{entry.sequence}</td>
                    <td className="px-2 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">{entry.action}</td>
                    <td className="px-2 py-2.5 text-xs text-slate-500">{entry.actor}<span className="ml-1 text-slate-400">({entry.role})</span></td>
                    <td className="px-2 py-2.5 text-xs text-slate-500">{entry.targetUrl ? shortUrl(entry.targetUrl) : "—"}</td>
                    <td className="px-2 py-2.5 text-xs text-slate-500">{time(entry.at)}</td>
                    <td className="px-2 py-2.5 font-mono text-[11px] text-slate-400" title={entry.hash}>{entry.hash.slice(0, 10)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Log is empty" description="The first audited action will appear here." />
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- targets -- */

export function TargetsPanel({
  data,
  onRegisterConnector,
  onCreateCredential,
  onCreateSchedule,
  busy,
}: {
  data: ConsoleData;
  onRegisterConnector: (input: { targetUrl: string; credentialId?: string; resourceId?: string }) => Promise<boolean>;
  onCreateCredential: (input: { platform: CmsPlatform; label: string; meta: Record<string, string>; secret: Record<string, unknown> }) => Promise<boolean>;
  onCreateSchedule: (input: { targetUrl: string; cron: string }) => Promise<boolean>;
  busy: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ConnectorsCard data={data} onRegister={onRegisterConnector} busy={busy} />
        <SchedulesCard data={data} onCreate={onCreateSchedule} busy={busy} />
      </div>
      <CredentialsCard data={data} onCreate={onCreateCredential} busy={busy} />
    </div>
  );
}

function ConnectorsCard({
  data,
  onRegister,
  busy,
}: {
  data: ConsoleData;
  onRegister: (input: { targetUrl: string; credentialId?: string; resourceId?: string }) => Promise<boolean>;
  busy: boolean;
}) {
  const [targetUrl, setTargetUrl] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [resourceId, setResourceId] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!targetUrl.trim()) return;
    const ok = await onRegister({
      targetUrl: targetUrl.trim(),
      credentialId: credentialId || undefined,
      resourceId: resourceId.trim() || undefined,
    });
    if (ok) {
      setTargetUrl("");
      setResourceId("");
    }
  }

  return (
    <Card title="Connected targets" subtitle="Where the platform is allowed to deploy">
      {data.connectors.length === 0 ? (
        <p className="mb-4 text-xs text-slate-400">No targets connected yet. Register one below — leave the credential empty to use the universal runtime connector.</p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {data.connectors.map((target) => (
            <li key={target} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
              <span className="text-emerald-500">●</span>
              <span className="truncate font-mono text-slate-700 dark:text-slate-300">{target}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Input label="Target page URL" placeholder="https://example.com/blog/post" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Credential (optional)" value={credentialId} onChange={(e) => setCredentialId(e.target.value)}>
            <option value="">Universal runtime connector</option>
            {data.credentials.map((credential) => (
              <option key={credential.id} value={credential.id}>{credential.label} · {credential.platform}</option>
            ))}
          </Select>
          <Input label="Resource ID (optional)" placeholder="42 or gid://..." value={resourceId} onChange={(e) => setResourceId(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={busy || !targetUrl.trim()}>Register target</Button>
      </form>
    </Card>
  );
}

const CRON_PRESETS = [
  { value: "*/15 * * * *", label: "Every 15 minutes" },
  { value: "0 * * * *", label: "Hourly" },
  { value: "0 3 * * *", label: "Daily at 03:00" },
  { value: "0 3 * * 1", label: "Weekly (Mon 03:00)" },
];

function SchedulesCard({
  data,
  onCreate,
  busy,
}: {
  data: ConsoleData;
  onCreate: (input: { targetUrl: string; cron: string }) => Promise<boolean>;
  busy: boolean;
}) {
  const [targetUrl, setTargetUrl] = useState("");
  const [cron, setCron] = useState(CRON_PRESETS[2]!.value);
  const [customCron, setCustomCron] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const expression = cron === "custom" ? customCron.trim() : cron;
    if (!targetUrl.trim() || !expression) return;
    const ok = await onCreate({ targetUrl: targetUrl.trim(), cron: expression });
    if (ok) setTargetUrl("");
  }

  return (
    <Card title="Scheduled scans" subtitle="Continuous monitoring cadence">
      {data.schedules.length === 0 ? (
        <p className="mb-4 text-xs text-slate-400">No scans scheduled. The worker drains due jobs and runs the healing pipeline.</p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {data.schedules.map((schedule) => (
            <li key={schedule.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
              <span className="truncate font-mono text-slate-700 dark:text-slate-300">{shortUrl(schedule.targetUrl)}</span>
              <span className="flex items-center gap-2">
                <Badge variant={schedule.enabled ? "success" : "neutral"} size="sm">{schedule.enabled ? "on" : "off"}</Badge>
                <code className="text-slate-500">{schedule.cron}</code>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Input label="Target page URL" placeholder="https://example.com/blog/post" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} required />
        <Select label="Cadence" value={cron} onChange={(e) => setCron(e.target.value)}>
          {CRON_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>{preset.label}</option>
          ))}
          <option value="custom">Custom cron…</option>
        </Select>
        {cron === "custom" && (
          <Input label="Cron expression" placeholder="0 */6 * * *" value={customCron} onChange={(e) => setCustomCron(e.target.value)} />
        )}
        <Button type="submit" size="sm" disabled={busy || !targetUrl.trim()}>Add schedule</Button>
      </form>
    </Card>
  );
}

const PLATFORM_META_HINT: Record<CmsPlatform, string> = {
  wordpress: '{"siteUrl":"https://blog.example.com","username":"editor","seoPlugin":"yoast"}',
  shopify: '{"shop":"example.myshopify.com"}',
  webflow: '{"collectionId":"65f..."}',
  custom: '{"clientId":"site-123"}',
};

const PLATFORM_SECRET_HINT: Record<CmsPlatform, string> = {
  wordpress: '{"applicationPassword":"xxxx xxxx xxxx"}',
  shopify: '{"accessToken":"shpat_..."}',
  webflow: '{"accessToken":"..."}',
  custom: "{}",
};

function CredentialsCard({
  data,
  onCreate,
  busy,
}: {
  data: ConsoleData;
  onCreate: (input: { platform: CmsPlatform; label: string; meta: Record<string, string>; secret: Record<string, unknown> }) => Promise<boolean>;
  busy: boolean;
}) {
  const [platform, setPlatform] = useState<CmsPlatform>("wordpress");
  const [label, setLabel] = useState("");
  const [metaText, setMetaText] = useState(PLATFORM_META_HINT.wordpress);
  const [secretText, setSecretText] = useState(PLATFORM_SECRET_HINT.wordpress);
  const [error, setError] = useState<string | null>(null);

  function changePlatform(next: CmsPlatform) {
    setPlatform(next);
    setMetaText(PLATFORM_META_HINT[next]);
    setSecretText(PLATFORM_SECRET_HINT[next]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!label.trim()) return;
    let meta: Record<string, string>;
    let secret: Record<string, unknown>;
    try {
      meta = JSON.parse(metaText) as Record<string, string>;
      secret = JSON.parse(secretText) as Record<string, unknown>;
    } catch {
      setError("Meta and secret must be valid JSON objects.");
      return;
    }
    const ok = await onCreate({ platform, label: label.trim(), meta, secret });
    if (ok) {
      setLabel("");
    }
  }

  return (
    <Card title="CMS credentials" subtitle="Secrets are encrypted at rest and never returned">
      {data.credentials.length === 0 ? (
        <p className="mb-4 text-xs text-slate-400">No credentials stored. Admins can connect a WordPress, Shopify, Webflow or custom site below.</p>
      ) : (
        <ul className="mb-4 grid gap-1.5 sm:grid-cols-2">
          {data.credentials.map((credential) => (
            <li key={credential.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-700 dark:text-slate-200">{credential.label}</span>
                <span className="font-mono text-[11px] text-slate-400">{credential.fingerprint}</span>
              </span>
              <Badge variant="info" size="sm">{credential.platform}</Badge>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Platform" value={platform} onChange={(e) => changePlatform(e.target.value as CmsPlatform)}>
            <option value="wordpress">WordPress</option>
            <option value="shopify">Shopify</option>
            <option value="webflow">Webflow</option>
            <option value="custom">Custom</option>
          </Select>
          <Input label="Label" placeholder="Main blog" value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Meta (JSON)</span>
            <textarea
              className="mt-1.5 block h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              value={metaText}
              onChange={(e) => setMetaText(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Secret (JSON)</span>
            <textarea
              className="mt-1.5 block h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              value={secretText}
              onChange={(e) => setSecretText(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <Button type="submit" size="sm" disabled={busy || !label.trim()}>Store credential</Button>
        <p className="text-[11px] text-slate-400">Only admins can create credentials. Values are sealed with AES-256-GCM.</p>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------- self-heal -- */

export function HealPanel({
  role,
  onAudit,
  onHeal,
  busy,
}: {
  role: Role;
  onAudit: (url: string) => Promise<AuditReport | null>;
  onHeal: (report: AuditReport, opts: { autoPilot?: boolean; maxRisk?: RiskTier; approveAll?: boolean }) => Promise<HealingRunResult | null>;
  busy: boolean;
}) {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [run, setRun] = useState<HealingRunResult | null>(null);
  const [working, setWorking] = useState(false);

  async function scan(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setWorking(true);
    setReport(null);
    setRun(null);
    try {
      const result = await onAudit(url.trim());
      setReport(result);
    } finally {
      setWorking(false);
    }
  }

  async function heal(opts: { autoPilot?: boolean; maxRisk?: RiskTier; approveAll?: boolean }) {
    if (!report) return;
    setWorking(true);
    try {
      const result = await onHeal(report, opts);
      setRun(result);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card title="Scan & self-heal" subtitle="Audit a live page, then let the pipeline fix and verify it">
        <form onSubmit={scan} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input label="Page URL" placeholder="https://example.com/blog/post" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" required />
          <Button type="submit" disabled={working || busy || !url.trim()}>{working && !report ? "Scanning…" : "Scan page"}</Button>
        </form>
      </Card>

      {report && (
        <Card
          title="Audit result"
          subtitle={`${report.domain} · ${report.mode} mode · ${report.summary.totalIssues} issues`}
          actions={<Badge variant={report.summary.score >= 80 ? "success" : report.summary.score >= 60 ? "warning" : "danger"}>score {report.summary.score}</Badge>}
        >
          <div className="grid gap-2 sm:grid-cols-5">
            {(["critical", "high", "medium", "low", "info"] as const).map((severity) => (
              <div key={severity} className="rounded-xl bg-slate-50 px-3 py-2 text-center dark:bg-slate-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{severity}</p>
                <p className="font-display text-lg font-extrabold text-slate-800 dark:text-slate-100">{report.summary.bySeverity[severity]}</p>
              </div>
            ))}
          </div>

          {report.issues.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {report.issues.slice(0, 8).map((issue) => (
                <li key={issue.issueId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                  <span className="truncate text-slate-700 dark:text-slate-300">{issue.issueId}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-slate-400">{issue.category}</span>
                    <Badge variant={issue.severity === "critical" || issue.severity === "high" ? "danger" : issue.severity === "medium" ? "warning" : "neutral"} size="sm">{issue.severity}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" disabled={working || busy} onClick={() => heal({ autoPilot: true, maxRisk: "low" })}>
              {working ? "Working…" : "Auto-heal low risk"}
            </Button>
            <Button size="sm" variant="secondary" disabled={working || busy} onClick={() => heal({ autoPilot: true, maxRisk: "medium" })}>
              Auto-heal ≤ medium
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={working || busy || role !== "admin"}
              title={role === "admin" ? undefined : "Force-approve requires admin"}
              onClick={() => heal({ approveAll: true })}
            >
              Force approve all
            </Button>
            <Button size="sm" variant="ghost" disabled={working || busy} onClick={() => heal({ autoPilot: false })}>
              Queue for review
            </Button>
          </div>
        </Card>
      )}

      {run && (
        <Card
          title="Pipeline result"
          subtitle={`Run ${run.runId}`}
          actions={statusBadge(run.status)}
        >
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patch</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-slate-700 dark:text-slate-300">{run.patchId}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Applied</dt>
              <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{run.deployment?.applied ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Verified</dt>
              <dd className="mt-0.5">{run.verification ? <Badge variant={run.verification.domMatches ? "success" : "danger"} size="sm">{run.verification.domMatches ? "dom match" : "mismatch"}</Badge> : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Snapshot</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-slate-700 dark:text-slate-300">{run.snapshotId ?? "—"}</dd>
            </div>
          </dl>
          {run.deployment?.errors && run.deployment.errors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {run.deployment.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}