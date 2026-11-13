import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RateLimiter, type FetchPageResult } from "@/core/crawler";
import { runSiteCrawlTask } from "@/tasks/site-crawl";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/crawl");
const readFixture = (name: string) => fs.readFileSync(path.join(FIXTURE_DIR, name), "utf-8");

describe("tasks/site-crawl", () => {
  it("runs chunked batches and completes a site crawl using mocked fetch", async () => {
    const pagesByUrl: Record<string, FetchPageResult> = {
      "https://hotelx.example.com/": {
        url: "https://hotelx.example.com/",
        finalUrl: "https://hotelx.example.com/",
        statusCode: 200,
        redirectChain: [],
        html: readFixture("clean.html"),
        responseTimeMs: 30,
      },
      "https://hotelx.example.com/rooms": {
        url: "https://hotelx.example.com/rooms",
        finalUrl: "https://hotelx.example.com/rooms",
        statusCode: 200,
        redirectChain: [],
        html: readFixture("missing-title.html"),
        responseTimeMs: 25,
      },
      "https://hotelx.example.com/dining": {
        url: "https://hotelx.example.com/dining",
        finalUrl: "https://hotelx.example.com/dining",
        statusCode: 200,
        redirectChain: [],
        html: readFixture("duplicate-h1.html"),
        responseTimeMs: 28,
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const u = input.toString();
      if (u.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nAllow: /", { status: 200 });
      }
      if (u.endsWith("/sitemap.xml")) {
        return new Response("", { status: 404 });
      }
      return new Response("", { status: 404 });
    }) as typeof fetch;

    try {
      const fastLimiter = new RateLimiter(1000);
      const mockFetchPage = async (url: string): Promise<FetchPageResult> =>
        pagesByUrl[url] ?? {
          url,
          finalUrl: url,
          statusCode: 404,
          redirectChain: [],
          html: "",
          responseTimeMs: 10,
        };

      // Batch 1: 1 page
      const step1 = await runSiteCrawlTask(
        { url: "https://hotelx.example.com/", maxPages: 10, crawlDepth: 2, batchSize: 1 },
        { rateLimiter: fastLimiter, fetchPage: mockFetchPage },
      );

      expect(step1.status).toBe("Running");
      expect(step1.output.progress.crawled).toBe(1);
      expect(step1.output.progress.discovered).toBeGreaterThanOrEqual(3);

      // Step remaining batches
      const step2 = await runSiteCrawlTask(
        { crawlRunId: step1.output.crawlRunId, batchSize: 10, runAllBatches: true },
        { rateLimiter: fastLimiter, fetchPage: mockFetchPage },
      );

      expect(step2.output.status).toBe("completed");
      expect(step2.output.progress.crawled).toBe(3);
      expect(step2.output.siteSummary.issueCounts["missing-title"]).toBe(1);
      expect(step2.output.siteSummary.issueCounts["duplicate-h1"]).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
