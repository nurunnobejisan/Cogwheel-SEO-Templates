/**
 * Approval Queue & Auto-Pilot Policy (Phase 4, step 3)
 *
 * Implements the operator approval gate and the "Auto-Pilot" rules from the
 * roadmap: low-risk fixes deploy immediately when auto-pilot is enabled while
 * higher-risk items are routed to a manual review queue.
 */

import type { FixPatch, PatchMutation } from "../ai/types.ts";
import type { PatchDiffEntry } from "../cms/types.ts";
import { previewPatchDiff } from "../cms/deploy.ts";
import type { ApprovalRequest, ApprovalStatus, AutoPilotPolicy, PatchTriage, RiskTier } from "./types.ts";
import { isRiskWithin } from "./triage.ts";

export const DEFAULT_AUTOPILOT_POLICY: AutoPilotPolicy = { enabled: false, maxRisk: "low" };

export interface ApprovalDecision {
  status: ApprovalStatus;
  reason: string;
}

/**
 * Decide how a triaged patch should be routed. With auto-pilot enabled, every
 * deployable mutation at or below the risk ceiling is approved automatically;
 * the rest remain queued.
 */
export function evaluateApproval(
  triage: PatchTriage,
  policy: AutoPilotPolicy = DEFAULT_AUTOPILOT_POLICY,
  options: { approveAll?: boolean } = {}
): ApprovalDecision {
  if (options.approveAll) {
    return { status: "approved", reason: "Operator approved all mutations." };
  }
  if (!policy.enabled) {
    return { status: "pending", reason: "Auto-pilot disabled — awaiting operator approval." };
  }

  const deployable = triage.mutations.filter((mutation) => mutation.action !== "manual_review");
  if (deployable.length === 0) {
    return { status: "pending", reason: "No deployable mutations to auto-approve." };
  }

  const within = deployable.filter((mutation) => isRiskWithin(mutation.risk, policy.maxRisk));
  if (within.length === 0) {
    return {
      status: "pending",
      reason: `Every mutation exceeds the auto-pilot ceiling (${policy.maxRisk}).`,
    };
  }
  if (within.length === deployable.length) {
    return {
      status: "auto_approved",
      reason: `Auto-pilot approved ${within.length} mutation(s) at or below ${policy.maxRisk}.`,
    };
  }
  return {
    status: "auto_approved",
    reason: `Auto-pilot approved ${within.length}/${deployable.length} mutation(s); the remainder are queued for review.`,
  };
}

/**
 * Select the mutations the pipeline may deploy right now. Tiers come from the
 * triage result (same order as `patch.mutations`).
 */
export function selectAutoDeployableMutations(
  patch: FixPatch,
  triage: PatchTriage,
  policy: AutoPilotPolicy = DEFAULT_AUTOPILOT_POLICY,
  approveAll = false
): PatchMutation[] {
  return patch.mutations.filter((mutation, index) => {
    if (mutation.action === "manual_review") {
      return false;
    }
    if (approveAll) {
      return true;
    }
    if (!policy.enabled) {
      return false;
    }
    const risk: RiskTier = triage.mutations[index]?.risk ?? "high";
    return isRiskWithin(risk, policy.maxRisk);
  });
}

export interface ApprovalQueue {
  submit(input: {
    patch: FixPatch;
    triage: PatchTriage;
    policy?: AutoPilotPolicy;
    approveAll?: boolean;
    now?: string;
  }): ApprovalRequest;
  get(id: string): ApprovalRequest | null;
  list(): ApprovalRequest[];
  pending(): ApprovalRequest[];
  decide(
    id: string,
    status: Extract<ApprovalStatus, "approved" | "rejected">,
    note?: string,
    now?: string
  ): ApprovalRequest | null;
}

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `apr_${Date.now().toString(36)}${sequence.toString(36)}`;
}

export function createApprovalQueue(): ApprovalQueue {
  const requests = new Map<string, ApprovalRequest>();

  return {
    submit({ patch, triage, policy = DEFAULT_AUTOPILOT_POLICY, approveAll, now }) {
      const decision = evaluateApproval(triage, policy, { approveAll });
      const at = now ?? new Date().toISOString();
      const request: ApprovalRequest = {
        id: nextId(),
        patchId: patch.patchId,
        targetUrl: patch.targetUrl,
        triage,
        diff: previewPatchDiff(patch) as PatchDiffEntry[],
        status: decision.status,
        reason: decision.reason,
        createdAt: at,
        decidedAt: decision.status === "pending" ? undefined : at,
      };
      requests.set(request.id, request);
      return request;
    },

    get(id) {
      return requests.get(id) ?? null;
    },

    list() {
      return [...requests.values()];
    },

    pending() {
      return [...requests.values()].filter((request) => request.status === "pending");
    },

    decide(id, status, note, now) {
      const request = requests.get(id);
      if (!request) {
        return null;
      }
      const updated: ApprovalRequest = {
        ...request,
        status,
        note,
        decidedAt: now ?? new Date().toISOString(),
        reason: note ?? (status === "approved" ? "Operator approved." : "Operator rejected."),
      };
      requests.set(id, updated);
      return updated;
    },
  };
}
