/**
 * Pure GSC row derivations.
 *
 * Every number returned here comes from rows supplied by the Search Analytics
 * API or an operator-uploaded export. No fallback totals, country splits or
 * position deltas are synthesised — missing dimensions stay empty.
 */

import { getGscSearchAnalytics } from "./client.ts";
import type {
  GscCannibalizationIssue,
  GscPerformanceOverview,
  GscPeriodComparison,
  GscSearchRow,
} from "./types.ts";

export { GSC_RANGE_PRESETS } from "./presets.ts";
export type { GscRangeId } from "./presets.ts";

export interface GscDateWindow {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** Default window: `days` days ending three days ago (GSC finalisation lag). */
export function buildGscDateWindow(days: number, now = new Date()): GscDateWindow {
  const end = shiftDays(now, -3);
  const start = shiftDays(end, -(days - 1));
  const previousEnd = shiftDays(start, -1);
  const previousStart = shiftDays(previousEnd, -(days - 1));
  return {
    startDate: isoDate(start),
    endDate: isoDate(end),
    previousStartDate: isoDate(previousStart),
    previousEndDate: isoDate(previousEnd),
  };
}

/**
 * GSC allows 25,000 rows per request. Fetch every page rather than silently
 * truncating; 10 pages is a defensive ceiling for a single panel request.
 */
export async function fetchAllGscRows(input: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: Array<"query" | "page" | "device" | "country" | "date">;
  dataState?: "final" | "all";
  rowLimit?: number;
  maxPages?: number;
}): Promise<GscSearchRow[]> {
  const rowLimit = Math.min(input.rowLimit ?? 25_000, 25_000);
  const maxPages = input.maxPages ?? 10;
  const rows: GscSearchRow[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await getGscSearchAnalytics({
      siteUrl: input.siteUrl,
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: input.dimensions,
      rowLimit,
      startRow: page * rowLimit,
      dataState: input.dataState ?? "final",
    });
    rows.push(...batch);
    if (batch.length < rowLimit) break;
  }
  return rows;
}

function sum(rows: GscSearchRow[], key: "clicks" | "impressions"): number {
  return rows.reduce((total, row) => total + (row[key] || 0), 0);
}

function weightedPosition(rows: GscSearchRow[]): number {
  const impressions = sum(rows, "impressions");
  if (impressions <= 0) return 0;
  return rows.reduce((total, row) => total + row.position * row.impressions, 0) / impressions;
}

function ctr(clicks: number, impressions: number): number {
  return impressions > 0 ? clicks / impressions : 0;
}

function breakdown(rows: GscSearchRow[], index: number): Record<string, { clicks: number; impressions: number }> {
  const result: Record<string, { clicks: number; impressions: number }> = {};
  for (const row of rows) {
    const key = row.keys[index];
    if (!key) continue;
    const entry = (result[key] ??= { clicks: 0, impressions: 0 });
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
  }
  return result;
}

export interface BuildOverviewInput {
  siteUrl: string;
  days: number;
  queryRows: GscSearchRow[];
  pageRows: GscSearchRow[];
  deviceRows?: GscSearchRow[];
  countryRows?: GscSearchRow[];
}

