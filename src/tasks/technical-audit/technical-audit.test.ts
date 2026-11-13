import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrawlRun, upsertCrawlPages, type CrawlPageRecord } from "@/core/crawler";
import { runTechnicalAuditTask } from "./index";
import { detectDeterministicTechnicalFindings } from "./prompt";
import { validateTechnicalAuditRows } from "./validator";

const FIXTURE_PATH = path.resolve(__dirname, "../../../tests/fixtures/technical-audit.json");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8")) as {
  property: { name: string; brand: string; city: string; state: string; url: string };
  rows: unknown[];
};

function makePage(overrides: Partial<CrawlPageRecord>): CrawlPageRecord {
  return {
    crawlRunId: "run-1",
    url: "https://harborview.example.com/",
    finalUrl: "https://harborview.example.com/",
    statusCode: 200,
    redirectChain: [],
    canonical: "https://harborview.example.com/",
    robotsMeta: null,
    title: "The Harborview Hotel",
    metaDescription: "Luxury stay in Charleston",
    h1H6: [{ level: 1, text: "The Harborview Hotel" }],
    wordCount: 450,
    contentHash: "hash-home",
    images: [],
    internalLinks: [],
    externalLinks: [],
    hreflang: [],
    jsonLd: [],
    openGraph: {},
    responseTimeMs: 210,
    depth: 0,
    inSitemap: true,
    needsJsRendering: false,
    issues: [],
    crawledAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("tasks/technical-audit", () => {
  it("detects 404s, missing canonicals, slow responses, and JS-rendered pages deterministically", async () => {
    const crawl = await createCrawlRun({
      propertyId: null,
      taskRunId: null,
      startUrl: "https://harborview.example.com",
      maxPages: 10,
      crawlDepth: 2,
      includePatterns: [],
      excludePatterns: [],
      queueState: {
        frontier: [],
        visited: [],
        sitemapUrls: [],
        sitemapStatuses: [],
        robots: { allow: [], disallow: [], sitemaps: [], raw: "User-agent: *" },
      },
      pagesDiscovered: 2,
    });

    const pages = [
      makePage({
        crawlRunId: crawl.id,
        url: "https://harborview.example.com/old-packages",
        finalUrl: "https://harborview.example.com/old-packages",
        statusCode: 404,
      }),
      makePage({
        crawlRunId: crawl.id,
        url: "https://harborview.example.com/rooms",
        finalUrl: "https://harborview.example.com/rooms",
        canonical: null,
        needsJsRendering: true,
        responseTimeMs: 2200,
      }),
    ];

    const { findings, summary } = detectDeterministicTechnicalFindings(crawl, pages);
    expect(summary.brokenCount).toBe(1);
    expect(summary.missingCanonicalCount).toBe(1);
    expect(summary.jsRenderedCount).toBe(1);
    expect(summary.slowPagesCount).toBe(1);
    expect(findings.some((f) => f.category === "broken-link")).toBe(true);
  });

  it("rejects ungrounded URLs in validator", () => {
    const outcome = validateTechnicalAuditRows({
      draft: [
        {
          url: "https://harborview.example.com/hallucinated",
          category: "broken-link",
          severity: "high",
          issue: "404",
          recommendation: "Fix",
          owner: "Dev",
          impact: "High",
        },
      ],
      findings: [],
      allowedUrls: new Set(["https://harborview.example.com/rooms"]),
    });
    expect(outcome.valid).toBe(false);
  });

  it("runs full technical-audit pipeline end-to-end with fixture", async () => {
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
        robots: { allow: [], disallow: [], sitemaps: [], raw: "User-agent: *" },
      },
      pagesDiscovered: 2,
    });

    await upsertCrawlPages(crawl.id, [
      makePage({
        crawlRunId: crawl.id,
        url: "https://harborview.example.com/old-packages",
        finalUrl: "https://harborview.example.com/old-packages",
        statusCode: 404,
      }),
      makePage({
        crawlRunId: crawl.id,
        url: "https://harborview.example.com/rooms",
        finalUrl: "https://harborview.example.com/rooms",
        canonical: null,
      }),
    ]);

    const result = await runTechnicalAuditTask(
      { property: fixture.property, crawlRunId: crawl.id },
      { callClaude: async () => JSON.stringify(fixture.rows) },
    );

    expect(["Done", "Flagged"]).toContain(result.status);
    expect(result.output.rows).toHaveLength(2);
    expect(result.output.summary.brokenCount).toBe(1);
    expect(result.output.xlsxBase64.length).toBeGreaterThan(100);
  });
});
