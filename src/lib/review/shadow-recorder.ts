/**
 * Shadow-mode disagreement recorder (v2 WP3 → WP1 queue).
 *
 * When `AI_ADAPTER_MODE=shadow`, the adapter and the standard provider both
 * run and are gated. When their outputs disagree, a row is appended to the
 * WP1 review-queue producer file (`ml-review/shadow-disagreements.jsonl`) so
 * a human can judge which output is right — feeding the DPO builder (WP2).
 *
 * Hard rules:
 * - monitoring counters never store prompts or outputs (v1); this file is
 *   different: it exists *for* human review, so truncated input/output
 *   previews are stored, operator-accessible only, never committed to git
 *   (`data/` is gitignored);
 * - `metadata.consent` defaults to **false** — client-derived content stays
 *   out of training exports until an explicit per-property consent flag
 *   exists (v3); the DPO builder therefore refuses these rows by default;
 * - write failures are swallowed: a review-queue hiccup must never break
 *   generation.
 */

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { seoStudioDataFile } from "@/lib/platform/data-dir";

export const SHADOW_DISAGREEMENTS_FILE = path.join("ml-review", "shadow-disagreements.jsonl");

const MAX_FIELD_CHARS = 2000;
const MAX_ROWS = 5000;

export interface ShadowDisagreementInput {
  task: string;
  input: unknown;
  adapterOutput: string;
  standardOutput: string;
  gateResults?: Array<{ gate: string; passed: boolean; detail?: string }>;
  propertyId?: string;
  requestId?: string;
}

function truncate(value: string): string {
  return value.length > MAX_FIELD_CHARS ? `${value.slice(0, MAX_FIELD_CHARS)}…` : value;
}

/**
 * Append one disagreement row. Returns the row id, or null when nothing was
 * written (identical outputs after trimming, or an unavailable filesystem).
 */
export async function recordShadowDisagreement(
  input: ShadowDisagreementInput,
): Promise<string | null> {
  const adapter = (input.adapterOutput ?? "").trim();
  const standard = (input.standardOutput ?? "").trim();
  if (!adapter || !standard || adapter === standard) {
    return null;
  }
  try {
    const { readFile, writeFile, access } = await import("node:fs/promises");
    const file = seoStudioDataFile(SHADOW_DISAGREEMENTS_FILE);
    let existing: string[] = [];
    try {
      await access(file);
      const raw = await readFile(file, "utf8");
      existing = raw.split("\n").filter((line) => line.trim().length > 0);
    } catch {
      existing = [];
    }
    if (existing.length >= MAX_ROWS) {
      // Bounded growth: the queue page syncs rows out; never grow unbounded.
      return null;
    }

    const seed = `${input.task}|${adapter.slice(0, 400)}`;
    const id = `sd_${createHash("sha256").update(`${seed}|${adapter.slice(0, 200)}`).digest("hex").slice(0, 24)}`;
    if (existing.some((line) => line.includes(`"${id}"`))) {
      return id; // already captured for this adapter output
    }

    const row = {
      id,
      refId: id,
      source: "shadow_disagreement" as const,
      task: input.task,
      input:
        typeof input.input === "string"
          ? truncate(input.input)
          : truncate(JSON.stringify(input.input ?? null)),
      candidateOutput: truncate(adapter),
      gateResults: input.gateResults ?? [],
      sourceLicence: "Own data + consent (pending consent flag)",
      enqueuedAt: new Date().toISOString(),
      reviewed: false as const,
      metadata: {
        // v3 WP8 will thread the real per-property trainingConsent flag; until
        // then client-derived rows never train (the DPO builder refuses them).
        consent: false,
        tenantId: input.propertyId ? `shadow:${input.propertyId}` : "shadow",
        standardOutput: truncate(standard),
        requestId: input.requestId ?? null,
      },
    };

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${[...existing, JSON.stringify(row)].join("\n")}\n`, "utf8");
    return id;
  } catch {
    // No filesystem (edge runtime, read-only FS): skip silently.
    return null;
  }
}
