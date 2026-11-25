/**
 * Persistence Adapter Contract (Phase 5.1)
 *
 * A minimal document/append store the platform runtime hydrates from and
 * writes through to. Implementations: in-memory (tests), NDJSON files (durable
 * local / container volume) and any hosted KV/SQL (Supabase, Redis) via the
 * same four methods.
 *
 * Collections are logical names: "audit_log", "deployments", "credentials",
 * "patches", "snapshots".
 */

export interface PersistenceAdapter {
  /** Load every record in a collection (append order where relevant). */
  readAll<T>(collection: string): Promise<T[]>;
  /** Append a record to an append-only collection (audit log, history). */
  append<T>(collection: string, record: T): Promise<void>;
  /** Upsert a record by key (credentials, patches, snapshots). */
  put<T>(collection: string, key: string, record: T): Promise<void>;
  /** Remove a record by key. */
  remove(collection: string, key: string): Promise<void>;
  /** Flush/close underlying handles, if any. */
  close?(): Promise<void>;
}

export const COLLECTIONS = {
  auditLog: "audit_log",
  deployments: "deployments",
  credentials: "credentials",
  patches: "patches",
  snapshots: "snapshots",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Stable key for a record: `id` when present, else `patchId`. */
export function recordKey(record: unknown): string {
  if (record && typeof record === "object") {
    const candidate = record as { id?: unknown; patchId?: unknown };
    if (typeof candidate.id === "string") {
      return candidate.id;
    }
    if (typeof candidate.patchId === "string") {
      return candidate.patchId;
    }
  }
  throw new Error("record has no id/patchId to key on");
}