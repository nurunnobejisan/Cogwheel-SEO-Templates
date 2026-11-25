/**
 * NDJSON File Persistence Adapter (Phase 5.1)
 *
 * Durable, dependency-free storage: one `<collection>.ndjson` file per
 * collection under `dir`. Appends are cheap (`fs.appendFile`); upserts and
 * deletes rewrite the file atomically (temp file + rename) under a per-
 * collection lock so concurrent writes cannot corrupt it.
 *
 * Suitable for a container volume, a mounted disk, or local development. Swap
 * in the Supabase/Postgres adapter for multi-instance deployments.
 */

import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PersistenceAdapter } from "./adapter.ts";
import { recordKey } from "./adapter.ts";

export interface JsonFileAdapterOptions {
  dir: string;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "ENOENT";
}

export function createJsonFileAdapter(options: JsonFileAdapterOptions): PersistenceAdapter {
  const dir = options.dir;
  const locks = new Map<string, Promise<unknown>>();

  /**
   * Serialize every operation on a collection. `readAll` is locked too so it
   * never observes a half-written file.
   */
  function withLock<T>(collection: string, task: () => Promise<T>): Promise<T> {
    const previous = locks.get(collection) ?? Promise.resolve();
    const next = previous.then(task, task);
    locks.set(
      collection,
      next.then(
        () => undefined,
        () => undefined
      )
    );
    return next;
  }

  function fileOf(collection: string): string {
    return join(dir, `${collection}.ndjson`);
  }

  async function readRecords(collection: string): Promise<unknown[]> {
    let text: string;
    try {
      text = await readFile(fileOf(collection), "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        return [];
      }
      throw error;
    }
    const records: unknown[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        records.push(JSON.parse(trimmed));
      } catch {
        // Skip a partially written trailing line rather than failing the read.
      }
    }
    return records;
  }

  async function writeAll(collection: string, records: unknown[]): Promise<void> {
    await mkdir(dir, { recursive: true });
    const target = fileOf(collection);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    const payload =
      records.length > 0 ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n` : "";
    await writeFile(tmp, payload, "utf8");
    await rename(tmp, target);
  }

  return {
    readAll<T>(collection: string): Promise<T[]> {
      return withLock(collection, async () => (await readRecords(collection)) as T[]);
    },

    append<T>(collection: string, record: T): Promise<void> {
      return withLock(collection, async () => {
        await mkdir(dir, { recursive: true });
        await appendFile(fileOf(collection), `${JSON.stringify(record)}\n`, "utf8");
      });
    },

    put<T>(collection: string, key: string, record: T): Promise<void> {
      return withLock(collection, async () => {
        const records = await readRecords(collection);
        const index = records.findIndex((entry) => recordKey(entry) === key);
        if (index >= 0) {
          records[index] = record;
        } else {
          records.push(record);
        }
        await writeAll(collection, records);
      });
    },

    remove(collection: string, key: string): Promise<void> {
      return withLock(collection, async () => {
        const records = await readRecords(collection);
        const index = records.findIndex((entry) => recordKey(entry) === key);
        if (index < 0) {
          return;
        }
        records.splice(index, 1);
        await writeAll(collection, records);
      });
    },

    async close(): Promise<void> {
      await Promise.all([...locks.values()]);
    },
  };
}