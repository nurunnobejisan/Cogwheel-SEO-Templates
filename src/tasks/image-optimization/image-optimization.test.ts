import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrawlRun, upsertCrawlPages, type CrawlPageRecord } from "@/core/crawler";
import { runImageOptimizationTask } from "./index";
import { detectDeterministicImageIssues } from "./prompt";
import { validateImageOptimizationRows } from "./validator";

const FIXTURE_PATH = path.resolve(__dirname, "../../../tests/fixtures/image-optimization.json");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8")) as {
  property: { name: string; brand: string; city: string; state: string; url: string };
  rows: unknown[];
};

function makePage(crawlRunId: string): CrawlPageRecord {
  return {
    crawlRunId,
    url: "https://harborview.example.com/rooms",
    finalUrl: "https://harborview.example.com/rooms",
    statusCode: 200,
    redirectChain: [],
    canonical: "https://harborview.example.com/rooms",
    robotsMeta: null,
    title: "Luxury Suites | The Harborview Hotel",
    metaDescription: "Rooms and suites",
    h1H6: [{ level: 1, text: "Guest Rooms & Suites" }],
    wordCount: 350,
    contentHash: "hash-rooms",
    images: [
      {
        src: "https://harborview.example.com/images/king-suite.jpg",
        alt: null,
        width: null,
        height: null,
        fileSize: 320_000,
      },
    ],
    internalLinks: [],
    externalLinks: [],
    hreflang: [],
    jsonLd: [],
    openGraph: {},
    responseTimeMs: 180,
    depth: 1,
    inSitemap: true,
    needsJsRendering: false,
    issues: [],
    crawledAt: new Date().toISOString(),
  };
}

describe("tasks/image-optimization", () => {
  it("detects missing alt, oversized files, missing dimensions, and legacy formats", () => {
    const page = makePage("run-1");
    const { candidates, summary } = detectDeterministicImageIssues([page], new Map());
    expect(summary.totalImages).toBe(1);
    expect(summary.missingAltCount).toBe(1);
    expect(summary.oversizedCount).toBe(1);
    expect(summary.missingDimensionsCount).toBe(1);
    expect(summary.nonNextGenCount).toBe(1);
    expect(candidates).toHaveLength(1);
  });

  it("rejects overly long or generic alt text", () => {
    const outcome = validateImageOptimizationRows({
      draft: [
        {
          pageUrl: "https://harborview.example.com/rooms",
          imageSrc: "https://harborview.example.com/images/king-suite.jpg",
          currentAlt: "",
          proposedAlt: "photo",
          issue: "Missing alt",
          recommendation: "Add alt",
        },
      ],
      candidates: [
        {
          pageUrl: "https://harborview.example.com/rooms",
          pageTitle: "Rooms",
          primaryKeyword: "charleston hotel suites",
          imageSrc: "https://harborview.example.com/images/king-suite.jpg",
          currentAlt: "",
          width: null,
          height: null,
          fileSize: 320_000,
          issues: ["Missing alt attribute"],
        },
      ],
    });
    expect(outcome.valid).toBe(false);
  });

  it("runs full image-optimization pipeline end-to-end with fixture", async () => {
    const crawl = await createCrawlRun({
      propertyId: null,
      taskRunId: null,
      startUrl: fixture.property.url,
      maxPages: 10,
      crawlDepth: 2,
      includePatterns: [],
      excludePatterns: [],
      queueState: {
        frontier: [],
        visited: [],
        sitemapUrls: [],
        sitemapStatuses: [],
        robots: { allow: [], disallow: [], sitemaps: [], raw: "" },
      },
      pagesDiscovered: 1,
    });

    await upsertCrawlPages(crawl.id, [makePage(crawl.id)]);

    const result = await runImageOptimizationTask(
      { property: fixture.property, crawlRunId: crawl.id },
      { callClaude: async () => JSON.stringify(fixture.rows) },
    );

    expect(["Done", "Flagged"]).toContain(result.status);
    expect(result.output.rows).toHaveLength(1);
    expect(result.output.summary.missingAltCount).toBe(1);
    expect(result.output.xlsxBase64.length).toBeGreaterThan(100);
  });
});
