/**
 * Outcome logging — shared types.
 *
 * A `ChangeEvent` records that a page was changed (a deployed patch, an accepted
 * Studio fix, ...). An `OutcomeRecord` records measured Search Console metrics
 * for that page (and a control set) over matched before/after windows, so any
 * later "impact" number is grounded in measurement rather than attribution.
 *
 * Nothing here estimates traffic: when Search Console is not connected, or a
 * window has no rows, the record is marked `unavailable` with a reason.
 */

export type OutcomeProvenance = "measured" | "estimated" | "unavailable";

/** A single page that was changed and should be tracked for outcomes. */
export interface ChangeEvent {
  id: string;
  /** Search Console property, e.g. `sc-domain:example.com` or `https://example.com/`. */
  siteUrl: string;
  /** Absolute URL of the changed page. */
  pageUrl: string;
  /** What changed, e.g. `deployment`, `content-studio`, `keyword-matrix`. */
  kind: string;
  summary: string;
  /** ISO timestamp the change went live. */
  appliedAt: string;
  tenantId?: string;
  /** Patch id / triple id / audit id, for traceability. */
  fixRef?: string;
  /** Provenance of the audit the change was based on. */
  provenance: OutcomeProvenance;
}

export interface PageMetric {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface MetricTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface MetricDelta {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface OutcomeWindow {
  startDate: string;
  endDate: string;
}

export interface OutcomeRecord {
  id: string;
  changeId: string;
  siteUrl: string;
  pageUrl: string;
  measuredAt: string;
  provenance: OutcomeProvenance;
  /** Set when the record is incomplete or unavailable. */
  reason?: string;
  windowDays: number;
  /** False while the after-window is still filling (Search Console data lag). */
  afterComplete: boolean;
  beforeWindow: OutcomeWindow;
  afterWindow: OutcomeWindow;
  changed: {
    before: PageMetric | null;
    after: PageMetric | null;
    delta: MetricDelta | null;
  };
  control: {
    /** Control pages (unchanged) used as the comparison baseline. */
    pages: string[];
    before: MetricTotals | null;
    after: MetricTotals | null;
    delta: MetricDelta | null;
  } | null;
}
