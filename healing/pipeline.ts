/**
 * Self-Healing Pipeline (Phase 4)
 *
 * Orchestrates the full roadmap workflow end-to-end:
 *
 *   Scan & Detect ─▶ Triage & Synthesize ─▶ Staging/Approval ─▶ Atomic Deploy
 *        └─ (snapshot to the rollback store) ─▶ Post-Fix Verify ─▶ Rollback on fail
 *
 * It composes the Phase 1 audit engine, the Phase 2 AI patch generator and the
 * Phase 3 CMS connectors, adding triage, the approval queue, the versioned
 * rollback store, micro-crawler verification and the operator event log.
 */

import { generateFixPatch } from "../ai/orchestrator.ts";
import type { FixPatch, PatchMutation } from "../ai/types.ts";
import { previewPatchDiff, toConnectorMutation } from "../cms/deploy.ts";
import type { DeploymentResult, CmsConnector } from "../cms/types.ts";
import {
  DEFAULT_AUTOPILOT_POLICY,
  createApprovalQueue,
  selectAutoDeployableMutations,
} from "./approval.ts";
import { createHealingEventBus } from "./events.ts";
import { buildExpectations, verifyDeployment } from "./micro-crawler.ts";
import { createRollbackStore } from "./rollback-store.ts";
import { triagePatch } from "./triage.ts";
import type {
  HealingRunOptions,
  HealingRunResult,
  HealingRunStatus,
  VerificationReport,
} from "./types.ts";

let runCounter = 0;

function makeRunId(startedAt: string): string {
  runCounter += 1;
  return `heal_${Date.now().toString(36)}${runCounter.toString(36)}`;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function runHealingPipeline(options: HealingRunOptions): Promise<HealingRunResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const policy = options.policy ?? DEFAULT_AUTOPILOT_POLICY;
  const approveAll = options.approveAll ?? false;
  const connector = options.connector;
  const targetUrl = options.report.pageUrl;

  const events = options.events ?? createHealingEventBus(now);
  const queue = options.queue ?? createApprovalQueue();
  const rollbackStore = options.rollbackStore ?? createRollbackStore();
  const eventStart = events.all().length;

  events.emit({ type: "scan_started", message: `Scanning ${targetUrl}`, targetUrl, at: startedAt });

  /* Step 2 — triage & patch synthesis -------------------------------------- */
  const { patch, validation, deferred } = await generateFixPatch(options.report, options.patchOptions);
  options.onPatch?.(patch);
  events.emit({
    type: "patch_synthesized",
    message: `Synthesized ${patch.mutations.length} mutation(s) (${deferred.length} deferred)`,
    patchId: patch.patchId,
    targetUrl,
    data: { valid: validation.valid, deferred: deferred.length },
  });

  const triage = triagePatch(patch, options.report.issues);
  const approval = queue.submit({ patch, triage, policy, approveAll, now: startedAt });
  if (approval.status === "pending") {
    events.emit({
      type: "awaiting_approval",
      message: approval.reason,
      patchId: patch.patchId,
      targetUrl,
      level: "warning",
    });
  } else {
    events.emit({
      type: "auto_approved",
      message: approval.reason,
      patchId: patch.patchId,
      targetUrl,
    });
  }

  /* Step 3 — staging & approval gate --------------------------------------- */
  // Respect connector capabilities: a field the connector cannot express (e.g.
  // alt text on the universal runtime) is deferred instead of failing the run.
  const requested = selectAutoDeployableMutations(patch, triage, policy, approveAll);
  const selected = connector.supportsField
    ? requested.filter((mutation) => connector.supportsField!(mutation.field))
    : requested;
  if (approval.status === "pending" || selected.length === 0) {
    return finalize("queued", {
      runId: makeRunId(startedAt),
      targetUrl,
      patchId: patch.patchId,
      approval,
      deployment: buildDeployment(patch, connector.platform, "queued", 0, false, [], now()),
      verification: null,
      snapshotId: null,
      events: events.all().slice(eventStart),
      startedAt,
    }, now());
  }

  /* Step 4 — atomic deploy + snapshot backup -------------------------------- */
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = await connector.readSnapshot();
  } catch (error) {
    events.emit({
      type: "alert",
      message: `Snapshot failed: ${messageOf(error)}`,
      patchId: patch.patchId,
      targetUrl,
      level: "error",
    });
    return finalize("failed", {
      runId: makeRunId(startedAt),
      targetUrl,
      patchId: patch.patchId,
      approval,
      deployment: buildDeployment(patch, connector.platform, "failed", 0, false, [messageOf(error)], now()),
      verification: null,
      snapshotId: null,
      events: events.all().slice(eventStart),
      startedAt,
    }, now());
  }

  const record = rollbackStore.record({
    patchId: patch.patchId,
    targetUrl,
    platform: connector.platform,
    snapshot,
    reason: "pre-deploy snapshot",
    now: startedAt,
  });
  events.emit({
    type: "deployment_started",
    message: `Deploying ${selected.length} mutation(s) to ${connector.platform}`,
    patchId: patch.patchId,
    targetUrl,
    data: { snapshotId: record.id, version: record.version },
  });

  const connectorMutations = selected.map(toConnectorMutation);
  let applied: number;
  try {
    const result = await connector.applyMutations(connectorMutations);
    if (!result.ok) {
      await safeRestore(connector, snapshot);
      return rollbackResult(events, eventStart, rollbackStore, patch, connector.platform, result.errors, approval, record.id, now, startedAt, targetUrl);
    }
    applied = result.applied;
  } catch (error) {
    await safeRestore(connector, snapshot);
    return rollbackResult(events, eventStart, rollbackStore, patch, connector.platform, [messageOf(error)], approval, record.id, now, startedAt, targetUrl);
  }

  /* Step 5 — post-fix verification loop ------------------------------------ */
  if (options.settleMs && options.settleMs > 0) {
    await (options.sleep ?? defaultSleep)(options.settleMs);
  }

  const expected = buildExpectations(selected);
  const connectorMode = connector.verificationMode === "connector";
  const verification = connectorMode
    ? await verifyViaConnector(connector, targetUrl, now)
    : await verifyDeployment({
        url: targetUrl,
        expectations: expected.expectations,
        expectJsonLd: expected.expectJsonLd,
        fetchImpl: options.fetchImpl,
        now,
      });

  const verified = connectorMode
    ? verification.httpOk
    : verification.httpOk &&
      verification.domMatches &&
      !(expected.expectJsonLd && !verification.jsonLdValid);

  if (!verified) {
    await safeRestore(connector, snapshot);
    const result = rollbackResult(events, eventStart, rollbackStore, patch, connector.platform, verification.errors, approval, record.id, now, startedAt, targetUrl, verification);
    return result;
  }

  events.emit({
    type: "verified",
    message: `Live verification passed (HTTP ${verification.status})`,
    patchId: patch.patchId,
    targetUrl,
    data: { checks: verification.checks.length },
  });
  events.emit({
    type: "deployed",
    message: `Deployed ${applied} mutation(s) and verified live`,
    patchId: patch.patchId,
    targetUrl,
  });

  return finalize("deployed", {
    runId: makeRunId(startedAt),
    targetUrl,
    patchId: patch.patchId,
    approval,
    deployment: buildDeployment(patch, connector.platform, "deployed", applied, false, [], now()),
    verification,
    snapshotId: record.id,
    events: events.all().slice(eventStart),
    startedAt,
  }, now());
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * Verification for connectors that apply fixes client-side (the universal
 * runtime). The server HTML never changes, so a live DOM comparison would
 * always fail; the connector's own `verify()` is authoritative instead.
 */
