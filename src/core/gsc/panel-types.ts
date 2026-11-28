/** Client-safe payload contract for the GSC panel (types only). */
import type {
  GscCannibalizationIssue,
  GscPerformanceOverview,
  GscPeriodComparison,
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
