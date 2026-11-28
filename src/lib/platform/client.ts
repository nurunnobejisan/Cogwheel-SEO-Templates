/**
 * Platform API Client (Phase 5.1)
 *
 * Typed browser client for the operator console. It talks to the Next.js mount
 * at `/api/platform/v1/*` and carries the acting principal via the
 * `cw_actor_*` cookies (set by the role switcher), which the route handler
 * reads and forwards to the gateway.
 */

import type { FixPatch } from "../../../ai/index.ts";
import type { AuditReport } from "../../../rules/index.ts";
import type {
  ApprovalRequest,
  HealingRunResult,
  PatchTriage,
  RiskTier,
} from "../../../healing/index.ts";
import type { CmsPlatform, CmsTarget, DeploymentResult } from "../../../cms/index.ts";
import type { AuditLogEntry, DeploymentHistoryEntry, HealthResponse, Role } from "../../../platform/index.ts";
import type { ChangeEvent, OutcomeRecord } from "../../core/outcomes/types.ts";
import type { JudgmentReport } from "../../core/judgment/types.ts";

export const PLATFORM_API_BASE = "/api/platform/v1";
/** Outcome logging lives on its own route, not under the platform gateway. */
export const OUTCOMES_API_BASE = "/api/outcomes";
/**
 * Operator session bootstrap. This is a Next.js route at `/api/platform/session`
 * (next to the `/api/platform/v1/*` gateway mount), *not* a gateway endpoint —
 * `request(base, ...)` would wrongly produce `/api/platform/v1/session`.
 */
export const SESSION_API_BASE = "/api/platform/session";

/** Redacted credential as returned by the API (secrets never leave the server). */
export interface PublicCredential {
  id: string;
  platform: CmsPlatform;
  label: string;
  meta: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  fingerprint: string;
}

export interface ScheduleView {
  id: string;
  targetUrl: string;
  cron: string;
  enabled: boolean;
  lastRunAt?: string;
}

export interface SessionStatus {
  authenticated: boolean;
  principal: ActorIdentity | null;
  devAuth?: boolean;
  signInConfigured?: boolean;
}

export interface PlatformApiErrorBody {
  error: { code: string; message: string; retryAfterMs?: number; details?: unknown };
}

export class PlatformApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterMs?: number;
  readonly details?: unknown;

  constructor(status: number, body: PlatformApiErrorBody) {
    super(body.error?.message ?? `request failed with status ${status}`);
    this.name = "PlatformApiError";
    this.status = status;
    this.code = body.error?.code ?? "unknown";
    this.retryAfterMs = body.error?.retryAfterMs;
    this.details = body.error?.details;
  }
}

export interface ClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

async function requestUrl<T>(
  fetchImpl: typeof fetch,
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const response = await fetchImpl(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    throw new PlatformApiError(
      response.status,
      (parsed as PlatformApiErrorBody) ?? { error: { code: "unknown", message: response.statusText } }
    );
  }
  return parsed as T;
}

async function request<T>(
  options: ClientOptions,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  return requestUrl<T>(
    options.fetchImpl ?? fetch,
    `${options.baseUrl ?? PLATFORM_API_BASE}${path}`,
    method,
    body
  );
}

export interface DeploymentResponse {
  deployment: DeploymentResult;
  historyId: string | null;
  snapshotId: string | null;
}

export interface ApprovalView {
  approval: ApprovalRequest;
  triage: PatchTriage;
}

export interface OutcomesOverview {
  success: boolean;
  changes: ChangeEvent[];
  outcomes: OutcomeRecord[];
  counts: { changes: number; measured: number; unavailable: number; tracked: number };
}

