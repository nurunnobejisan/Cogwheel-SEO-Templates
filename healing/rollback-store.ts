/**
 * Versioned Rollback Store (Phase 4, step 4)
 *
 * Before any write, the pre-change state of the target's fields is persisted
 * here with a monotonically increasing version per target URL, so a failed fix
 * can be restored exactly. The interface matches a durable PostgreSQL/Redis
 * store; the default implementation is in-memory.
 */

import type { CmsPlatform } from "../cms/types.ts";
import type { SnapshotRecord } from "./types.ts";

export interface RecordSnapshotInput {
  patchId: string;
  targetUrl: string;
  platform: CmsPlatform;
  snapshot: Record<string, unknown>;
  reason?: string;
  now?: string;
}

export interface RollbackStore {
  record(input: RecordSnapshotInput): SnapshotRecord;
  get(id: string): SnapshotRecord | null;
  latest(targetUrl: string): SnapshotRecord | null;
  history(targetUrl: string): SnapshotRecord[];
  size(): number;
}

let counter = 0;

function nextId(): string {
  counter += 1;
  return `snap_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createRollbackStore(): RollbackStore {
  const byId = new Map<string, SnapshotRecord>();
  const byTarget = new Map<string, SnapshotRecord[]>();

  return {
    record(input: RecordSnapshotInput): SnapshotRecord {
      const history = byTarget.get(input.targetUrl) ?? [];
      const record: SnapshotRecord = {
        id: nextId(),
        version: history.length + 1,
        patchId: input.patchId,
        targetUrl: input.targetUrl,
        platform: input.platform,
        snapshot: input.snapshot,
        createdAt: input.now ?? new Date().toISOString(),
        reason: input.reason ?? "pre-deploy snapshot",
      };
      history.push(record);
      byTarget.set(input.targetUrl, history);
      byId.set(record.id, record);
      return record;
    },

    get(id) {
      return byId.get(id) ?? null;
    },

    latest(targetUrl) {
      const history = byTarget.get(targetUrl);
      return history && history.length > 0 ? history[history.length - 1]! : null;
    },

    history(targetUrl) {
      return [...(byTarget.get(targetUrl) ?? [])];
    },

    size() {
      return byId.size;
    },
  };
}
