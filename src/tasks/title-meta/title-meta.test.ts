import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrawlRun, upsertCrawlPages } from "@/core/crawler";
import { runTitleMetaTask } from "./index";
import { validateTitleMetaRows } from "./validator";

const FIXTURE_PATH = path.resolve(__dirname, "../../../tests/fixtures/title-meta-example.json");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8")) as {
  property: { name: string; brand: string; city: string; state: string; url: string };
  rows: Array<{
    page: string;
    url: string;
    currentTitle: string;
    proposedTitle: string;
    currentMeta: string;
    proposedMeta: string;
    primaryKeyword: string;
    notes: string;
  }>;
};

describe("tasks/title-meta", () => {
  it("passes validation on the reference fixture row", () => {
    const res = validateTitleMetaRows({
      rows: fixture.rows,
      brand: fixture.property.brand,
    });
    expect(res.valid).toBe(true);
    expect(res.flags).toEqual([]);
  });

  it("flags too-long title, duplicate meta, and missing keyword in meta", () => {
    const res = validateTitleMetaRows({
      brand: fixture.property.brand,
      rows: [
        {
          page: "Home",
          url: "https://hotelx.example.com/",
          currentTitle: "Old",
          proposedTitle: "Boutique Hotel Gainesville FL | Tapestry Collection Luxury Suites & Rooftop Bar",
          currentMeta: "Old",
          proposedMeta:
            "Stay at Hotel X Gainesville near the University of Florida with modern guest rooms, rooftop dining, and pet-friendly spaces for travelers. Book your stay today.",
          primaryKeyword: "boutique hotel gainesville fl",
          notes: "",
        },
        {
          page: "Rooms",
          url: "https://hotelx.example.com/rooms",
          currentTitle: "Rooms",
          proposedTitle: "Boutique Hotel Gainesville FL Rooms | Tapestry Collection",
          currentMeta: "Rooms",
          proposedMeta:
            "Stay at Hotel X Gainesville near the University of Florida with modern guest rooms, rooftop dining, and pet-friendly spaces for travelers. Book your stay today.",
          primaryKeyword: "hotel rooms gainesville",
          notes: "",
        },
      ],
    });

    expect(res.valid).toBe(false);
    expect(res.flags.some((f) => f.code === "title-length")).toBe(true);
    expect(res.flags.some((f) => f.code === "meta-missing-keyword")).toBe(true);
    expect(res.flags.some((f) => f.code === "duplicate-meta")).toBe(true);
  });

  it("returns a clear error when no Site Crawl run exists", async () => {
    await expect(
      runTitleMetaTask(
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

  it("auto-retries up to 2x and completes using latest crawl_run and fixture output", async () => {
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
        h1H6: [{ level: 1, text: "Hotel X Gainesville" }],
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

    let claudeCalls = 0;
    const result = await runTitleMetaTask(
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
          claudeCalls += 1;
          if (claudeCalls === 1) {
            return JSON.stringify({
              rows: [
                {
                  url: "https://hotelx.example.com/",
                  proposedTitle: "Too short",
                  proposedMeta: "Too short",
                  notes: "bad",
                },
              ],
            });
          }
          return JSON.stringify({ rows: fixture.rows });
        },
      },
    );

    expect(claudeCalls).toBe(2);
    expect(result.retries).toBe(1);
    expect(result.status).toBe("Done");
    expect(result.output.rows[0].titleCharCount).toBeGreaterThanOrEqual(50);
  });
});