export function createPlatformClient(options: ClientOptions = {}) {
  return {
    health: () => request<HealthResponse>(options, "GET", "/health"),

    /* -------- session -------- */
    session: () =>
      requestUrl<SessionStatus>(options.fetchImpl ?? fetch, SESSION_API_BASE, "GET"),
    signIn: (token: string, role?: Role) =>
      requestUrl<SessionStatus>(options.fetchImpl ?? fetch, SESSION_API_BASE, "POST", { token, role }),
    signOut: () =>
      requestUrl<{ authenticated: boolean }>(options.fetchImpl ?? fetch, SESSION_API_BASE, "DELETE"),

    /* -------- connectors -------- */
    listConnectors: () => request<{ targets: string[] }>(options, "GET", "/connectors"),
    registerConnector: (input: { targetUrl: string; credentialId?: string; resourceId?: string; resourceType?: string }) =>
      request<{ targetUrl: string; platform: CmsPlatform; targets: string[] }>(options, "POST", "/connectors", input),

    /* -------- credentials -------- */
    listCredentials: () => request<{ credentials: PublicCredential[] }>(options, "GET", "/credentials"),
    createCredential: (input: {
      platform: CmsPlatform;
      label: string;
      meta: Record<string, string>;
      secret: Record<string, unknown>;
    }) => request<PublicCredential>(options, "POST", "/credentials", input),

    /* -------- patches & deployments -------- */
    previewPatch: (patch: FixPatch) =>
      request<{ patchId: string; triage: PatchTriage; diff: unknown[]; requiresApproval: boolean }>(
        options,
        "POST",
        "/patches/preview",
        patch
      ),
    deploy: (input: { patch: FixPatch; dryRun?: boolean; approveAll?: boolean; autoPilot?: boolean; settleMs?: number }) =>
      request<DeploymentResponse | ApprovalView>(options, "POST", "/deployments", input),

    /* -------- approvals -------- */
    listApprovals: () => request<{ approvals: Array<{ approval: ApprovalRequest }> }>(options, "GET", "/approvals"),
    approve: (id: string, note?: string) =>
      request<DeploymentResponse>(options, "POST", `/approvals/${encodeURIComponent(id)}/approve`, { note }),
    reject: (id: string, note?: string) =>
      request<{ approval: ApprovalRequest }>(options, "POST", `/approvals/${encodeURIComponent(id)}/reject`, { note }),

    /* -------- self-healing -------- */
    heal: (input: { report: AuditReport; autoPilot?: boolean; maxRisk?: RiskTier; approveAll?: boolean }) =>
      request<HealingRunResult>(options, "POST", "/heal", input),

    /* -------- history & undo -------- */
    listHistory: (targetUrl?: string) =>
      request<{ entries: DeploymentHistoryEntry[]; undoable: number }>(
        options,
        "GET",
        targetUrl ? `/history?targetUrl=${encodeURIComponent(targetUrl)}` : "/history"
      ),
    undo: (id: string) =>
      request<{ entry: DeploymentHistoryEntry; restoredFields: string[] }>(
        options,
        "POST",
        `/history/${encodeURIComponent(id)}/undo`
      ),

    /* -------- audit & events -------- */
    auditLog: (verifyOnly = false) =>
      request<{ entries: AuditLogEntry[]; verification: { valid: boolean; entries: number; brokenAt: number | null } }>(
        options,
        "GET",
        verifyOnly ? "/audit-log?verify=1" : "/audit-log"
      ),
    events: () =>
      request<{ events: Array<{ type: string; at: string }>; alerts: Array<{ type: string; at: string }> }>(
        options,
        "GET",
        "/events"
      ),

    /* -------- schedules -------- */
    listSchedules: () => request<{ schedules: ScheduleView[] }>(options, "GET", "/schedules"),
    createSchedule: (input: { targetUrl: string; cron: string; enabled?: boolean }) =>
      request<{ schedule: ScheduleView }>(options, "POST", "/schedules", input),

    /* -------- audits -------- */
    audit: (url: string) => request<AuditReport>(options, "POST", "/audits", { url }),

    /* -------- outcomes & L2 judgment (separate route) -------- */
    outcomes: () => requestUrl<OutcomesOverview>(options.fetchImpl ?? fetch, OUTCOMES_API_BASE, "GET"),
    recordOutcome: (input: { pageUrl: string; appliedAt?: string; summary?: string; kind?: string; fixRef?: string }) =>
      requestUrl<{ success: boolean; change: ChangeEvent; duplicate: boolean }>(
        options.fetchImpl ?? fetch,
        OUTCOMES_API_BASE,
        "POST",
        { action: "record", ...input }
      ),
    measureOutcomes: (changeId?: string) =>
      requestUrl<{ success: boolean; measured: number; measuredCount: number; outcomes: OutcomeRecord[]; note?: string }>(
        options.fetchImpl ?? fetch,
        OUTCOMES_API_BASE,
        "POST",
        { action: "measure", changeId }
      ),
    judge: () =>
      requestUrl<{ success: boolean; report: JudgmentReport }>(
        options.fetchImpl ?? fetch,
        OUTCOMES_API_BASE,
        "POST",
        { action: "judge" }
      ),

    /* -------- worker helper -------- */
    /** Run the full scan → triage → heal loop for a page. */
    scan: (url: string, opts: { autoPilot?: boolean; maxRisk?: RiskTier; approveAll?: boolean } = {}) =>
      request<AuditReport>(options, "POST", "/audits", { url }).then((report) =>
        request<HealingRunResult>(options, "POST", "/heal", { report, ...opts })
      ),
  };
}

export type PlatformClient = ReturnType<typeof createPlatformClient>;

/* ---------------------------------------------------------- role cookie --- */

export interface ActorIdentity {
  id: string;
  role: Role;
  organizationId?: string;
}

const COOKIE_ID = "cw_actor_id";
const COOKIE_ROLE = "cw_actor_role";
const COOKIE_ORG = "cw_actor_org";

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=2592000; samesite=lax`;
}

/** Persist the acting principal so the API route resolves the right role. */
export function setActor(actor: ActorIdentity): void {
  writeCookie(COOKIE_ID, actor.id);
  writeCookie(COOKIE_ROLE, actor.role);
  writeCookie(COOKIE_ORG, actor.organizationId ?? "");
}

export function readActor(): ActorIdentity {
  if (typeof document === "undefined") {
    return { id: "", role: "viewer" };
  }
  const read = (name: string): string => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]!) : "";
  };
  const role = read(COOKIE_ROLE);
  return {
    id: read(COOKIE_ID),
    role: (["viewer", "specialist", "admin"] as const).find((r) => r === role) ?? "viewer",
    organizationId: read(COOKIE_ORG) || undefined,
  };
}

/** Roles a principal can assume in the console (dev convenience). */
export const DEMO_ACTORS: ReadonlyArray<ActorIdentity> = [
  { id: "admin@example.com", role: "admin", organizationId: "org_demo" },
  { id: "specialist@example.com", role: "specialist", organizationId: "org_demo" },
  { id: "viewer@example.com", role: "viewer", organizationId: "org_demo" },
];

export type {
  CmsPlatform,
  CmsTarget,
  DeploymentHistoryEntry,
  AuditLogEntry,
  HealingRunResult,
  FixPatch,
  AuditReport,
  ApprovalRequest,
  PatchTriage,
  RiskTier,
  HealthResponse,
  Role,
  ChangeEvent,
  OutcomeRecord,
  JudgmentReport,
};
