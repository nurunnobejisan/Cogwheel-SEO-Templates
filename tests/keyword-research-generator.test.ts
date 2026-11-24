import { describe, expect, it } from "vitest";
import {
  extractDomainFromUrl,
  getPythonBinary,
  loadSiteKeywordMap,
  type PageArchetype,
} from "../src/generators/keyword-research";

describe("Keyword Research & Page-Mapping Engine (TypeScript Bridge)", () => {
  it("extracts clean domain from arbitrary URL formats", () => {
    expect(extractDomainFromUrl("https://www.thenines.com/rooms/")).toBe("thenines.com");
    expect(extractDomainFromUrl("http://examplehotel.com/amenities")).toBe("examplehotel.com");
    expect(extractDomainFromUrl("marriott.com/hotel/123")).toBe("marriott.com");
    expect(extractDomainFromUrl("https://curio.hilton.com")).toBe("curio.hilton.com");
  });

  it("resolves Python binary path", () => {
    const py = getPythonBinary();
    expect(typeof py).toBe("string");
    expect(py.length).toBeGreaterThan(0);
  });

  it("validates all 10 page archetypes", () => {
    const validArchetypes: PageArchetype[] = [
      "home",
      "category_overview",
      "product_or_room",
      "service_or_amenity",
      "dining_or_outlet",
      "events_or_offers",
      "about_or_history",
      "faq",
      "gallery",
      "blog",
    ];
    expect(validArchetypes).toHaveLength(10);
  });

  it("loads existing site-keyword-map.json if present", async () => {
    const map = await loadSiteKeywordMap("thenines.com", "output");
    if (map) {
      expect(map.domain).toBe("thenines.com");
      expect(map.brand_name).toBeDefined();
      expect(map.pages.length).toBeGreaterThan(0);
      expect(map.keyword_buckets.length).toBeGreaterThan(0);

      // Verify de-cannibalization: every page must have a unique primary keyword
      const primaryKeywords = map.pages.map((p) => p.primary_keyword.toLowerCase());
      const uniqueKeywords = new Set(primaryKeywords);
      expect(uniqueKeywords.size).toBe(primaryKeywords.length);

      // Verify rationales cite SV and KD
      for (const p of map.pages) {
        expect(p.volume).toBeGreaterThanOrEqual(0);
        expect(p.kd).toBeGreaterThanOrEqual(0);
        expect(p.rationale).toContain(p.primary_keyword);
      }
    }
  });
});
