/**
 * Outcome-logging math — pure functions, no I/O.
 *
 * Windows: for a change applied on day D with a Search Console data lag of
 * `leadDays`, the *before* window is the `windowDays` days ending the day before
 * D, and the *after* window starts `leadDays` days after D. The after window is
 * clamped to today and flagged incomplete while it is still filling.
 */

import type { GscSearchRow } from "../gsc/types.ts";
import type { MetricDelta, MetricTotals, OutcomeWindow, PageMetric } from "./types.ts";

const DAY_MS = 86_400_000;

export const DEFAULT_WINDOW_DAYS = 28;
export const DEFAULT_LEAD_DAYS = 3;

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface PlanWindowsOptions {
  windowDays?: number;
  leadDays?: number;
  now?: Date;
}

export interface WindowPlan {
  windowDays: number;
  before: OutcomeWindow;
  after: OutcomeWindow;
  /** False when the after window extends past today. */
  afterComplete: boolean;
}

export function planWindows(appliedAt: string, options: PlanWindowsOptions = {}): WindowPlan {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const leadDays = options.leadDays ?? DEFAULT_LEAD_DAYS;
  const now = options.now ?? new Date();
  const applied = new Date(appliedAt);
  if (Number.isNaN(applied.getTime())) throw new Error(`invalid appliedAt: ${appliedAt}`);

  const beforeEnd = new Date(applied.getTime() - DAY_MS);
  const beforeStart = new Date(beforeEnd.getTime() - (windowDays - 1) * DAY_MS);
  const rawAfterStart = new Date(applied.getTime() + leadDays * DAY_MS);
  const rawAfterEnd = new Date(rawAfterStart.getTime() + (windowDays - 1) * DAY_MS);
  const afterComplete = rawAfterEnd.getTime() <= now.getTime();
  const afterEnd = afterComplete ? rawAfterEnd : now;

  return {
    windowDays,
    before: { startDate: isoDay(beforeStart), endDate: isoDay(beforeEnd) },
    after: { startDate: isoDay(rawAfterStart), endDate: isoDay(afterEnd) },
    afterComplete,
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Search Console returns full URLs; compare on host + path (ignore scheme/www/query). */
export function normalizePage(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.host.replace(/^www\./, "").toLowerCase()}${path.toLowerCase()}`;
  } catch {
    return raw.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function samePage(a: string, b: string): boolean {
  return normalizePage(a) === normalizePage(b);
}

export function findPageMetric(rows: GscSearchRow[], pageUrl: string): PageMetric | null {
  const row = rows.find((r) => samePage(r.keys[0] ?? "", pageUrl));
  if (!row) return null;
  return {
    page: row.keys[0] ?? pageUrl,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: round(row.ctr, 4),
    position: round(row.position, 1),
  };
}

/** Aggregate rows to totals; position is impression-weighted (matches GSC semantics). */
export function totalsFromRows(rows: GscSearchRow[]): MetricTotals {
  const clicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  let position = 0;
  if (impressions > 0) {
    position = rows.reduce((sum, r) => sum + r.position * r.impressions, 0) / impressions;
  } else if (rows.length > 0) {
    position = rows.reduce((sum, r) => sum + r.position, 0) / rows.length;
  }
  return { clicks, impressions, ctr: round(ctr, 4), position: round(position, 1) };
}

export function delta(before: MetricTotals, after: MetricTotals): MetricDelta {
  return {
    clicks: after.clicks - before.clicks,
    impressions: after.impressions - before.impressions,
    ctr: round(after.ctr - before.ctr, 4),
    position: round(after.position - before.position, 1),
  };
}

/**
 * Choose control pages (unchanged) as a naive comparison baseline: the
 * highest-impression pages in the before window, excluding the changed page.
 * Deterministic (path is the tie-break). A future version should match controls
 * by page template and traffic band.
 */
export function selectControlPages(
  beforeRows: GscSearchRow[],
  changedUrl: string,
  limit: number,
  exclude: string[] = [],
): string[] {
  return beforeRows
    .map((r) => r.keys[0] ?? "")
    .filter((page) => page && !samePage(page, changedUrl) && !exclude.some((e) => samePage(e, page)))
    .sort((a, b) => {
      const ia = beforeRows.find((r) => r.keys[0] === a)?.impressions ?? 0;
      const ib = beforeRows.find((r) => r.keys[0] === b)?.impressions ?? 0;
      return ib - ia || normalizePage(a).localeCompare(normalizePage(b));
    })
    .slice(0, Math.max(0, limit));
}
