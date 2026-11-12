import { describe, expect, it } from "vitest";
import sitemap from "@/config/sitemap.json";
import { runDocumentQualityCheck } from "@/lib/doc-quality";
import { analyzeGeoSeo, classifyIntent, isBrandedKeyword } from "@/lib/engine/geo-seo";
import type { KeywordRecord, MatrixRow, PoolEntry, Property, SitemapPage } from "@/lib/types";

const property: Property = {
  name: "Catbird Hotel Denver",
  url: "https://www.catbirdhotel.com",
  brand: "Catbird",
  city: "Denver",
  state: "CO",
  allowedLocations: [],
  excludedLocations: [],
};

const pages = (sitemap.pages as SitemapPage[]).slice(0, 3);

describe("GEO/SEO analyzer & Document Quality Check", () => {
  it("classifies search intent and separates branded vs non-branded keywords", () => {
    expect(classifyIntent("book denver hotel room")).toBe("transactional");
    expect(classifyIntent("hotel near ball arena denver")).toBe("local");
    expect(classifyIntent("what is the best boutique hotel in denver")).toBe("informational");
    expect(isBrandedKeyword("catbird hotel denver", property)).toBe(true);
    expect(isBrandedKeyword("boutique hotel denver", property)).toBe(false);
  });

  it("computes GEO/SEO insights and detects cannibalization warnings", () => {
    const keywords: KeywordRecord[] = [
      { id: "kw:catbird denver", keyword: "catbird denver", volume: 1200, kd: 20, cpc: null, intent: null, sourceGroup: "Brand", sourceFiles: ["a.csv"], flags: [] },
      { id: "kw:how to get to ball arena from downtown", keyword: "how to get to ball arena from downtown", volume: 320, kd: 15, cpc: null, intent: null, sourceGroup: "Local", sourceFiles: ["a.csv"], flags: [] },
      { id: "kw:denver boutique hotel", keyword: "denver boutique hotel", volume: 2400, kd: 34, cpc: null, intent: null, sourceGroup: "Home", sourceFiles: ["a.csv"], flags: [] },
    ];
    const matrix: MatrixRow[] = [
      { pageId: "home", path: "/", title: "Home", primary: { id: "kw:denver boutique hotel", keyword: "denver boutique hotel", volume: 2400, kd: 34 }, secondary: null, alternatives: [], exceptionCandidate: null, flags: [], status: "approved" },
      { pageId: "rooms", path: "/rooms", title: "Rooms", primary: { id: "kw:denver boutique hotel", keyword: "denver boutique hotel", volume: 2400, kd: 34 }, secondary: null, alternatives: [], exceptionCandidate: null, flags: [], status: "approved" },
    ];

    const insights = analyzeGeoSeo(keywords, matrix, pages, property);
    expect(insights.brandedCount).toBe(1);
    expect(insights.nonBrandedCount).toBe(2);
    expect(insights.conversationalQueries).toHaveLength(1);
    expect(insights.cannibalizationWarnings).toHaveLength(1);
    expect(insights.pageConfidence.home.score).toBeGreaterThan(80);
  });

  it("runs Phase 8 Document Quality Check and fails on duplicate primaries or unresolved placeholders", () => {
    const matrix: MatrixRow[] = [
      { pageId: "home", path: "/", title: "Home", primary: { id: "kw:a", keyword: "denver hotels", volume: 5000, kd: 50 }, secondary: null, alternatives: [], exceptionCandidate: null, flags: [], status: "approved" },
    ];
    const pool: PoolEntry[] = Array.from({ length: 20 }, (_, i) => ({
      id: `kw:${i}`,
      keyword: `kw ${i}`,
      volume: 100,
      kd: 20,
      cpc: null,
      intent: null,
      sourceGroup: "Home",
      sourceFiles: ["a.csv"],
      flags: [],
      role: "fill",
    }));

    const passed = runDocumentQualityCheck({ property, pages, matrix, pool, unresolvedPlaceholders: [] });
    expect(passed.overall).toBe("passed");
    expect(passed.failedCount).toBe(0);

    const warned = runDocumentQualityCheck({
      property,
      pages,
      matrix,
      pool,
      unresolvedPlaceholders: ["{{EXECUTIVE_SUMMARY}}"],
    });
    expect(warned.overall).toBe("warning");
  });
});

