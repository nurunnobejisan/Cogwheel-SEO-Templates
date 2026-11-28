/**
 * Human review queue — file-backed store (v2 WP1).
 *
 * Persists queue rows and human decisions in the app's data directory
 * (`seoStudioDataFile`), mirroring the existing training-triples store. The
 * Supabase mirror of the same shape ships as `supabase/migrations/0006_ml_review_queue.sql`
 * for the deployment path; the JSONL file is the single local source of truth.
 *
 * Ingestion (`syncQueue`) pulls pending work from three producers:
 *   - `training-triples.jsonl` raw-tier rows → `teacher_triple` queue rows;
 *   - `ml-review/golden-candidates.jsonl`    → `golden_candidate` rows;
 *   - `ml-review/shadow-disagreements.jsonl` → `shadow_disagreement` rows
 *     (written by the shadow adapter capture path, v2 WP3).
 *
 * Hard rules implemented here:
 *   - a decision requires an authenticated reviewer — there is no code path
 *     that sets `reviewed: true` without one;
 *   - a rejected row is never exported to a builder (exportApproved filters
 *     on the core `isTrainEligible`);
 *   - approving a teacher triple flips it to the `reviewed` tier in the
 *     triple store; rejecting it leaves it `raw` (never training-eligible)
 *     and records the rejection in the queue so it does not resurface.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  decideRow,
  isTrainEligible,
  parseReviewRow,
  queueStats,
  ReviewRowError,
  type AnyReviewRow,
  type ReviewAction,
  type ReviewQueueSource,
} from "../../core/review/queue.ts";
import type { TrainingTriple } from "../../core/training/dataset.ts";
import { seoStudioDataFile } from "../platform/data-dir.ts";

export const QUEUE_FILE = "ml-review-queue.jsonl";
export const GOLDEN_CANDIDATES_FILE = path.join("ml-review", "golden-candidates.jsonl");
export const SHADOW_DISAGREEMENTS_FILE = path.join("ml-review", "shadow-disagreements.jsonl");
export const TRIPLES_FILE = "training-triples.jsonl";

export class ReviewStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewStoreError";
  }
}

async function readJsonl(file: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return raw.split("\n").filter((line) => line.trim().length > 0);
  } catch {
    return [];
  }
}

async function writeJsonl(file: string, rows: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${rows.map((row) => JSON.stringify(row)).join("\n")}${rows.length ? "\n" : ""}`,
    "utf8",
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const out = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${out.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Deterministic 64-hex id for golden-case export (schema requires it). */
export function goldenCaseId(row: Pick<AnyReviewRow, "id" | "input" | "task">): string {
  if (/^[0-9a-f]{64}$/.test(row.id)) return row.id;
  return createHash("sha256")
    .update(`${row.task ?? ""}|${stableStringify(row.input)}`, "utf8")
    .digest("hex");
}

async function readQueue(): Promise<AnyReviewRow[]> {
  const lines = await readJsonl(seoStudioDataFile(QUEUE_FILE));
  const rows: AnyReviewRow[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    rows.push(parseReviewRow(lines[index], index + 1));
  }
  return rows;
}

async function writeQueue(rows: AnyReviewRow[]): Promise<void> {
  await writeJsonl(seoStudioDataFile(QUEUE_FILE), rows);
}

async function readTriples(): Promise<TrainingTriple[]> {
  const lines = await readJsonl(seoStudioDataFile(TRIPLES_FILE));
  const triples: TrainingTriple[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    try {
      triples.push(JSON.parse(lines[index]) as TrainingTriple);
    } catch {
      // A malformed capture line must not take the review page down.
      continue;
    }
  }
  return triples;
}

async function writeTripleDecision(
  tripleId: string,
  patch: { quality: "reviewed"; reviewedBy: string; reviewedAt: string },
): Promise<boolean> {
  const file = seoStudioDataFile(TRIPLES_FILE);
  const triples = await readTriples();
  const target = triples.find((triple) => triple.id === tripleId);
  if (!target) return false;
  target.quality = patch.quality;
  target.reviewedBy = patch.reviewedBy;
  target.reviewedAt = patch.reviewedAt;
  await writeJsonl(file, triples);
  return true;
}

/**
 * Pull pending work from the three producers into the unified queue file.
 * Idempotent: a producer row is enqueued once, keyed by its `refId` (or its
 * own id when it has no refId). Already-reviewed rows are never re-enqueued.
 */
export async function syncQueue(): Promise<{ enqueued: number; total: number }> {
  const rows = await readQueue();
  const known = new Set(rows.map((row) => row.refId ?? row.id));
  const enqueued: AnyReviewRow[] = [];

  // 1. Teacher-drafted triples: raw tier only (reviewed/gold already judged).
  for (const triple of await readTriples()) {
    if (triple.quality !== "raw") continue;
    const refId = `teacher_triple:${triple.id}`;
    if (known.has(refId)) continue;
    known.add(refId);
    enqueued.push({
      id: `rq_${refId}`,
      refId,
      source: "teacher_triple",
      task: "metadata_generation",
      input: triple.audit,
      candidateOutput: triple.expertFix,
      gateResults: [],
      // First-party capture: the capture API enforces consent before storage.
      sourceLicence: "Own",
      enqueuedAt: triple.capturedAt ?? new Date().toISOString(),
      reviewed: false,
    });
  }

  // 2 & 3. Producer-written queues (golden candidates, shadow disagreements).
  for (const [file, source] of [
    [GOLDEN_CANDIDATES_FILE, "golden_candidate"],
    [SHADOW_DISAGREEMENTS_FILE, "shadow_disagreement"],
  ] as const) {
    const lines = await readJsonl(seoStudioDataFile(file));
    for (let index = 0; index < lines.length; index += 1) {
      let producerRow: AnyReviewRow;
      try {
        producerRow = parseReviewRow(lines[index], index + 1);
      } catch {
        // Skip malformed producer lines; the producer is responsible.
        continue;
      }
      if (producerRow.reviewed) continue;
      const refId = producerRow.refId ?? producerRow.id;
      if (known.has(refId)) continue;
      known.add(refId);
      enqueued.push({ ...producerRow, source: source as ReviewQueueSource, reviewed: false });
    }
  }

  if (enqueued.length) {
    await writeQueue([...rows, ...enqueued]);
  }
  return { enqueued: enqueued.length, total: rows.length + enqueued.length };
}

