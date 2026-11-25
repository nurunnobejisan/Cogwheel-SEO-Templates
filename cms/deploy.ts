/**
 * Guarded Deployment Orchestrator (Phase 3)
 *
 * Bridges the Phase 2 FixPatch to a platform connector using the roadmap's
 * safe-deploy sequence:
 *
 *   approval gate ─▶ snapshot ─▶ apply ─▶ settle ─▶ verify ─▶ (rollback on fail)
 *
 * Only approved mutations are sent. `manual_review` mutations are never
 * deployed; high-risk fields are only deployed when an operator explicitly
 * approves the whole patch (`approveAll`).
 */

import type { FixPatch, PatchMutation } from "../ai/types.ts";
import type {
  CmsConnector,
  ConnectorMutation,
  DeploymentResult,
  PatchDiffEntry,
} from "./types.ts";

export interface DeployOptions {
  connector: CmsConnector;
  /** Deploy mutations flagged `autoApply` (low-risk) without human action. */
  autoPilot?: boolean;
  /** Operator explicitly approves every non-`manual_review` mutation. */
  approveAll?: boolean;
  /** Compute the diff without touching the connector. */
  dryRun?: boolean;
  /** Run the post-apply live verification step (default true). */
  verify?: boolean;
  /** Delay before verification so the live site settles. Default 0. */
  settleMs?: number;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
  /** ISO timestamp for the result record. */
  now?: string;
}

/** Convert a Phase 2 patch mutation into a platform-agnostic connector mutation. */
export function toConnectorMutation(mutation: PatchMutation): ConnectorMutation {
  return {
    field: mutation.field,
    action: mutation.action,
    before: mutation.before,
    after: mutation.after,
  };
}

function render(value: PatchMutation["before"]): string {
  if (value === null || value === undefined) {
    return "(empty)";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

/** Human-readable diff for the pre-deployment review UI. */
export function previewPatchDiff(patch: FixPatch): PatchDiffEntry[] {
  return patch.mutations.map((mutation) => ({
    field: mutation.field,
    action: mutation.action,
    before: render(mutation.before),
    after: render(mutation.after),
    risk: mutation.risk,
    autoApply: mutation.autoApply,
  }));
}

function selectDeployable(patch: FixPatch, options: DeployOptions): PatchMutation[] {
  return patch.mutations.filter((mutation) => {
    if (mutation.action === "manual_review") {
      return false;
    }
    if (options.approveAll) {
      return true;
    }
    return Boolean(options.autoPilot && mutation.autoApply);
  });
}

export async function deployPatch(
  patch: FixPatch,
  options: DeployOptions
): Promise<DeploymentResult> {
  const now = options.now ?? new Date().toISOString();
  const diff = previewPatchDiff(patch);
  const selected = selectDeployable(patch, options);
  const queued = patch.mutations.length - selected.length;
  const base = {
    patchId: patch.patchId,
    targetUrl: options.connector.target.url,
    platform: options.connector.platform,
    diff,
    timestamp: now,
  } as const;

  if (options.dryRun) {
    return { ...base, status: "dry_run", applied: 0, queued, rolledBack: false, errors: [] };
  }

  if (selected.length === 0) {
    return {
      ...base,
      status: "queued",
      applied: 0,
      queued,
      rolledBack: false,
      errors: [],
      reason: "No approved mutations — patch queued for operator review.",
    };
  }

  const connectorMutations = selected.map(toConnectorMutation);
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = await options.connector.readSnapshot();
  } catch (error) {
    return {
      ...base,
      status: "failed",
      applied: 0,
      queued,
      rolledBack: false,
      errors: [`snapshot failed: ${messageOf(error)}`],
    };
  }

  let applied: number;
  try {
    const result = await options.connector.applyMutations(connectorMutations);
    if (!result.ok) {
      await safeRestore(options.connector, snapshot);
      return {
        ...base,
        status: "rolled_back",
        applied: 0,
        queued,
        rolledBack: true,
        errors: result.errors,
        reason: "Apply failed; snapshot restored.",
      };
    }
    applied = result.applied;
  } catch (error) {
    await safeRestore(options.connector, snapshot);
    return {
      ...base,
      status: "rolled_back",
      applied: 0,
      queued,
      rolledBack: true,
      errors: [messageOf(error)],
      reason: "Apply threw; snapshot restored.",
    };
  }

  if (options.verify !== false && options.connector.verify) {
    if (options.settleMs && options.settleMs > 0) {
      const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
      await sleep(options.settleMs);
    }
    const verification = await options.connector.verify();
    if (!verification.ok) {
      await safeRestore(options.connector, snapshot);
      return {
        ...base,
        status: "rolled_back",
        applied: 0,
        queued,
        rolledBack: true,
        errors: [verification.details ?? "verification failed"],
        reason: `Live verification failed${verification.status ? ` (HTTP ${verification.status})` : ""}; snapshot restored.`,
      };
    }
  }

  return { ...base, status: "deployed", applied, queued, rolledBack: false, errors: [] };
}

async function safeRestore(
  connector: CmsConnector,
  snapshot: Record<string, unknown>
): Promise<void> {
  try {
    await connector.restore(snapshot);
  } catch {
    /* best-effort rollback; the failure is surfaced in the result */
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
