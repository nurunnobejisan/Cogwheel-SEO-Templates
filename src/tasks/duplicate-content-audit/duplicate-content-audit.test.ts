import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrawlRun, upsertCrawlPages, type CrawlPageRecord } from "@/core/crawler";
import { runDuplicateContentAuditTask } from "./index";
import { detectDeterministicDuplicateClusters } from "./prompt";
import { validateDuplicateContentRows } from "./validator";

const FIXTURE_PATH = path.resolve(__dirname, "../../../tests/fixtures/duplicate-content-audit.json");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8")) as {
  property: { name: string; brand: string; city: string; state: string; url: string };
  rows: unknown[];
};

function makePage(overrides: Partial<CrawlPageRecord>): CrawlPageRecord {
  return {
    crawlRunId: "run-1",
    url: "https://harborview.example.com/dining",
    finalUrl: "https://harborview.example.com/dining",
    statusCode: 200,
    redirectChain: [],
    canonical: null,
    robotsMeta: null,
    title: "Dining | The Harborview Hotel",
    metaDescription: "Coastal dining in Charleston",
    h1H6: [{ level: 1, text: "Dining" }],
    wordCount: 400,
    contentHash: "same-hash",
    images: [],
    internalLinks: [],
    externalLinks: [],
    hreflang: [],
    jsonLd: [],
    openGraph: {},
    responseTimeMs: 120,
    depth: 1,
    inSitemap: true,
    needsJsRendering: false,
    issues: [],
    crawledAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("tasks/duplicate-content-audit", () => {
  it("detects exact contentHash duplicates, duplicate titles/meta, and thin pages", () => {
    const { clusters, summary } = detectDeterministicDuplicateClusters([
      makePage({ url: "https://harborview.example.com/dining" }),
      makePage({ url: "https://harborview.example.com/restaurants" }),
      makePage({
        url: "https://harborview.example.com/faq",
        title: "FAQ",
        metaDescription: "Frequently asked questions",
        contentHash: "faq-hash",
        wordCount: 110,
      }),
    ]);

    expect(summary.exactDuplicateClusters).toBe(1);
    expect(summary.duplicateTitleGroups).toBe(1);
    expect(summary.duplicateMetaGroups).toBe(1);
    expect(summary.thinPageCount).toBe(1);
    expect(clusters.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects ungrounded URLs in validator", () => {
    const outcome = validateDuplicateContentRows({
      draft: [
        {
          clusterType: "thin-content",
          primaryUrl: "https://harborview.example.com/not-crawled",
          affectedUrls: ["https://harborview.example.com/not-crawled"],
          severity: "medium",
          recommendedAction: "expand-content",
          rationale: "Thin",
        },
      ],
      clusters: [],
      allowedUrls: new Set(["https://harborview.example.com/dining"]),
    });
    expect(outcome.valid).toBe(false);
  });

  it("runs full duplicate-content-audit pipeline end-to-end with fixture", async () => {
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
      pagesDiscovered: 3,
    });

    await upsertCrawlPages(crawl.id, [
      makePage({ crawlRunId: crawl.id, url: "https://harborview.example.com/dining" }),
      makePage({ crawlRunId: crawl.id, url: "https://harborview.example.com/restaurants" }),
      makePage({
        crawlRunId: crawl.id,
        url: "https://harborview.example.com/faq",
        title: "FAQ",
        metaDescription: "Frequently asked questions",
        contentHash: "faq-hash",
        wordCount: 110,
      }),
    ]);

    const result = await runDuplicateContentAuditTask(
      { property: fixture.property, crawlRunId: crawl.id },
      { callClaude: async () => JSON.stringify(fixture.rows) },
    );

    expect(["Done", "Flagged"]).toContain(result.status);
    expect(result.output.rows).toHaveLength(2);
    expect(result.output.summary.exactDuplicateClusters).toBe(1);
    expect(result.output.summary.thinPageCount).toBe(1);
  });
});
