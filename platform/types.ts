/**
 * Cogwheel Platform Runtime — Shared Types (Phase 5)
 *
 * Contracts for the governance/runtime layer that exposes Phases 1–4 over an
 * authenticated, rate-limited, fully-audited operator API:
 *
 *   principals & RBAC ─▶ append-only audit log ─▶ rate limiting
 *        └─▶ deployment history ─▶ one-click undo ─▶ scan worker
 *
 * The request/response shapes are HTTP-agnostic so the same gateway backs the
 * Next.js route handlers, the bare `node:http` adapter and unit tests.
 *
 * See docs/ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md (§7 Safeguards).
 */

import type { CmsPlatform, PatchDiffEntry } from "../cms/types.ts";
import type { ApprovalRequest, HealingRunResult, PatchTriage, RiskTier } from "../healing/types.ts";

/* ------------------------------------------------------------------ RBAC --- */

export type Role = "viewer" | "specialist" | "admin";

export type Permission =
  | "audit:read"
  | "audit:run"
  | "patch:read"
  | "patch:approve"
  | "patch:deploy"
  | "credential:read"
  | "credential:write"
  | "schedule:read"
  | "schedule:write"
  | "history:read"
  | "history:undo"
  | "audit-log:read";

export interface Principal {
  /** Stable user id (email, subject claim, …). */
  id: string;
  role: Role;
  /** Tenant boundary; all resources are scoped to it when present. */
  organizationId?: string;
}

/* ------------------------------------------------------------- Audit log --- */

export interface AuditLogEntry {
  sequence: number;
  id: string;
  at: string;
  actor: string;
  role: Role;
  /** Dotted action name, e.g. "patch.approve" or "credential.create". */
  action: string;
  organizationId?: string;
  targetUrl?: string;
  patchId?: string;
  /** Before/after values for reversible write actions. */
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  /** Hash of the previous entry; "" for the genesis entry. */
  previousHash: string;
  /** SHA-256 over the canonical entry payload + previousHash. */
  hash: string;
}

/* --------------------------------------------------------------- History --- */

export interface DeploymentHistoryEntry {
  id: string;
  runId: string;
  patchId: string;
  targetUrl: string;
  platform: CmsPlatform;
  status: HealingRunResult["status"];
  actor: string;
  at: string;
  snapshotId: string | null;
  diff: PatchDiffEntry[];
  applied: number;
  rolledBack: boolean;
  undone: boolean;
  undoneAt?: string;
  undoneBy?: string;
}

/* -------------------------------------------------------- Rate limiting --- */

export interface BucketConfig {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens replenished per second. */
  refillPerSecond: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the next token is available when throttled. */
  retryAfterMs: number;
}

/* --------------------------------------------------------------- Gateway --- */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface PlatformRequest {
  method: HttpMethod;
  /** Path with an optional query string, e.g. "/v1/history?limit=10". */
  path: string;
  body?: unknown;
  principal: Principal;
  headers?: Record<string, string>;
}

export interface PlatformResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** Normalized error payload returned by the gateway. */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    /** Present for 429 responses. */
    retryAfterMs?: number;
    details?: unknown;
  };
}

export interface PlatformErrorOptions {
  status: number;
  code: string;
  details?: unknown;
  retryAfterMs?: number;
}

export interface DeploymentRequest {
  targetUrl: string;
  patchId: string;
  dryRun?: boolean;
  autoPilot?: boolean;
  settleMs?: number;
}

export interface HealRequest {
  report: unknown;
  autoPilot?: boolean;
  maxRisk?: RiskTier;
  approveAll?: boolean;
}

export interface CredentialCreateRequest {
  platform: CmsPlatform;
  label: string;
  meta: Record<string, string>;
  secret: Record<string, unknown>;
}

export interface ScheduleCreateRequest {
  targetUrl: string;
  cron: string;
  enabled?: boolean;
}

export interface PatchPreviewResponse {
  patchId: string;
  triage: PatchTriage;
  diff: PatchDiffEntry[];
  requiresApproval: boolean;
}

export interface ApprovalView {
  approval: ApprovalRequest;
  patchId: string;
}

export interface HealthResponse {
  ok: true;
  version: string;
  uptimeMs: number;
}