/**
 * Pack auto-suggestion heuristics (docs/TASKS.md Task 2.4).
 *
 * Given the three signals the extension already has for every page — JSON-LD
 * `@type` values, the URL path, and page text — propose the pack whose
 * catalog `signals` match best. Purely deterministic: no network, no model.
 *
 * Scoring model (documented, not measured):
 *
 *   score = 25 × matched schema signals
 *         + 15 × matched URL signals
 *         + 10 × matched keyword signals
 *   confidence = min(100, score)
 *
 * Matching is case-insensitive substring matching:
 *   - a schema signal matches when any input `@type` contains it
 *     (so `product` also matches `FinancialProduct` — see finance test)
 *   - a URL signal matches when the pathname contains it
 *   - a keyword signal matches when the text contains it
 *
 * Ties resolve to catalog order (hotel first), so the suggestion is stable.
 * Zero matches returns `null`: no evidence is not a suggestion.
 */
import { PACK_CATALOG } from "./catalog";

export interface PackSuggestionInput {
  /** Page URL; only the pathname is inspected. */
  url: string;
  /** JSON-LD `@type` values found on the page (any case). */
  schemaTypes?: string[];
  /** Page copy to match keywords against: title + headings + body. */
  text?: string;
}

export interface PackSuggestion {
  /** Catalog pack id. */
  packId: string;
  /** Human-readable vertical name for the chip label. */
  name: string;
  /** Heuristic confidence 0-100 — NOT a measured score. */
  confidence: number;
  /** Up to a handful of `"<group>: <signal>"` explanations. */
  reasons: string[];
}

const SCHEMA_HIT = 25;
const URL_HIT = 15;
const KEYWORD_HIT = 10;
const MAX_REASONS = 4;

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return (url || "").toLowerCase().split(/[?#]/)[0] ?? "";
  }
}

/**
 * Suggests the best-matching pack, or null when no signal matched anything.
 */
export function suggestPack(input: PackSuggestionInput): PackSuggestion | null {
  const pathname = pathnameOf(input.url);
  const schemaTypes = (input.schemaTypes ?? []).map((t) => t.toLowerCase());
  const text = (input.text ?? "").toLowerCase();

  let best: PackSuggestion | null = null;
  let bestScore = 0;

  for (const meta of PACK_CATALOG) {
    let score = 0;
    const reasons: string[] = [];

    for (const signal of meta.signals.schemaTypes) {
      if (schemaTypes.some((t) => t.includes(signal))) {
        score += SCHEMA_HIT;
        if (reasons.length < MAX_REASONS) reasons.push(`schema: ${signal}`);
      }
    }
    for (const signal of meta.signals.urlPatterns) {
      if (pathname.includes(signal)) {
        score += URL_HIT;
        if (reasons.length < MAX_REASONS) reasons.push(`url: ${signal}`);
      }
    }
    for (const signal of meta.signals.keywords) {
      if (text.includes(signal)) {
        score += KEYWORD_HIT;
        if (reasons.length < MAX_REASONS) reasons.push(`keyword: ${signal}`);
      }
    }

    // Strictly greater keeps catalog order as the stable tie-break.
    if (score > bestScore) {
      bestScore = score;
      best = {
        packId: meta.id,
        name: meta.name,
        confidence: Math.min(100, score),
        reasons,
      };
    }
  }

  return bestScore > 0 ? best : null;
}
