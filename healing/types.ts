/**
 * Cogwheel Self-Healing Pipeline — Shared Types (Phase 4)
 *
 * Contracts for the continuous scan scheduler, issue triage, the approval
 * queue, the versioned rollback store, the live micro-crawler verification and
 * the healing event log that feeds the operator dashboard.
 *
 * See docs/ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md (Phase 4).
 */

import type { AuditIssue, AuditReport } from "../rules/types.ts";
import type { FixPatch, PatchMutation } from "../ai/types.ts";
import type { CmsConnector, CmsPlatform, DeploymentResult, PatchDiffEntry } from "../cms/types.ts";

export type RiskTier = "low" | "medium" | "high";

/** Per-issue triage classification (roadmap step 2). */
export interface IssueTriage {
  issueId: string;
  category: string;
  risk: RiskTier;
  autoApplicable: boolean;
}

/** Per-patch triage result feeding the approval gate. */
export interface PatchTriage {
  mutations: Array<{ field: string; risk: RiskTier; action: PatchMutation["action"] }>;
  overallRisk: RiskTier;
  /** True when every deployable mutation is low risk and none needs review. */
  autoDeployable: boolean;
  requiresApproval: boolean;
  issues: IssueTriage[];
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "auto_approved";

export interface ApprovalRequest {
  id: string;
  patchId: string;
  targetUrl: string;
  triage: PatchTriage;
  diff: PatchDiffEntry[];
  status: ApprovalStatus;
  reason: string;
  createdAt: string;
  decidedAt?: string;
  note?: string;
}

export interface AutoPilotPolicy {
  enabled: boolean;
  /** Highest risk tier the auto-pilot may approve without an operator. */
  maxRisk: RiskTier;
}

/** A versioned pre-change snapshot in the rollback database. */
export interface SnapshotRecord {
  id: string;
  version: number;
  patchId: string;
  targetUrl: string;
  platform: CmsPlatform;
  snapshot: Record<string, unknown>;
  createdAt: string;
  reason: string;
}

export interface JsonLdLintIssue {
  path: string;
  message: string;
}

export interface JsonLdLintResult {
  valid: boolean;
  nodeCount: number;
  types: string[];
  issues: JsonLdLintIssue[];
}

export interface VerificationExpectation {
  field: string;
  expected: string | null;
}

export interface VerificationCheck {
  field: string;
  passed: boolean;
  actual: string | null;
  detail: string;
}

/** Post-fix verification report (roadmap step 5). */
export interface VerificationReport {
  url: string;
  status: number | null;
  httpOk: boolean;
  domMatches: boolean;
  jsonLdValid: boolean;
  checks: VerificationCheck[];
  jsonLd: JsonLdLintResult | null;
  errors: string[];
  verifiedAt: string;
}

export type HealingEventType =
  | "scan_started"
  | "patch_synthesized"
  | "awaiting_approval"
  | "auto_approved"
  | "rejected"
  | "deployment_started"
  | "deployed"
  | "verified"
  | "rolled_back"
  | "alert";

export interface HealingEvent {
  id: string;
  type: HealingEventType;
  level: "info" | "warning" | "error";
  message: string;
  patchId?: string;
  targetUrl?: string;
  at: string;
  data?: Record<string, unknown>;
}

export type HealingRunStatus = "deployed" | "rolled_back" | "queued" | "rejected" | "failed";

export interface HealingRunResult {
  runId: string;
  targetUrl: string;
  patchId: string;
  status: HealingRunStatus;
  approval: ApprovalRequest;
  deployment: DeploymentResult | null;
  verification: VerificationReport | null;
  snapshotId: string | null;
  events: HealingEvent[];
  startedAt: string;
  finishedAt: string;
}

export type ScanTrigger = "cron" | "webhook" | "manual";

export interface ScanSchedule {
  id: string;
  targetUrl: string;
  /** Standard 5-field cron expression. */
  cron: string;
  enabled: boolean;
  lastRunAt?: string;
}

export interface ScanJob {
  id: string;
  scheduleId: string | null;
  targetUrl: string;
  trigger: ScanTrigger;
  dueAt: string;
}

/** Options for a full healing run. */
export interface HealingRunOptions {
  report: AuditReport;
  connector: CmsConnector;
  policy?: AutoPilotPolicy;
  queue?: import("./approval.ts").ApprovalQueue;
  rollbackStore?: import("./rollback-store.ts").RollbackStore;
  events?: import("./events.ts").HealingEventBus;
  /** Options forwarded to the AI patch generator (invoker, providers...). */
  patchOptions?: import("../ai/types.ts").FixPatchOptions;
  fetchImpl?: import("../cms/types.ts").FetchLike;
  /** Operator override: deploy every non-review mutation regardless of policy. */
  approveAll?: boolean;
  /** Called with the synthesized patch so callers can persist it for approval. */
  onPatch?: (patch: FixPatch) => void;
  /** Delay before live verification. Default 0. */
  settleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
}

export type { AuditIssue, AuditReport, FixPatch, CmsConnector };
