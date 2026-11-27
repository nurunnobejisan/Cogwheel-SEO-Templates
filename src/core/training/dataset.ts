/**
 * Training-data utilities shared by the capture API, review queue and export.
 *
 * Only `reviewed` and `gold` triples are training-eligible. Raw captures are
 * never exported. PII is stripped before storage and again before export.
 */

import crypto from "node:crypto";
import type { DataProvenance } from "../data-policy.ts";
import { classifyPageType, derivePack, type PageTypeLabel, type RawWebInput } from "../../../shared/ts/training-vault.ts";
import { MlPageTypeLabels } from "../../../schemas/ml-example.ts";

export type TripleTier = "raw" | "reviewed" | "gold";

/** URL-only raw input for server-side page-type classification (no page body). */
function emptyRawInput(url: string): RawWebInput {
  return {
    url,
    canonicalUrl: url,
    domain: "",
    rawTitle: "",
    rawMetaDesc: "",
    rawH1: [],
    rawH2: [],
    rawBodyText: "",
    detectedSchemas: [],
    wordCount: 0,
  };
}

const PACK_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Resolve `pack` / `pageType` provenance for a triple capture (Task 5.1).
 *
 * Client-supplied values win when well-formed (page type must be a known
 * `PageTypeLabel`, pack must be a kebab-case slug); otherwise the server
 * derives them — URL-only page-type classification, since the request
 * carries no page body, then pack from the resulting hotel-only label.
 */
export function deriveTripleProvenance(
  url: string,
  body: { pack?: unknown; pageType?: unknown },
): { pack: string; pageType: string } {
  const pageType =
    typeof body.pageType === "string" &&
    (MlPageTypeLabels as readonly string[]).includes(body.pageType)
      ? body.pageType
      : classifyPageType(url, emptyRawInput(url));
  const pack =
    typeof body.pack === "string" && PACK_SLUG.test(body.pack)
      ? body.pack
      : derivePack([], pageType as PageTypeLabel);
  return { pack, pageType };
}

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
  /** Vertical pack provenance (Task 5.1) — derived server-side when absent. */
  pack: string;
  /** Page-type provenance in the `PageTypeLabel` vocabulary. */
  pageType: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// The word-boundary guard sits on the digit branch (`\b\d{2,4}`) rather than
// at the start of the pattern: a leading `\b` cannot match before `(`, which
// let `(503) 555 0123` through unredacted. The paren branch needs no guard —
// `(` itself anchors it. Keep in step with PHONE_RE in ml/clean/pii.py.
const PHONE = /(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{2,4}\)|\b\d{2,4})[-.\s]\d{3,4}[-.\s]\d{3,4}\b/g;
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
  metadata: {
    tripleId: string;
    url: string;
    quality: TripleTier;
    tenantId: string | null;
    provenance: DataProvenance;
    /** Vertical pack provenance (Task 5.1). */
    pack: string;
    /** Page-type provenance in the `PageTypeLabel` vocabulary. */
    pageType: string;
    /** Always `true`: TrainingTriple is captured with consent, and the
     *  licence gate downstream (ml/train) refuses first-party rows whose
     *  exported metadata lost it. Additive so older exports stay parseable. */
    consent: true;
  };
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
    metadata: {
      tripleId: triple.id,
      url: triple.url,
      quality: triple.quality,
      tenantId: triple.tenantId ?? null,
      provenance: triple.provenance,
      pack: triple.pack,
      pageType: triple.pageType,
      consent: triple.consent,
    },
  };
}
