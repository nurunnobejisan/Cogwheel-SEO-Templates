/**
 * L2 judgment — public surface.
 *
 * `judgeOutcomes` turns the logged, measured outcomes of past changes into
 * control-adjusted effect estimates per change kind. It is the honest baseline a
 * trained judgment model must later beat: transparent, deterministic, and always
 * labelled `estimated`. See `docs/JUDGMENT.md`.
 */

import type { ChangeEvent, OutcomeRecord } from "../outcomes/types.ts";
import { aggregateByKind, perChangeEffect } from "./estimate.ts";
import type { ChangeEffect, JudgmentReport } from "./types.ts";

export * from "./types.ts";
export { aggregateByKind, confidenceFor, counterfactual, perChangeEffect, MIN_SAMPLE_HIGH, MIN_SAMPLE_MEDIUM } from "./estimate.ts";

/**
 * Build a judgment report from the change log and its outcomes.
 *
 * Only changes whose outcome is `measured` and whose after-window is complete
 * contribute. Changes that were measured but are still filling (or lack a
 * control set) are counted as `excluded` so the gap in evidence is visible
 * rather than hidden.
 */
export function judgeOutcomes(changes: ChangeEvent[], outcomes: OutcomeRecord[], now = new Date()): JudgmentReport {
  const byChange = new Map<string, OutcomeRecord>();
  for (const outcome of outcomes) byChange.set(outcome.changeId, outcome);

  const considered = new Map<string, number>();
  const effects: ChangeEffect[] = [];

  for (const change of changes) {
    const outcome = byChange.get(change.id);
    if (!outcome || outcome.provenance !== "measured") continue;
    considered.set(change.kind, (considered.get(change.kind) ?? 0) + 1);
    const effect = perChangeEffect(change, outcome);
    if (effect) effects.push(effect);
  }

  return {
    generatedAt: now.toISOString(),
    totalChanges: changes.length,
    measuredChanges: outcomes.filter((entry) => entry.provenance === "measured").length,
    qualifyingChanges: effects.length,
    kinds: aggregateByKind(effects, considered),
    provenance: "estimated",
    notes: [
      "Effects are difference-in-differences against naive control pages, aggregated by change kind.",
      "No effect is attributed to a specific page; sample sizes and exclusions are reported.",
    ],
  };
}
