/**
 * Outcome-logging persistence (JSONL, local-first).
 *
 * Uses `cogwheelDataFile` so the location honours `COGWHEEL_DATA_DIR` and falls
 * back to the repo `data/` folder locally / temp dir on serverless. Outcome
 * records are upserted by id so re-measuring is idempotent.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { cogwheelDataFile } from "../../lib/platform/data-dir.ts";
import type { ChangeEvent, OutcomeRecord } from "./types.ts";

const CHANGES_FILE = "outcome-changes.jsonl";
const OUTCOMES_FILE = "outcomes.jsonl";

async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(cogwheelDataFile(file), "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

async function appendJsonl(file: string, value: unknown): Promise<void> {
  const target = cogwheelDataFile(file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.appendFile(target, `${JSON.stringify(value)}\n`, "utf8");
}

export function readChanges(): Promise<ChangeEvent[]> {
  return readJsonl<ChangeEvent>(CHANGES_FILE);
}

export function readOutcomes(): Promise<OutcomeRecord[]> {
  return readJsonl<OutcomeRecord>(OUTCOMES_FILE);
}

export async function appendChange(change: ChangeEvent): Promise<void> {
  await appendJsonl(CHANGES_FILE, change);
}

export async function upsertOutcome(outcome: OutcomeRecord): Promise<void> {
  const all = await readOutcomes();
  const index = all.findIndex((entry) => entry.id === outcome.id);
  if (index >= 0) all[index] = outcome;
  else all.push(outcome);
  const target = cogwheelDataFile(OUTCOMES_FILE);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, all.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
}
