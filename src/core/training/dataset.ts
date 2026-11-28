/**
 * Training-data utilities shared by the capture API, review queue and export.
 *
 * Only `reviewed` and `gold` triples are training-eligible. Raw captures are
 * never exported. PII is stripped before storage and again before export.
 */

import crypto from "node:crypto";
import type { DataProvenance } from "../data-policy.ts";

export type TripleTier = "raw" | "reviewed" | "gold";

export const TRAINING_ELIGIBLE_TIERS: TripleTier[] = ["reviewed", "gold"];
export const MIN_REVIEWED_PAIRS_FOR_TRAINING = 2000;

export interface TrainingTriple {
  id: string;
  url: string;
  audit: unknown;
  expertFix: unknown;
  quality: TripleTier;
  capturedAt: string;
  contentHash: string;
  consent: true;
  /** Tenant/organisation that owns this data. Enforces per-tenant isolation. */
  tenantId?: string;
  /** Provenance of the measured/estimated values in the audit and fix. */
  provenance: DataProvenance;
  reviewedBy?: string;
  reviewedAt?: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{2,4}\)|\d{2,4})[-.\s]\d{3,4}[-.\s]\d{3,4}\b/g;
const BEARER = /\b(?:sk|pk|ghp|gho|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/g;

export function stripPii(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(EMAIL, "[REDACTED_EMAIL]")
      .replace(PHONE, "[REDACTED_PHONE]")
      .replace(BEARER, "[REDACTED_SECRET]");
  }
  if (Array.isArray(value)) return value.map(stripPii);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = stripPii(entry);
    }
    return out;
  }
  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Stable hash of the audit + expert fix, used to reject duplicate content. */
export function contentHash(audit: unknown, expertFix: unknown): string {
  return crypto.createHash("sha256").update(canonical({ audit, expertFix })).digest("hex");
}

/**
 * A triple is a duplicate only when its audit + expert fix content is
 * byte-identical (same `contentHash`). The same URL may be captured again with
 * a different reviewed fix, so URL alone is deliberately not a duplicate key.
 */
export function hasDuplicateContent(
  existing: ReadonlyArray<Pick<TrainingTriple, "contentHash">>,
  hash: string,
): boolean {
  return existing.some((triple) => triple.contentHash === hash);
}

export function isTrainingEligible(quality: TripleTier): boolean {
  return TRAINING_ELIGIBLE_TIERS.includes(quality);
}

export interface LoraExample {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  metadata: { tripleId: string; url: string; quality: TripleTier; tenantId: string | null; provenance: DataProvenance };
}

const SYSTEM_PROMPT =
  "You are SEO Studio's SEO fix assistant. Given a measured audit, produce only the expert fix. " +
  "Never invent rankings, search volumes, citations, competitors, fees, revenue, or benchmark scores. " +
  "If a dimension is unavailable, leave it out or mark it unavailable.";

export function buildLoraExample(triple: TrainingTriple): LoraExample {
  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(triple.audit) },
      { role: "assistant", content: JSON.stringify(triple.expertFix) },
    ],
    metadata: { tripleId: triple.id, url: triple.url, quality: triple.quality, tenantId: triple.tenantId ?? null, provenance: triple.provenance },
  };
}
