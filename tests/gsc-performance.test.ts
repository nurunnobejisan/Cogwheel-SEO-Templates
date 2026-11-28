import { describe, expect, it } from "vitest";
import {
  buildGscDateWindow,
  detectCannibalizationFromRows,
  normalizePageUrl,
} from "../src/core/gsc/rows.ts";
import {
  buildGscPanelFromUpload,
  parseGscCsvText,
} from "../src/core/gsc/panel.ts";
import type { GscSearchRow } from "../src/core/gsc/types.ts";

function row(query: string, page: string, clicks: number, impressions: number, position: number): GscSearchRow {
  return {
    keys: [query, page],
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position,
  };
}

describe("GSC performance panel", () => {
  it("uses an explicit final-data window ending three days ago", () => {
    const window = buildGscDateWindow(28, new Date("2026-11-28T12:00:00Z"));
    expect(window).toEqual({
      startDate: "2026-10-29",
      endDate: "2026-11-25",
      previousStartDate: "2026-10-01",
      previousEndDate: "2026-10-28",
    });
  });

  it("normalises tracking parameters, host case and trailing slashes", () => {
    expect(normalizePageUrl("https://EXAMPLE.com/Hotel?utm_source=a&gclid=x#room")).toBe("https://example.com/hotel/");
    expect(normalizePageUrl("https://example.com/hotel/?utm_medium=b")).toBe("https://example.com/hotel/");
  });

  it("flags only measured query×page conflicts and excludes brand terms", () => {
    const rows = [
      row("best boutique hotel nyc", "https://example.com/a?utm_source=x", 50, 1000, 5),
      row("best boutique hotel nyc", "https://example.com/b/", 10, 250, 15),
      row("Brand Hotel rooms", "https://example.com/brand-a", 20, 400, 3),
      row("Brand Hotel rooms", "https://example.com/brand-b", 20, 400, 8),
      row("tiny overlap", "https://example.com/tiny-a", 5, 200, 4),
      row("tiny overlap", "https://example.com/tiny-b", 0, 10, 6),
      row("few impressions", "https://example.com/few-a", 3, 100, 4),
      row("few impressions", "https://example.com/few-b", 1, 9, 9),
      row("deep result", "https://example.com/deep-a", 3, 100, 31),
      row("deep result", "https://example.com/deep-b", 2, 80, 32),
    ];
    const issues = detectCannibalizationFromRows(rows, ["brand hotel"]);
    expect(issues.map((issue) => issue.query)).toEqual(["best boutique hotel nyc"]);
    const issue = issues[0];
    expect(issue.competingPages).toHaveLength(2);
    expect(issue.preferredUrl).toContain("/a");
    expect(issue.normalizedUrls).toContain("https://example.com/b/");
    expect(issue.topUrlClickShare).toBeCloseTo(50 / 60, 3);
    expect(issue.positionSpreadFactor).toBe(2);
    expect(issue.severityScore).toBeGreaterThan(0);
    expect(issue.recommendation).toMatch(/Consolidate|Differentiate|Canonicalize/);
    expect(issue.recommendation).toContain("Add exact-match internal links");
  });

  it("requires the second URL to reach 20% of the top URL impressions", () => {
    const issues = detectCannibalizationFromRows([
      row("query", "https://example.com/a", 20, 1000, 4),
      row("query", "https://example.com/b", 1, 150, 9),
    ]);
    expect(issues).toEqual([]);
  });

  it("parses GSC CSV headers and labels standard exports as limited", () => {
    const pairs = parseGscCsvText(
      "Query,Page,Clicks,Impressions,CTR,Position\nbest hotel,https://example.com/a,12,300,4%,6\nbest hotel,https://example.com/b,3,100,3%,14\n"
    );
    expect(pairs).toHaveLength(2);
    expect(pairs[0].keys).toEqual(["best hotel", "https://example.com/a"]);
    expect(pairs[0].ctr).toBeCloseTo(0.04);

    const full = buildGscPanelFromUpload({
      siteUrl: "sc-domain:example.com",
      days: 28,
      fileName: "query-page.csv",
      rows: pairs,
    });
    expect(full.source).toBe("csv-upload");
    expect(full.comparison).toBeNull();
    expect(full.cannibalization).toHaveLength(1);
    expect(full.limitations.join(" ")).not.toContain("Limited");

    const queriesOnly = parseGscCsvText(
      "Top queries,Clicks,Impressions,CTR,Position\nbest hotel,12,300,4%,6\n"
    );
    const limited = buildGscPanelFromUpload({
      siteUrl: "sc-domain:example.com",
      days: 28,
      fileName: "queries.csv",
      rows: queriesOnly,
    });
    expect(limited.cannibalization).toEqual([]);
    expect(limited.limitations.join(" ")).toContain("Limited — this standard CSV export has no query×page pairs");
    expect(limited.limitations.join(" ")).toContain("Connect the API for full cannibalization");
  });
});
