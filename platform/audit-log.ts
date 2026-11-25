/**
 * Immutable, Hash-Chained Audit Log (Phase 5)
 *
 * Every patch event — generation, approval, deployment, verification, rollback,
 * credential change — is appended here with the actor, timestamp and before/
 * after values. Entries are linked by SHA-256 so tampering (editing, deleting or
 * reordering an entry) is detectable via `verify()`.
 *
 * The interface is append-only by design: there is no update or delete method.
 */

import { createHash } from "node:crypto";
import type { Principal, Role } from "./types.ts";
import type { AuditLogEntry } from "./types.ts";

export interface AppendAuditInput {
  action: string;
  actor?: string;
  role?: Role;
  principal?: Principal;
  organizationId?: string;
  targetUrl?: string;
  patchId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  at?: string;
}

export interface AuditLogVerifyResult {
  valid: boolean;
  entries: number;
  /** Sequence number of the first broken link, if any. */
  brokenAt: number | null;
  reason?: string;
}

export interface AuditLog {
  append(input: AppendAuditInput): AuditLogEntry;
  all(): AuditLogEntry[];
  get(sequence: number): AuditLogEntry | null;
  forPatch(patchId: string): AuditLogEntry[];
  forActor(actorId: string): AuditLogEntry[];
  size(): number;
  head(): AuditLogEntry | null;
  verify(): AuditLogVerifyResult;
}

/** Deterministic JSON: object keys are sorted at every level. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

/** SHA-256 over the canonical entry payload plus the previous entry's hash. */
export function hashAuditEntry(
  entry: Omit<AuditLogEntry, "hash">,
  hashImpl: (input: string) => string = (input) =>
    createHash("sha256").update(input).digest("hex")
): string {
  return hashImpl(canonicalJson(entry) + entry.previousHash);
}

export interface CreateAuditLogOptions {
  now?: () => string;
  hash?: (input: string) => string;
}

export function createAuditLog(options: CreateAuditLogOptions = {}): AuditLog {
  const now = options.now ?? (() => new Date().toISOString());
  const hashImpl = options.hash;
  const entries: AuditLogEntry[] = [];

  function hashOf(entry: Omit<AuditLogEntry, "hash">): string {
    return hashImpl ? hashAuditEntry(entry, hashImpl) : hashAuditEntry(entry);
  }

  return {
    append(input) {
      const sequence = entries.length + 1;
      const previousHash = entries.length > 0 ? entries[entries.length - 1]!.hash : "";
      const base: Omit<AuditLogEntry, "hash"> = {
        sequence,
        id: `alog_${String(sequence).padStart(6, "0")}`,
        at: input.at ?? now(),
        actor: input.principal?.id ?? input.actor ?? "system",
        role: input.principal?.role ?? input.role ?? "admin",
        action: input.action,
        organizationId: input.principal?.organizationId ?? input.organizationId,
        targetUrl: input.targetUrl,
        patchId: input.patchId,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
        previousHash,
      };
      const entry: AuditLogEntry = Object.freeze({ ...base, hash: hashOf(base) });
      entries.push(entry);
      return { ...entry };
    },

    all() {
      return entries.map((entry) => ({ ...entry }));
    },

    get(sequence) {
      const entry = entries.find((candidate) => candidate.sequence === sequence);
      return entry ? { ...entry } : null;
    },

    forPatch(patchId) {
      return entries.filter((entry) => entry.patchId === patchId).map((entry) => ({ ...entry }));
    },

    forActor(actorId) {
      return entries.filter((entry) => entry.actor === actorId).map((entry) => ({ ...entry }));
    },

    size() {
      return entries.length;
    },

    head() {
      const last = entries[entries.length - 1];
      return last ? { ...last } : null;
    },

    verify() {
      let previousHash = "";
      for (const entry of entries) {
        const { hash: recordedHash, ...rest } = entry;
        if (rest.previousHash !== previousHash) {
          return {
            valid: false,
            entries: entries.length,
            brokenAt: entry.sequence,
            reason: "previousHash does not match the prior entry",
          };
        }
        if (hashOf(rest) !== recordedHash) {
          return {
            valid: false,
            entries: entries.length,
            brokenAt: entry.sequence,
            reason: "entry hash does not match its contents",
          };
        }
        previousHash = recordedHash;
      }
      return { valid: true, entries: entries.length, brokenAt: null };
    },
  };
}