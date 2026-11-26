/**
 * L2 judgment math — pure functions, no I/O.
 *
 * The effect of a change is the observed outcome minus the outcome we would have
 * expected had the page simply followed its control group (difference in
 * differences). This separates a real page-level move from site-wide drift.
 */

import type { ChangeEvent, OutcomeRecord } from "../outcomes/types.ts";
import type { ChangeEffect, JudgmentConfidence, KindEffect } from "./types.ts";

export const MIN_SAMPLE_MEDIUM = 4;
export const MIN_SAMPLE_HIGH = 10;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Counterfactual for a totals series: if the changed page had tracked its
 * controls, what would its after-value have been? Falls back to an additive
 * counterfactual when the control's before-value is zero.
 */
export function counterfactual(before: number, controlBefore: number, controlAfter: number): number {
  if (controlBefore > 0) return (before * controlAfter) / controlBefore;
  return before + (controlAfter - controlBefore);
}

export function confidenceFor(sampleSize: number): JudgmentConfidence {
  if (sampleSize >= MIN_SAMPLE_HIGH) return "high";
  if (sampleSize >= MIN_SAMPLE_MEDIUM) return "medium";
  return "low";
}

/**
 * Compute one change's control-adjusted effect, or `null` when the outcome is
 * not measured, the after-window is still filling, or a side/control is missing.
 */
export function perChangeEffect(change: ChangeEvent, outcome: OutcomeRecord | undefined): ChangeEffect | null {
  if (!outcome || outcome.provenance !== "measured" || !outcome.afterComplete) return null;
  const before = outcome.changed.before;
  const after = outcome.changed.after;
  const controlBefore = outcome.control?.before;
  const controlAfter = outcome.control?.after;
  if (!before || !after || !controlBefore || !controlAfter) return null;

  const netClicks = round(after.clicks - counterfactual(before.clicks, controlBefore.clicks, controlAfter.clicks));
  const netImpressions = round(
    after.impressions - counterfactual(before.impressions, controlBefore.impressions, controlAfter.impressions),
  );
  return {
    changeId: change.id,
    kind: change.kind,
    pageUrl: change.pageUrl,
    netClicks,
    netImpressions,
    positionGain: round(before.position - after.position, 1),
  };
}

const CAVEATS = [
  "Correlational: changes were not randomly assigned, so this is not a causal estimate.",
  "Controls are naive (highest-impression unchanged pages), not matched by template or traffic band.",
];

/** Aggregate per-change effects by `kind`, with confidence from sample size. */
export function aggregateByKind(effects: ChangeEffect[], considered: Map<string, number>): KindEffect[] {
  const byKind = new Map<string, ChangeEffect[]>();
  for (const effect of effects) {
    const list = byKind.get(effect.kind) ?? [];
    list.push(effect);
    byKind.set(effect.kind, list);
  }

  const kinds = new Set<string>([...byKind.keys(), ...considered.keys()]);
  return [...kinds]
    .sort((a, b) => a.localeCompare(b))
    .map<KindEffect>((kind) => {
      const list = byKind.get(kind) ?? [];
      const seen = considered.get(kind) ?? list.length;
      const clicks = list.map((effect) => effect.netClicks);
      const positive = list.filter((effect) => effect.netClicks > 0).length;
      return {
        kind,
        sampleSize: list.length,
        considered: seen,
        excluded: Math.max(0, seen - list.length),
        confidence: confidenceFor(list.length),
        medianNetClicks: median(clicks),
        meanNetClicks: clicks.length ? round(clicks.reduce((sum, value) => sum + value, 0) / clicks.length) : null,
        positiveClickShare: list.length ? round(positive / list.length, 3) : null,
        medianNetImpressions: median(list.map((effect) => effect.netImpressions)),
        medianPositionGain: median(list.map((effect) => effect.positionGain)),
        provenance: "estimated",
        caveats: [...CAVEATS, list.length < MIN_SAMPLE_MEDIUM ? "Small sample — treat as a signal, not a result." : ""]
          .filter(Boolean),
      };
    });
}
