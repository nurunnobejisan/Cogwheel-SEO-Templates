/**
 * GSC Performance & Cannibalization panel data layer.
 *
 * Live path uses the official Search Console API with server-side credentials.
 * Upload path parses operator-provided GSC CSV/ZIP exports. Both paths keep
 * provenance, and neither invents values for a missing dimension.
 */

import JSZip from "jszip";
import Papa from "papaparse";
import { isGoogleConfigured, listGscProperties, listGscSitemaps } from "./client.ts";
import {
  buildGscDateWindow,
  buildOverviewFromRows,
  compareRowsBetweenWindows,
  detectCannibalizationFromRows,
  fetchAllGscRows,
} from "./rows.ts";
import type {
  GscCannibalizationIssue,
  GscPerformanceOverview,
  GscPeriodComparison,
  GscSearchRow,
  GscSite,
  GscSitemapInfo,
} from "./types.ts";

export type GscPanelSource = "google-api" | "csv-upload";

export interface GscPanelPayload {
  siteUrl: string;
  periodDays: number;
  source: GscPanelSource;
  window: { startDate: string; endDate: string; previousStartDate: string; previousEndDate: string };
  dataState: "final" | "all";
  overview: GscPerformanceOverview;
  comparison: GscPeriodComparison | null;
  cannibalization: GscCannibalizationIssue[];
  properties: GscSite[];
  sitemaps: GscSitemapInfo[];
  notes: string[];
  limitations: string[];
}

function emptyOverview(siteUrl: string, days: number): GscPerformanceOverview {
  return {
    siteUrl,
    periodDays: days,
    totalClicks: 0,
    totalImpressions: 0,
    averageCtr: 0,
    averagePosition: 0,
    topQueries: [],
    topPages: [],
    deviceBreakdown: {},
    countryBreakdown: {},
  };
}

export function unavailableGscPanel(siteUrl: string, days: number): GscPanelPayload {
  return {
    siteUrl,
    periodDays: days,
    source: "google-api",
    window: buildGscDateWindow(days),
    dataState: "final",
    overview: emptyOverview(siteUrl, days),
    comparison: null,
    cannibalization: [],
    properties: [],
    sitemaps: [],
    notes: [
      "Google Search Console is not connected. Set GOOGLE_SERVICE_ACCOUNT_B64 (or GOOGLE_SERVICE_ACCOUNT_JSON) and grant the service account access to the property.",
    ],
    limitations: ["No clicks, impressions, CTR, position or cannibalization data is shown until a real source is connected."],
  };
}

export interface LiveGscPanelInput {
  siteUrl: string;
  days: number;
  brandTerms?: string[];
  includeSitemaps?: boolean;
  now?: Date;
}

export async function buildLiveGscPanel(input: LiveGscPanelInput): Promise<GscPanelPayload> {
  if (!isGoogleConfigured()) return unavailableGscPanel(input.siteUrl, input.days);
  const window = buildGscDateWindow(input.days, input.now);
  const common = { siteUrl: input.siteUrl, dataState: "final" as const };

  const [queryRows, previousRows, pageRows, deviceRows, countryRows, pairRows, properties, sitemaps] =
    await Promise.all([
      fetchAllGscRows({ ...common, ...window, dimensions: ["query"] }),
      fetchAllGscRows({
        siteUrl: input.siteUrl,
        startDate: window.previousStartDate,
        endDate: window.previousEndDate,
        dimensions: ["query"],
        dataState: "final",
      }),
      fetchAllGscRows({ ...common, ...window, dimensions: ["page"] }),
      fetchAllGscRows({ ...common, ...window, dimensions: ["device"] }),
      fetchAllGscRows({ ...common, ...window, dimensions: ["country"] }),
      fetchAllGscRows({ ...common, ...window, dimensions: ["query", "page"] }),
      listGscProperties(),
      input.includeSitemaps === false ? Promise.resolve([]) : listGscSitemaps(input.siteUrl),
    ]);

  return {
    siteUrl: input.siteUrl,
    periodDays: input.days,
    source: "google-api",
    window,
    dataState: "final",
    overview: buildOverviewFromRows({ siteUrl: input.siteUrl, days: input.days, queryRows, pageRows, deviceRows, countryRows }),
    comparison: compareRowsBetweenWindows({
      siteUrl: input.siteUrl,
      days: input.days,
      window,
      currentRows: queryRows,
      previousRows,
    }),
    cannibalization: detectCannibalizationFromRows(pairRows, input.brandTerms ?? []),
    properties,
    sitemaps,
    notes: [
      `Measured from the Google Search Console API (dataState=final), ${window.startDate} to ${window.endDate}; the window ends three days ago to allow data finalisation.`,
    ],
    limitations: [],
  };
}

function numeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[,%\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed / (value.includes("%") ? 100 : 1) : 0;
}

function headerIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((header) => header.trim().toLowerCase().replace(/[\s_-]+/g, ""));
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate.toLowerCase().replace(/[\s_-]+/g, ""));
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * Parse a GSC CSV export. Standard exports contain either `Top queries` or
 * `Top pages`; a query×page export contains both and enables full
 * cannibalization. Values are read from the file — never estimated.
 */
export function parseGscCsvText(text: string): GscSearchRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  const headers = (parsed.meta.fields ?? []).map(String);
  if (!headers.length) return [];

  const queryIndex = headerIndex(headers, ["Top queries", "Query", "Queries"]);
  const pageIndex = headerIndex(headers, ["Top pages", "Page", "Pages"]);
  const clicksIndex = headerIndex(headers, ["Clicks"]);
  const impressionsIndex = headerIndex(headers, ["Impressions"]);
  const ctrIndex = headerIndex(headers, ["CTR"]);
  const positionIndex = headerIndex(headers, ["Position"]);
  if (queryIndex < 0 && pageIndex < 0) return [];

  return parsed.data
    .map((record) => {
      const values = headers.map((header) => record[header]);
      const keys: string[] = [];
      if (queryIndex >= 0) keys.push(String(values[queryIndex] ?? ""));
      if (pageIndex >= 0) keys.push(String(values[pageIndex] ?? ""));
      return {
        keys,
        clicks: numeric(values[clicksIndex]),
        impressions: numeric(values[impressionsIndex]),
        ctr: numeric(values[ctrIndex]),
        position: numeric(values[positionIndex]),
      } satisfies GscSearchRow;
    })
    .filter((row) => row.keys.some((key) => key.trim().length > 0));
}

export async function parseGscUpload(fileName: string, data: ArrayBuffer): Promise<GscSearchRow[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(data);
    const files = Object.values(zip.files).filter(
      (entry) => !entry.dir && !entry.name.startsWith("__MACOSX/") && entry.name.toLowerCase().endsWith(".csv")
    );
    const rows: GscSearchRow[] = [];
    for (const file of files) rows.push(...parseGscCsvText(await file.async("string")));
    return rows;
  }
  if (!lower.endsWith(".csv")) throw new Error("Upload a GSC CSV export or a ZIP archive containing CSV exports.");
  return parseGscCsvText(new TextDecoder().decode(data));
}

export interface GscUploadPanelInput {
  siteUrl: string;
  days: number;
  fileName: string;
  rows: GscSearchRow[];
  brandTerms?: string[];
  now?: Date;
}

export function buildGscPanelFromUpload(input: GscUploadPanelInput): GscPanelPayload {
  const window = buildGscDateWindow(input.days, input.now);
  const queryRows = input.rows.filter((row) => row.keys.length >= 1 && (row.keys.length === 1 || !row.keys[1]));
  const pageRows = input.rows.filter((row) => row.keys.length === 1);
  const pairRows = input.rows.filter((row) => row.keys.length >= 2 && row.keys[0] && row.keys[1]);
  const overview = buildOverviewFromRows({
    siteUrl: input.siteUrl,
    days: input.days,
    queryRows: pairRows.length > 0 ? pairRows : queryRows,
    pageRows: pairRows.length > 0 ? pairRows : pageRows.length > 0 ? pageRows : queryRows,
  });
  const limitations =
    pairRows.length > 0
      ? [`Cannibalization measured from ${pairRows.length} uploaded query×page rows.`]
      : [
          "Limited — this standard CSV export has no query×page pairs, so full cannibalization cannot be measured. Connect the API for full cannibalization.",
        ];

  return {
    siteUrl: input.siteUrl,
    periodDays: input.days,
    source: "csv-upload",
    window,
    dataState: "all",
    overview,
    comparison: null,
    cannibalization: detectCannibalizationFromRows(pairRows, input.brandTerms ?? []),
    properties: [],
    sitemaps: [],
    notes: [`Measured from operator-uploaded GSC export: ${input.fileName}. Period comparison is unavailable from a standard export.`],
    limitations,
  };
}
