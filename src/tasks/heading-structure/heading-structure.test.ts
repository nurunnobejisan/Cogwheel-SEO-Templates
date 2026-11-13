import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrawlRun, upsertCrawlPages } from "@/core/crawler";
import { runHeadingStructureTask } from "./index";
import { detectDeterministicHeadingIssues } from "./prompt";
import { validateHeadingStructureRows } from "./validator";

const FIXTURE_PATH = path.resolve(__dirname, "../../../tests/fixtures/heading-structure-example.json");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8")) as {
  property: { name: string; brand: string; city: string; state: string; url: string };
  rows: Array<{
    page: string;
    url: string;
    currentH1: string;
    proposedH1: string;
    currentH2List: string[];
    proposedH2List: string[];
    issue: string;
    primaryKeyword: string;
    notes: string;
  }>;
};

describe("tasks/heading-structure", () => {
  it("detects missing H1, multiple H1s, skipped levels, and duplicate H1s deterministically", () => {
    const issues = detectDeterministicHeadingIssues([
      { url: "https://hotelx.example.com/a", headings: [{ level: 2, text: "Only H2" }] },
      {
        url: "https://hotelx.example.com/b",
        headings: [
          { level: 1, text: "Rooms" },
          { level: 1, text: "Suites" },
          { level: 4, text: "Skipped from H1 to H4" },
        ],
      },
      { url: "https://hotelx.example.com/c", headings: [{ level: 1, text: "Rooms" }] },
    ]);

    expect(issues.get("https://hotelx.example.com/a")).toContain("Missing H1");
    expect(issues.get("https://hotelx.example.com/b")).toContain("Multiple H1s (2)");
    expect(issues.get("https://hotelx.example.com/b")?.some((i) => i.includes("Skipped heading level"))).toBe(true);
    expect(issues.get("https://hotelx.example.com/b")).toContain("Duplicate H1 across pages");
    expect(issues.get("https://hotelx.example.com/c")).toContain("Duplicate H1 across pages");
  });

  it("validates fixture row and flags skipped levels, duplicate H1, and missing H1", () => {
    expect(validateHeadingStructureRows({ rows: fixture.rows }).valid).toBe(true);

    const bad = validateHeadingStructureRows({
      rows: [
        {
          page: "Rooms",
          url: "https://hotelx.example.com/rooms",
          currentH1: "",
          proposedH1: "Hotel Rooms Gainesville",
          currentH2List: [],
          proposedH2List: ["Hotel Rooms Gainesville Overview"],
          proposedOutlineLevels: [1, 4],
          issue: "Missing H1",
          primaryKeyword: "hotel rooms gainesville",
          notes: "",
        },
        {
          page: "Suites",
          url: "https://hotelx.example.com/suites",
          currentH1: "",
          proposedH1: "Hotel Rooms Gainesville",
          currentH2List: [],
          proposedH2List: ["Suites"],
          issue: "None",
          primaryKeyword: "",
          notes: "",
        },
      ],
    });
    expect(bad.valid).toBe(false);
    expect(bad.flags.some((f) => f.code === "skipped-heading-level")).toBe(true);
    expect(bad.flags.some((f) => f.code === "duplicate-h1")).toBe(true);
  });

  it("returns a clear error when no Site Crawl run exists", async () => {
    await expect(
      runHeadingStructureTask(
        {
          property: {
            name: "No Crawl Hotel",
            brand: "Hilton",
            city: "Austin",
            state: "TX",
            allowedLocations: [],
            excludedLocations: [],
          },
        },
        { callClaude: async () => "{}" },
      ),
    ).rejects.toThrow(/run Site Crawl first/i);
  });

  it("auto-retries up to 2x and produces xlsx output using crawl_run", async () => {
    const crawlRun = await createCrawlRun({
      propertyId: null,
      taskRunId: null,
      startUrl: "https://hotelx.example.com/",
      maxPages: 10,
      crawlDepth: 2,
      includePatterns: [],
      excludePatterns: [],
      pagesDiscovered: 1,
      queueState: {
        frontier: [],
        visited: ["https://hotelx.example.com/"],
        sitemapUrls: ["https://hotelx.example.com/"],
        sitemapStatuses: [],
        robots: { allow: [], disallow: [], sitemaps: [], raw: "" },
      },
    });

    await upsertCrawlPages(crawlRun.id, [
      {
        crawlRunId: crawlRun.id,
        url: "https://hotelx.example.com/",
        finalUrl: "https://hotelx.example.com/",
        statusCode: 200,
        redirectChain: [],
        canonical: "https://hotelx.example.com/",
        robotsMeta: "index, follow",
        title: "Hotel X Gainesville",
        metaDescription: "Stay at Hotel X Gainesville.",
        h1H6: [{ level: 1, text: "Welcome to Hotel X" }],
        wordCount: 120,
        contentHash: "abc",
        images: [],
        internalLinks: [],
        externalLinks: [],
        hreflang: [],
        jsonLd: [],
        openGraph: {},
        responseTimeMs: 40,
        depth: 0,
        inSitemap: true,
        needsJsRendering: false,
        issues: [],
        crawledAt: new Date().toISOString(),
      },
    ]);

    let calls = 0;
    const result = await runHeadingStructureTask(
      {
        property: {
          ...fixture.property,
          allowedLocations: [],
          excludedLocations: [],
        },
        crawlRunId: crawlRun.id,
        keywordMap: { "/": "boutique hotel gainesville fl" },
      },
      {
        callClaude: async () => {
          calls += 1;
          if (calls === 1) {
            return JSON.stringify({
              rows: [{ url: "https://hotelx.example.com/", proposedH1: "", proposedH2List: [], notes: "" }],
            });
          }
          return JSON.stringify({ rows: fixture.rows });
        },
      },
    );

    expect(calls).toBe(2);
    expect(result.retries).toBe(1);
    expect(result.status).toBe("Done");
    expect(result.output.xlsxBase64.length).toBeGreaterThan(100);
  });
});