export interface QueueSnapshot {
  rows: AnyReviewRow[];
  stats: ReturnType<typeof queueStats>;
}

/** List the queue (after a sync) with header counts. */
export async function listQueue(): Promise<QueueSnapshot> {
  await syncQueue();
  const rows = await readQueue();
  return { rows, stats: queueStats(rows) };
}

export interface DecisionInput {
  id: string;
  action: ReviewAction;
  reviewer: string;
  reason?: string;
  editedOutput?: unknown;
}

/**
 * Record one human decision. Throws `ReviewStoreError` for unknown rows and
 * rethrows `ReviewRowError` for invariant violations (double decisions,
 * anonymous reviewers, empty edits).
 */
export async function recordDecision(args: DecisionInput): Promise<AnyReviewRow> {
  const rows = await readQueue();
  const index = rows.findIndex((row) => row.id === args.id);
  if (index === -1) {
    throw new ReviewStoreError(`review row ${args.id} not found`);
  }
  const decided = decideRow(rows[index], {
    action: args.action,
    reviewer: args.reviewer,
    reason: args.reason,
    editedOutput: args.editedOutput,
  });
  rows[index] = decided;
  await writeQueue(rows);

  // Mirror the decision into the triple store when the row came from a triple.
  if (decided.refId?.startsWith("teacher_triple:")) {
    const tripleId = decided.refId.slice("teacher_triple:".length);
    if (decided.decision === "approved") {
      await writeTripleDecision(tripleId, {
        quality: "reviewed",
        reviewedBy: decided.reviewer,
        reviewedAt: decided.reviewedAt,
      });
    }
    // Rejected triples stay `raw`: the raw tier is not training-eligible, so
    // a rejection can never leak into a train row through the triple store.
  }
  return decided;
}

export type ExportFormat = "sft" | "dpo" | "golden";
export const EXPORT_FORMATS: readonly ExportFormat[] = ["sft", "dpo", "golden"];

function exportSft(rows: ReviewedOnly[]): string[] {
  return rows
    .filter((row) => row.source === "teacher_triple")
    .map((row) =>
      JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You are the SEO Studio fix writer. Given the audit findings for a page, produce the concrete fix. " +
              "Use only values present in the audit; never invent metrics.",
          },
          { role: "user", content: JSON.stringify(row.input) },
          { role: "assistant", content: JSON.stringify(row.output ?? row.candidateOutput) },
        ],
        metadata: {
          source: "review_queue",
          tenantId: row.refId ?? row.id,
          consent: true,
          licence: row.sourceLicence,
          task: row.task ?? "metadata_generation",
          reviewAction: row.action,
        },
      }),
    );
}

function exportDpo(rows: ReviewedOnly[]): string[] {
  return rows
    .filter((row) => row.source === "shadow_disagreement")
    .map((row) => {
      const rejected = row.originalOutput ?? row.candidateOutput;
      return JSON.stringify({
        prompt: JSON.stringify(row.input),
        chosen: row.output ?? row.candidateOutput,
        rejected,
        metadata: {
          source: "review_queue",
          consent: true,
          licence: row.sourceLicence,
          task: row.task ?? "metadata_generation",
        },
      });
    });
}

function exportGolden(rows: ReviewedOnly[]): string[] {
  return rows
    .filter((row) => row.source === "golden_candidate")
    .map((row) =>
      JSON.stringify({
        id: goldenCaseId(row),
        task: row.task ?? "metadata_generation",
        input: row.input,
        output: row.output ?? row.candidateOutput,
        checks: row.gateResults.filter((gate) => gate.passed).map((gate) => gate.gate),
        licence: row.sourceLicence,
        source: "review_queue",
        split: "eval",
        synthetic: false,
        provenance: "measured",
        note: row.reason ?? `Approved via review queue (${row.action}) by ${row.reviewer}.`,
      }),
    );
}

type ReviewedOnly = Extract<AnyReviewRow, { reviewed: true }>;

/**
 * Export approved rows in the format each consumer reads:
 *   sft    → chat rows for `ml/train/build_sft.py`
 *   dpo    → preference pairs for `ml/train/build_dpo.py`
 *   golden → golden-v2 cases for `scripts/check-golden-set.ts`
 * Rejected rows are structurally excluded.
 */
export async function exportApproved(format: ExportFormat): Promise<string> {
  const rows = (await readQueue()).filter(isTrainEligible) as ReviewedOnly[];
  const lines =
    format === "sft" ? exportSft(rows) : format === "dpo" ? exportDpo(rows) : exportGolden(rows);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

/** Persist an approved export next to the other build inputs. */
export async function saveExport(format: ExportFormat): Promise<string> {
  const content = await exportApproved(format);
  const file = seoStudioDataFile(path.join("review-exports", `${format}-approved.jsonl`));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
  return file;
}

export { ReviewRowError };