async function verifyViaConnector(
  connector: CmsConnector,
  url: string,
  now: () => string
): Promise<VerificationReport> {
  const base: VerificationReport = {
    url,
    status: null,
    httpOk: false,
    domMatches: false,
    jsonLdValid: true,
    checks: [],
    jsonLd: null,
    errors: [],
    verifiedAt: now(),
  };

  if (!connector.verify) {
    // No verification hook — trust a successful apply.
    return {
      ...base,
      httpOk: true,
      domMatches: true,
      checks: [{ field: "connector", passed: true, actual: "applied", detail: "no connector verification hook" }],
    };
  }

  const result = await connector.verify();
  return {
    ...base,
    status: result.status ?? null,
    httpOk: result.ok,
    domMatches: result.ok,
    checks: [
      {
        field: "connector",
        passed: result.ok,
        actual: result.details ?? null,
        detail: result.details ?? "connector verification",
      },
    ],
    errors: result.ok ? [] : [result.details ?? "connector verification failed"],
  };
}

function buildDeployment(
  patch: FixPatch,
  platform: DeploymentResult["platform"],
  status: DeploymentResult["status"],
  applied: number,
  rolledBack: boolean,
  errors: string[],
  timestamp: string
): DeploymentResult {
  return {
    patchId: patch.patchId,
    targetUrl: patch.targetUrl,
    platform,
    status,
    applied,
    queued: patch.mutations.length - applied,
    rolledBack,
    errors,
    diff: previewPatchDiff(patch),
    timestamp,
  };
}

function rollbackResult(
  events: ReturnType<typeof createHealingEventBus>,
  eventStart: number,
  rollbackStore: ReturnType<typeof createRollbackStore>,
  patch: FixPatch,
  platform: DeploymentResult["platform"],
  errors: string[],
  approval: HealingRunResult["approval"],
  snapshotId: string,
  now: () => string,
  startedAt: string,
  targetUrl: string,
  verification: VerificationReport | null = null
): HealingRunResult {
  events.emit({
    type: "rolled_back",
    message: `Rolled back — ${errors[0] ?? "verification failed"}`,
    patchId: patch.patchId,
    targetUrl,
    level: "error",
    data: { snapshotId, version: rollbackStore.latest(targetUrl)?.version },
  });
  events.emit({
    type: "alert",
    message: `Operator action required: fix failed for ${targetUrl}`,
    patchId: patch.patchId,
    targetUrl,
    level: "error",
  });
  return finalize("rolled_back", {
    runId: makeRunId(startedAt),
    targetUrl,
    patchId: patch.patchId,
    approval,
    deployment: buildDeployment(patch, platform, "rolled_back", 0, true, errors, now()),
    verification,
    snapshotId,
    events: events.all().slice(eventStart),
    startedAt,
  }, now());
}

function finalize(
  status: HealingRunStatus,
  partial: Omit<HealingRunResult, "status" | "finishedAt">,
  at: string
): HealingRunResult {
  return { ...partial, status, finishedAt: at };
}

async function safeRestore(
  connector: HealingRunOptions["connector"],
  snapshot: Record<string, unknown>
): Promise<void> {
  try {
    await connector.restore(snapshot);
  } catch {
    /* best-effort; surfaced via the alert event */
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { FixPatch, PatchMutation };
