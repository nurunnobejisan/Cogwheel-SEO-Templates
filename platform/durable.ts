/**
 * Durable Platform Runtime (Phase 5.1)
 *
 * Builds the Phase 5 gateway on top of a `PersistenceAdapter`:
 *
 *   1. hydrate  — load audit log, history, credentials, patches, snapshots
 *   2. wire     — attach write-through hooks to every store
 *   3. flush    — drain the write queue after each request
 *
 * Nothing else in the gateway changes: the same routes, RBAC, approval and
 * rollback logic run whether the stores are in memory or on disk.
 */

import type { FixPatch } from "../ai/types.ts";
import type { CmsCredential } from "../cms/types.ts";
import type { SnapshotRecord } from "../healing/types.ts";
import { createAuditLog } from "./audit-log.ts";
import { createCredentialStore } from "./credential-store.ts";
import { createDeploymentHistory } from "./history.ts";
import { createPatchStore } from "./patch-store.ts";
import { COLLECTIONS, type PersistenceAdapter } from "./persistence/adapter.ts";
import { createPlatformGateway, type GatewayOptions, type PlatformGateway } from "./gateway.ts";
import { createRollbackStore } from "../healing/rollback-store.ts";
import type { AuditLogEntry, DeploymentHistoryEntry } from "./types.ts";

export interface DurablePlatformOptions extends GatewayOptions {
  adapter: PersistenceAdapter;
}

export interface DurablePlatform {
  gateway: PlatformGateway;
  adapter: PersistenceAdapter;
  /** Drain all queued write-through operations. */
  flush(): Promise<void>;
  /** Flush and release adapter resources. */
  close(): Promise<void>;
}

interface WriteQueue {
  enqueue(operation: () => Promise<void>): void;
  flush(): Promise<void>;
  size(): number;
}

/**
 * Sequential write-behind queue. Operations run one at a time (preserving
 * order); failures are collected so `flush()` can surface the first one without
 * poisoning the chain.
 */
export function createWriteQueue(): WriteQueue {
  let chain: Promise<void> = Promise.resolve();
  let pending = 0;
  let errors: unknown[] = [];

  return {
    enqueue(operation) {
      pending += 1;
      chain = chain.then(async () => {
        try {
          await operation();
        } catch (error) {
          errors.push(error);
        } finally {
          pending -= 1;
        }
      });
    },
    async flush() {
      let current: Promise<void>;
      do {
        current = chain;
        await current;
      } while (current !== chain);

      if (errors.length > 0) {
        const [first] = errors;
        errors = [];
        throw first;
      }
    },
    size() {
      return pending;
    },
  };
}

export async function createDurablePlatform(
  options: DurablePlatformOptions
): Promise<DurablePlatform> {
  const { adapter, ...gatewayOptions } = options;

  const [auditEntries, deploymentEntries, credentialRecords, patchRecords, snapshotRecords] =
    await Promise.all([
      adapter.readAll<AuditLogEntry>(COLLECTIONS.auditLog),
      adapter.readAll<DeploymentHistoryEntry>(COLLECTIONS.deployments),
      adapter.readAll<CmsCredential>(COLLECTIONS.credentials),
      adapter.readAll<FixPatch>(COLLECTIONS.patches),
      adapter.readAll<SnapshotRecord>(COLLECTIONS.snapshots),
    ]);

  const writes = createWriteQueue();

  const auditLog = createAuditLog({
    now: gatewayOptions.now,
    initial: auditEntries,
    onAppend: (entry) => writes.enqueue(() => adapter.append(COLLECTIONS.auditLog, entry)),
  });

  const history = createDeploymentHistory(gatewayOptions.now, deploymentEntries, {
    onRecord: (entry) => writes.enqueue(() => adapter.put(COLLECTIONS.deployments, entry.id, entry)),
    onUpdate: (entry) => writes.enqueue(() => adapter.put(COLLECTIONS.deployments, entry.id, entry)),
  });

  const credentials = createCredentialStore(credentialRecords, {
    onPut: (credential) =>
      writes.enqueue(() => adapter.put(COLLECTIONS.credentials, credential.id, credential)),
    onDelete: (id) => writes.enqueue(() => adapter.remove(COLLECTIONS.credentials, id)),
  });

  const patches = createPatchStore(patchRecords, {
    onPut: (patch) => writes.enqueue(() => adapter.put(COLLECTIONS.patches, patch.patchId, patch)),
  });

  const rollbackStore = createRollbackStore(snapshotRecords, {
    onRecord: (record) => writes.enqueue(() => adapter.put(COLLECTIONS.snapshots, record.id, record)),
  });

  const gateway = createPlatformGateway({
    ...gatewayOptions,
    auditLog,
    history,
    credentials,
    patches,
    rollbackStore,
    onRequestComplete: () => writes.flush(),
  });

  return {
    gateway,
    adapter,
    flush: () => writes.flush(),
    close: async () => {
      await writes.flush();
      await adapter.close?.();
    },
  };
}