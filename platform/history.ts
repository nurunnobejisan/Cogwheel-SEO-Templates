/**
 * Deployment History & One-Click Undo (Phase 5)
 *
 * Every deployment is recorded with the snapshot that captures its pre-change
 * state. `undoDeployment` restores that snapshot through the same connector,
 * marks the entry undone, and writes an immutable audit-log event — the
 * roadmap's "One-Click Undo System".
 */

import type { CmsConnector, CmsPlatform, PatchDiffEntry } from "../cms/types.ts";
import type { HealingRunStatus } from "../healing/types.ts";
import type { RollbackStore } from "../healing/rollback-store.ts";
import { conflict, notFound } from "./errors.ts";
import type { AuditLog } from "./audit-log.ts";
import type { DeploymentHistoryEntry, Principal } from "./types.ts";

export interface RecordDeploymentInput {
  runId: string;
  patchId: string;
  targetUrl: string;
  platform: CmsPlatform;
  status: HealingRunStatus;
  actor: string;
  snapshotId: string | null;
  diff: PatchDiffEntry[];
  applied: number;
  rolledBack: boolean;
  at?: string;
}

export interface DeploymentHistory {
  record(input: RecordDeploymentInput): DeploymentHistoryEntry;
  all(): DeploymentHistoryEntry[];
  get(id: string): DeploymentHistoryEntry | null;
  forTarget(targetUrl: string): DeploymentHistoryEntry[];
  undoable(): DeploymentHistoryEntry[];
  markUndone(id: string, by: string, at?: string): DeploymentHistoryEntry | null;
  size(): number;
}

export interface HistoryHooks {
  onRecord?: (entry: DeploymentHistoryEntry) => void;
  onUpdate?: (entry: DeploymentHistoryEntry) => void;
}

let counter = 0;

function nextId(): string {
  counter += 1;
  return `dep_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createDeploymentHistory(
  now: () => string = () => new Date().toISOString(),
  initial: DeploymentHistoryEntry[] = [],
  hooks: HistoryHooks = {}
): DeploymentHistory {
  const entries = new Map<string, DeploymentHistoryEntry>();
  for (const entry of initial) {
    entries.set(entry.id, entry);
  }

  return {
    record(input) {
      const entry: DeploymentHistoryEntry = {
        id: nextId(),
        runId: input.runId,
        patchId: input.patchId,
        targetUrl: input.targetUrl,
        platform: input.platform,
        status: input.status,
        actor: input.actor,
        at: input.at ?? now(),
        snapshotId: input.snapshotId,
        diff: input.diff.map((line) => ({ ...line })),
        applied: input.applied,
        rolledBack: input.rolledBack,
        undone: false,
      };
      entries.set(entry.id, entry);
      hooks.onRecord?.({ ...entry });
      return { ...entry };
    },

    all() {
      return [...entries.values()].map((entry) => ({ ...entry }));
    },

    get(id) {
      const entry = entries.get(id);
      return entry ? { ...entry } : null;
    },

    forTarget(targetUrl) {
      return [...entries.values()]
        .filter((entry) => entry.targetUrl === targetUrl)
        .map((entry) => ({ ...entry }));
    },

    undoable() {
      return [...entries.values()]
        .filter((entry) => !entry.undone && entry.snapshotId !== null)
        .map((entry) => ({ ...entry }));
    },

    markUndone(id, by, at) {
      const entry = entries.get(id);
      if (!entry) {
        return null;
      }
      const updated: DeploymentHistoryEntry = {
        ...entry,
        undone: true,
        undoneAt: at ?? now(),
        undoneBy: by,
      };
      entries.set(id, updated);
      hooks.onUpdate?.({ ...updated });
      return { ...updated };
    },

    size() {
      return entries.size;
    },
  };
}

export interface UndoDependencies {
  history: DeploymentHistory;
  rollbackStore: RollbackStore;
  resolveConnector: (targetUrl: string) => CmsConnector | null;
  auditLog?: AuditLog;
  principal: Principal;
  now?: () => string;
}

export interface UndoResult {
  entry: DeploymentHistoryEntry;
  restoredFields: string[];
}

/** Restore a historical deployment's pre-change snapshot. */
export async function undoDeployment(
  entryId: string,
  deps: UndoDependencies
): Promise<UndoResult> {
  const entry = deps.history.get(entryId);
  if (!entry) {
    throw notFound(`deployment "${entryId}" not found`);
  }
  if (entry.undone) {
    throw conflict(`deployment "${entryId}" was already undone at ${entry.undoneAt}`);
  }
  if (!entry.snapshotId) {
    throw conflict(`deployment "${entryId}" has no snapshot to restore`);
  }
  const snapshot = deps.rollbackStore.get(entry.snapshotId);
  if (!snapshot) {
    throw notFound(`snapshot "${entry.snapshotId}" not found`);
  }
  const connector = deps.resolveConnector(entry.targetUrl);
  if (!connector) {
    throw notFound(`no connector registered for ${entry.targetUrl}`);
  }

  await connector.restore(snapshot.snapshot);

  const at = (deps.now ?? (() => new Date().toISOString()))();
  const updated = deps.history.markUndone(entryId, deps.principal.id, at) ?? entry;
  deps.auditLog?.append({
    principal: deps.principal,
    action: "history.undo",
    targetUrl: entry.targetUrl,
    patchId: entry.patchId,
    before: { snapshotId: entry.snapshotId },
    after: { undone: true },
    metadata: { deploymentId: entry.id },
    at,
  });

  return { entry: updated, restoredFields: Object.keys(snapshot.snapshot) };
}