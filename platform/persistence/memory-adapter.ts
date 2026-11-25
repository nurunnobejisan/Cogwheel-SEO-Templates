/**
 * In-Memory Persistence Adapter (Phase 5.1)
 *
 * Default for tests and ephemeral runs. Mirrors the durable adapter's semantics
 * so switching to files does not change behaviour.
 */

import type { PersistenceAdapter } from "./adapter.ts";
import { recordKey } from "./adapter.ts";

export interface MemoryAdapterOptions {
  /** Seed state, e.g. to simulate a restart. */
  seed?: Record<string, unknown[]>;
}

export function createMemoryAdapter(options: MemoryAdapterOptions = {}): PersistenceAdapter {
  const collections = new Map<string, unknown[]>();
  for (const [name, records] of Object.entries(options.seed ?? {})) {
    collections.set(name, [...records]);
  }

  function recordsOf(collection: string): unknown[] {
    let records = collections.get(collection);
    if (!records) {
      records = [];
      collections.set(collection, records);
    }
    return records;
  }

  return {
    async readAll<T>(collection: string): Promise<T[]> {
      return [...recordsOf(collection)] as T[];
    },
    async append<T>(collection: string, record: T): Promise<void> {
      recordsOf(collection).push(record);
    },
    async put<T>(collection: string, key: string, record: T): Promise<void> {
      const records = recordsOf(collection);
      const index = records.findIndex((entry) => recordKey(entry) === key);
      if (index >= 0) {
        records[index] = record;
      } else {
        records.push(record);
      }
    },
    async remove(collection: string, key: string): Promise<void> {
      const records = recordsOf(collection);
      const index = records.findIndex((entry) => recordKey(entry) === key);
      if (index >= 0) {
        records.splice(index, 1);
      }
    },
  };
}