/**
 * Local-first visibility run store.
 *
 * Runs are appended as JSONL under SEO_STUDIO_DATA_DIR (or the OS temp dir).
 * Production can swap this for Supabase by implementing the same three
 * functions; the rest of the module only depends on this interface.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { VisibilityRun } from "./types.ts";

function storeFile(): string {
  return path.join(process.env.SEO_STUDIO_DATA_DIR || path.join(os.tmpdir(), "seo-studio-visibility"), "runs.jsonl");
}

export async function saveVisibilityRun(run: VisibilityRun): Promise<void> {
  const file = storeFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(run)}\n`, "utf8");
}

export async function listVisibilityRuns(filter: { targetUrl?: string; limit?: number } = {}): Promise<VisibilityRun[]> {
  let raw = "";
  try {
    raw = await fs.readFile(storeFile(), "utf8");
  } catch {
    return [];
  }
  const runs: VisibilityRun[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const run = JSON.parse(line) as VisibilityRun;
      if (filter.targetUrl && run.targetUrl !== filter.targetUrl) continue;
      runs.push(run);
    } catch {
      // Ignore a corrupt line rather than losing the whole history.
    }
  }
  const limit = filter.limit ?? 50;
  return runs.slice(-limit);
}

export async function latestVisibilityRun(targetUrl: string): Promise<VisibilityRun | null> {
  const runs = await listVisibilityRuns({ targetUrl, limit: 1 });
  return runs[0] ?? null;
}
