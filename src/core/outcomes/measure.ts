/**
 * Outcome measurement.
 *
 * Given a `ChangeEvent`, fetch the changed page's Search Console rows for the
 * matched before/after windows and a control set, and return an `OutcomeRecord`.
 * All I/O is injected so the logic is unit-testable without network or Google
 * credentials; the API route wires the real Search Console client.
 *
 * Honesty rules: no rows → `unavailable` with a reason, and a still-filling
 * after window is flagged rather than reported as impact.
 */

import crypto from "node:crypto";
import type { GscSearchRow } from "../gsc/types.ts";
import type { ChangeEvent, OutcomeRecord } from "./types.ts";
import { delta, findPageMetric, normalizePage, planWindows, selectControlPages, totalsFromRows } from "./windows.ts";

export interface MeasureDeps {
  isConfigured: () => boolean;
  fetchPages: (query: { siteUrl: string; startDate: string; endDate: string; rowLimit: number }) => Promise<GscSearchRow[]>;
  now?: () => Date;
  windowDays?: number;
  leadDays?: number;
  controlLimit?: number;
}

/** Deterministic id: re-measuring the same change/window replaces the record. */
export function outcomeId(changeId: string, afterEnd: string): string {
  const hash = crypto.createHash("sha256").update(`${changeId}|${afterEnd}`).digest("hex").slice(0, 16);
  return `out_${hash}`;
}

export async function measureChange(change: ChangeEvent, deps: MeasureDeps): Promise<OutcomeRecord> {
  const now = deps.now ? deps.now() : new Date();
  const plan = planWindows(change.appliedAt, { now, windowDays: deps.windowDays, leadDays: deps.leadDays });

  const base: OutcomeRecord = {
    id: outcomeId(change.id, plan.after.endDate),
    changeId: change.id,
    siteUrl: change.siteUrl,
    pageUrl: change.pageUrl,
    measuredAt: now.toISOString(),
    provenance: "unavailable",
    windowDays: plan.windowDays,
    afterComplete: plan.afterComplete,
    beforeWindow: plan.before,
    afterWindow: plan.after,
    changed: { before: null, after: null, delta: null },
    control: null,
  };

  if (!deps.isConfigured()) {
    return { ...base, reason: "Search Console is not connected (set GOOGLE_SERVICE_ACCOUNT_*)" };
  }

  const controlLimit = deps.controlLimit ?? 10;
  const rowLimit = Math.max(1000, controlLimit * 50);
  const [beforeRows, afterRows] = await Promise.all([
    deps.fetchPages({ siteUrl: change.siteUrl, startDate: plan.before.startDate, endDate: plan.before.endDate, rowLimit }),
    deps.fetchPages({ siteUrl: change.siteUrl, startDate: plan.after.startDate, endDate: plan.after.endDate, rowLimit }),
  ]);

  if (beforeRows.length === 0 && afterRows.length === 0) {
    return { ...base, reason: "No Search Console rows for the measured windows" };
  }

  const before = findPageMetric(beforeRows, change.pageUrl);
  const after = findPageMetric(afterRows, change.pageUrl);
  const controls = selectControlPages(beforeRows, change.pageUrl, controlLimit);
  const controlSet = new Set(controls.map((p) => normalizePage(p)));
  const controlBefore = controls.length
    ? totalsFromRows(beforeRows.filter((r) => controlSet.has(normalizePage(r.keys[0] ?? ""))))
    : null;
  const controlAfter = controls.length
    ? totalsFromRows(afterRows.filter((r) => controlSet.has(normalizePage(r.keys[0] ?? ""))))
    : null;

  return {
    ...base,
    provenance: "measured",
    reason: plan.afterComplete ? undefined : "After window still filling (Search Console data lag)",
    changed: {
      before,
      after,
      delta: before && after ? delta(before, after) : null,
    },
    control:
      controls.length > 0
        ? {
            pages: controls,
            before: controlBefore,
            after: controlAfter,
            delta: controlBefore && controlAfter ? delta(controlBefore, controlAfter) : null,
          }
        : null,
  };
}
