import { describe, expect, it } from "vitest";
import { runSitemapNavigationOptimizationTask } from "@/tasks/sitemap-navigation-optimization";

describe("sitemap-navigation-optimization task", () => {
  it("generates XML sitemap and validates depth & orphan findings", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        xmlSitemapHealth: {
          totalSitemapUrls: 12,
          valid200Urls: 12,
          non200UrlsInSitemap: [],
          orphanUrlsCount: 1,
        },
        clickDepthAnalysis: [
          {
            url: "https://luxuryhotelcharleston.com/",
            depth: 0,
            internalInlinksCount: 24,
            status: "optimal",
            recommendation: "Maintain clean root navigation links.",
          },
          {
            url: "https://luxuryhotelcharleston.com/rooftop-lounge-reservations",
            depth: 4,
            internalInlinksCount: 1,
            status: "deep_warning",
            recommendation: "Elevate link into Dining main navigation dropdown.",
          },
        ],
        navigationGaps: [
          "Meeting & Event inquiry page has only 1 internal inlink from footer",
        ],
        generatedXmlSitemapEntries: [
          {
            loc: "https://luxuryhotelcharleston.com/",
            lastmod: "2026-11-20",
            changefreq: "daily",
            priority: 1.0,
            pageType: "home",
          },
          {
            loc: "https://luxuryhotelcharleston.com/rooms-suites",
            lastmod: "2026-11-15",
            changefreq: "weekly",
            priority: 0.9,
            pageType: "rooms",
          },
        ],
      });

    const result = await runSitemapNavigationOptimizationTask(
      {
        property: {
          name: "The Charleston Grand Hotel",
          brand: "Curio Collection by Hilton",
          city: "Charleston",
          state: "SC",
          url: "https://luxuryhotelcharleston.com",
        },
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.entriesCount).toBe(2);
    expect(result.output.xmlSitemapString).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.output.xmlSitemapString).toContain("<priority>1.0</priority>");
    expect(result.output.xmlSitemapString).toContain("https://luxuryhotelcharleston.com/rooms-suites");
  });
});