export function buildOverviewFromRows(input: BuildOverviewInput): GscPerformanceOverview {
  const totalClicks = sum(input.pageRows, "clicks");
  const totalImpressions = sum(input.pageRows, "impressions");
  return {
    siteUrl: input.siteUrl,
    periodDays: input.days,
    totalClicks,
    totalImpressions,
    averageCtr: ctr(totalClicks, totalImpressions),
    averagePosition: weightedPosition(input.pageRows),
    topQueries: input.queryRows
      .slice()
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 25)
      .map((row) => ({
        query: row.keys[0] ?? "",
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
    topPages: input.pageRows
      .slice()
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 25)
      .map((row) => ({
        page: row.keys[0] ?? "",
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
    deviceBreakdown: breakdown(input.deviceRows ?? [], 0),
    countryBreakdown: breakdown(input.countryRows ?? [], 0),
  };
}

function queryTotals(rows: GscSearchRow[]): Map<string, GscSearchRow> {
  const totals = new Map<string, GscSearchRow>();
  for (const row of rows) {
    const query = row.keys[0];
    if (!query) continue;
    const existing = totals.get(query);
    if (!existing) {
      totals.set(query, { ...row });
      continue;
    }
    const impressions = existing.impressions + row.impressions;
    existing.clicks += row.clicks;
    existing.impressions = impressions;
    existing.ctr = ctr(existing.clicks, impressions);
    existing.position = impressions > 0
      ? (existing.position * (impressions - row.impressions) + row.position * row.impressions) / impressions
      : row.position;
  }
  return totals;
}

export function compareRowsBetweenWindows(input: {
  siteUrl: string;
  days: number;
  window: GscDateWindow;
  currentRows: GscSearchRow[];
  previousRows: GscSearchRow[];
}): GscPeriodComparison {
  const currentRows = input.currentRows;
  const previousRows = input.previousRows;
  const currentClicks = sum(currentRows, "clicks");
  const previousClicks = sum(previousRows, "clicks");
  const currentImpressions = sum(currentRows, "impressions");
  const previousImpressions = sum(previousRows, "impressions");
  const currentPosition = weightedPosition(currentRows);
  const previousPosition = weightedPosition(previousRows);
  const percent = (value: number, base: number) => (base > 0 ? Math.round((value / base) * 1000) / 10 : 0);

  const currentByQuery = queryTotals(currentRows);
  const previousByQuery = queryTotals(previousRows);
  const deltas = [...currentByQuery.keys()].map((query) => ({
    query,
    clicksDelta: currentByQuery.get(query)!.clicks - (previousByQuery.get(query)?.clicks ?? 0),
    currentPosition: currentByQuery.get(query)!.position,
  }));

  return {
    siteUrl: input.siteUrl,
    currentPeriod: {
      startDate: input.window.startDate,
      endDate: input.window.endDate,
      clicks: currentClicks,
      impressions: currentImpressions,
      ctr: ctr(currentClicks, currentImpressions),
      position: currentPosition,
    },
    previousPeriod: {
      startDate: input.window.previousStartDate,
      endDate: input.window.previousEndDate,
      clicks: previousClicks,
      impressions: previousImpressions,
      ctr: ctr(previousClicks, previousImpressions),
      position: previousPosition,
    },
    deltas: {
      clicks: currentClicks - previousClicks,
      clicksPercent: percent(currentClicks - previousClicks, previousClicks),
      impressions: currentImpressions - previousImpressions,
      impressionsPercent: percent(currentImpressions - previousImpressions, previousImpressions),
      ctrDelta: ctr(currentClicks, currentImpressions) - ctr(previousClicks, previousImpressions),
      positionDelta: currentPosition - previousPosition,
    },
    gainingQueries: deltas.filter((row) => row.clicksDelta > 0).sort((a, b) => b.clicksDelta - a.clicksDelta).slice(0, 10),
    decliningQueries: deltas.filter((row) => row.clicksDelta < 0).sort((a, b) => a.clicksDelta - b.clicksDelta).slice(0, 10),
  };
}

/** Normalise tracking parameters and presentation differences before grouping. */
export function normalizePageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.protocol = url.protocol.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || lower === "gclid" || lower === "fbclid") url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").toLowerCase();
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url.toString();
  } catch {
    return rawUrl.trim().toLowerCase().replace(/#.*$/, "").replace(/\/{2,}(?=\?|$)/g, "/");
  }
}

export function isBrandQuery(query: string, brandTerms: string[]): boolean {
  const normalized = query.toLowerCase();
  return brandTerms.some((term) => term.trim().length > 0 && normalized.includes(term.trim().toLowerCase()));
}

interface CannibalizationPage {
  pageUrl: string;
  normalizedUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Cannibalization rules (all thresholds are explicit):
 * - group by query and normalised page URL;
 * - ignore operator-editable brand terms;
 * - require at least two URLs with >=10 impressions and average position <=30;
 * - require the second URL to have >=20% of the top URL's impressions;
 * - severity = total impressions × (1 − top URL click share) × position spread factor.
 */
export function detectCannibalizationFromRows(
  rows: GscSearchRow[],
  brandTerms: string[] = []
): GscCannibalizationIssue[] {
  const grouped = new Map<string, Map<string, CannibalizationPage>>();
  for (const row of rows) {
    const query = row.keys[0];
    const page = row.keys[1];
    if (!query || !page || isBrandQuery(query, brandTerms)) continue;
    const normalizedUrl = normalizePageUrl(page);
    const byPage = grouped.get(query) ?? new Map<string, CannibalizationPage>();
    const existing = byPage.get(normalizedUrl);
    if (existing) {
      const impressions = existing.impressions + row.impressions;
      existing.clicks += row.clicks;
      existing.impressions = impressions;
      existing.ctr = ctr(existing.clicks, impressions);
      existing.position = impressions > 0
        ? (existing.position * (impressions - row.impressions) + row.position * row.impressions) / impressions
        : row.position;
    } else {
      byPage.set(normalizedUrl, {
        pageUrl: page,
        normalizedUrl,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      });
    }
    grouped.set(query, byPage);
  }

  const issues: GscCannibalizationIssue[] = [];
  for (const [query, pageMap] of grouped.entries()) {
    const pages = [...pageMap.values()]
      .filter((page) => page.impressions >= 10 && page.position > 0 && page.position <= 30)
      .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
    if (pages.length < 2) continue;

    const top = pages[0];
    const second = pages[1];
    if (second.impressions < top.impressions * 0.2) continue;

    const totalImpressions = pages.reduce((sumImpressions, page) => sumImpressions + page.impressions, 0);
    const totalClicks = pages.reduce((sumClicks, page) => sumClicks + page.clicks, 0);
    const topUrlClickShare = totalClicks > 0 ? top.clicks / totalClicks : 0;
    const positions = pages.map((page) => page.position);
    const spread = Math.max(...positions) - Math.min(...positions);
    const positionSpreadFactor = 1 + Math.min(2, Math.max(0, spread) / 10);
    const severityScore = Math.round(totalImpressions * (1 - topUrlClickShare) * positionSpreadFactor);
    const severity: GscCannibalizationIssue["severity"] =
      severityScore >= 500 ? "high" : severityScore >= 100 ? "medium" : "low";
    const action = topUrlClickShare < 0.5
      ? "Consolidate"
      : spread > 10
        ? "Differentiate"
        : "Canonicalize";
    const recommendation =
      `${action}: use ${top.pageUrl} as the preferred URL for "${query}". ` +
      `Add exact-match internal links to ${top.pageUrl} from every competing page.`;

    issues.push({
      query,
      competingPages: pages.map(({ pageUrl, clicks, impressions, ctr: pageCtr, position }) => ({
        pageUrl,
        clicks,
        impressions,
        ctr: pageCtr,
        position,
      })),
      severity,
      severityScore,
      preferredUrl: top.pageUrl,
      normalizedUrls: pages.map((page) => page.normalizedUrl),
      topUrlClickShare,
      positionSpreadFactor,
      recommendation,
    });
  }

  return issues.sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0)).slice(0, 50);
}
