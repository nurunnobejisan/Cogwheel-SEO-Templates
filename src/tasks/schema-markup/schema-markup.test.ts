import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrawlRun, upsertCrawlPages, type CrawlPageRecord } from "@/core/crawler";
import { runSchemaMarkupTask } from "./index";
import { validateSchemaMarkupItems } from "./validator";

const FIXTURE_PATH = path.resolve(__dirname, "../../../tests/fixtures/schema-markup.json");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8")) as {
  property: { name: string; brand: string; city: string; state: string; url: string };
  items: unknown[];
};

function makePage(crawlRunId: string): CrawlPageRecord {
  return {
    crawlRunId,
    url: "https://harborview.example.com/",
    finalUrl: "https://harborview.example.com/",
    statusCode: 200,
    redirectChain: [],
    canonical: "https://harborview.example.com/",
    robotsMeta: null,
    title: "The Harborview Hotel | Charleston SC",
    metaDescription: "Boutique waterfront hotel in Charleston",
    h1H6: [{ level: 1, text: "The Harborview Hotel" }],
    wordCount: 520,
    contentHash: "home-hash",
    images: [],
    internalLinks: [],
    externalLinks: [],
    hreflang: [],
    jsonLd: [],
    openGraph: { "og:title": "The Harborview Hotel" },
    responseTimeMs: 140,
    depth: 0,
    inSitemap: true,
    needsJsRendering: false,
    issues: [],
    crawledAt: new Date().toISOString(),
  };
}

describe("tasks/schema-markup", () => {
  it("flags ungrounded aggregateRating and rejects missing @context", () => {
    const badCtx = validateSchemaMarkupItems({
      draft: [
        {
          pageUrl: "https://harborview.example.com/",
          schemaType: "Hotel",
          existingTypes: [],
          status: "missing",
          jsonLd: { "@type": "Hotel", name: "The Harborview Hotel" },
          notes: "Missing context",
        },
      ],
      candidates: [
        {
          pageUrl: "https://harborview.example.com/",
          title: "The Harborview Hotel",
          metaDescription: "",
          h1: "The Harborview Hotel",
          existingTypes: [],
          existingJsonLdRaw: [],
          openGraph: {},
        },
      ],
    });
    expect(badCtx.valid).toBe(false);

    const flaggedRating = validateSchemaMarkupItems({
      draft: [
        {
          pageUrl: "https://harborview.example.com/",
          schemaType: "Hotel",
          existingTypes: [],
          status: "missing",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Hotel",
            name: "The Harborview Hotel",
            aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9" },
          },
          notes: "Check rating",
        },
      ],
      candidates: [
        {
          pageUrl: "https://harborview.example.com/",
          title: "The Harborview Hotel",
          metaDescription: "",
          h1: "The Harborview Hotel",
          existingTypes: [],
          existingJsonLdRaw: [],
          openGraph: {},
        },
      ],
    });
    expect(flaggedRating.valid).toBe(true);
    expect(flaggedRating.flags.some((f) => f.code === "ungrounded-schema-field")).toBe(true);
  });

  it("runs full schema-markup pipeline end-to-end with fixture", async () => {
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

    const result = await runSchemaMarkupTask(
      { property: fixture.property, crawlRunId: crawl.id },
      { callClaude: async () => JSON.stringify(fixture.items) },
    );

    expect(["Done", "Flagged"]).toContain(result.status);
    expect(result.output.items).toHaveLength(1);
    expect(result.output.summary.missingSchemaPages).toBe(1);
    expect(result.output.combinedJsonLdScript).toContain("application/ld+json");
  });
});
