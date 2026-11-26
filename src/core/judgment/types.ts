/**
 * L2 judgment — effect estimates from logged outcomes.
 *
 * This layer is deliberately *not* a second prioritizer (the audited
 * `actionPlan` already ranks P0–P3 by severity). Instead it answers a narrower,
 * evidence-bound question the audit cannot: **when we changed a page this way
 * before, did it move Search Console clicks relative to unchanged control
 * pages?**
 *
 * Every number here is an aggregate of real measured deltas
 * (`OutcomeRecord.provenance === "measured"`); nothing is invented or
 * extrapolated to an individual page. Correlational only — changes were not
 * randomly assigned — so confidence is capped by sample size and every effect
 * carries caveats.
 */

export type JudgmentConfidence = "low" | "medium" | "high";

/** One qualifying change's difference-in-differences against its controls. */
export interface ChangeEffect {
  changeId: string;
  kind: string;
  pageUrl: string;
  /** Clicks gained over the counterfactual (control-trend adjusted). */
  netClicks: number;
  netImpressions: number;
  /** Mean position improvement (positive = moved up; Search Console position is lower-is-better). */
  positionGain: number;
}

export interface KindEffect {
  kind: string;
  /** Qualifying changes that contributed to the aggregate. */
  sampleSize: number;
  /** Measured-and-complete outcomes seen for this kind. */
  considered: number;
  /** Considered but excluded (missing a side or a control). */
  excluded: number;
  confidence: JudgmentConfidence;
  medianNetClicks: number | null;
  meanNetClicks: number | null;
  /** Share of qualifying changes with a positive net click effect (0–1). */
  positiveClickShare: number | null;
  medianNetImpressions: number | null;
  medianPositionGain: number | null;
  provenance: "estimated";
  caveats: string[];
}

export interface JudgmentReport {
  generatedAt: string;
  /** All changes supplied. */
  totalChanges: number;
  /** Changes that had a measured outcome. */
  measuredChanges: number;
  /** Changes that qualified for the effect aggregate. */
  qualifyingChanges: number;
  kinds: KindEffect[];
  provenance: "estimated";
  notes: string[];
}
