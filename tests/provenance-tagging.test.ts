/**
 * Task 5.1 — pack & page-type provenance tagging.
 *
 * Every captured web sample, vault record, and JSONL export record must carry
 * `pack` and `pageType`. Covers all four surfaces plus the app/extension copy
 * parity that the page-type-labels suite established for `classifyPageType`.
 *
 *   1. CapturedWebSample (app copy and extension copy)
 *   2. TrainingPairRecord via migration + derivePack
 *   3. ChatML JSONL export metadata + LoRA example metadata
 *   4. Triple capture provenance (deriveTripleProvenance)
 */
import { describe, it, expect } from "vitest";
import { extractCapturedWebSample } from "../src/content/training-capture";
import { extractCapturedWebSample as extractExtSample } from "../chrome-extension/src/content/training-capture";
import { createMockDocument } from "./ts/test-dom-helper";
import {
  derivePack,
  migrateRecordToV3,
  type RawWebInput,
} from "../src/storage/training-vault";
import { derivePack as derivePackExt } from "../chrome-extension/src/storage/training-vault";
import { recordToChatMl } from "../src/engine/dataset-builder";
import type { TrainingPairRecord } from "../src/storage/training-vault";
import { buildLoraExample, deriveTripleProvenance } from "../src/core/training/dataset";
import { MlPageTypeLabels } from "../schemas/ml-example";

const HOTEL_HTML = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Grand Luxury Resort & Spa | Miami Beach Official Site</title>
      <meta name="description" content="5-star oceanfront resort in South Beach Miami." />
      <link rel="canonical" href="https://luxuryresort.com/miami" />
      <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Hotel", "name": "Grand Luxury Resort" }
      </script>
    </head>
    <body>
      <main>
        <h1>Grand Luxury Resort & Spa</h1>
        <p>Oceanfront hotel with luxury pool and hot breakfast in South Beach Miami.</p>
      </main>
    </body>
  </html>
`;

const BLOG_HTML = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Packing tips for a city break</title>
      <meta name="description" content="What to pack for a short city trip." />
      <link rel="canonical" href="https://example.com/blog/packing-tips" />
    </head>
    <body>
      <main>
        <h1>Packing tips for a city break</h1>
        <p>Bring comfortable shoes and a light jacket for the evening.</p>
      </main>
    </body>
  </html>
`;

function sampleRecord(overrides: Partial<TrainingPairRecord> = {}): TrainingPairRecord {
  return {
    id: "hash_1",
    schemaVersion: "3.0.0",
    tier: "raw",
    pack: "hotel",
    canonicalUrlHash: "hash_1",
    contentHash: "ch_1",
    version: 1,
    source: "manual",
    pageType: "hotel_homepage",
    extractionConfidence: 80,
    canonicalUrl: "https://luxuryresort.com/",
    domain: "luxuryresort.com",
    brand: "Independent",
    rawInput: {
      url: "https://luxuryresort.com/",
      canonicalUrl: "https://luxuryresort.com/",
      domain: "luxuryresort.com",
      rawTitle: "Grand Luxury Resort",
      rawMetaDesc: "Oceanfront resort.",
      rawH1: ["Grand Luxury Resort"],
      rawH2: [],
      rawBodyText: "Oceanfront hotel with pool.",
      detectedSchemas: ["Hotel"],
      wordCount: 60,
    } as RawWebInput,
    targetOutput: {} as TrainingPairRecord["targetOutput"],
    qualityScore: 80,
    scoreBreakdown: {
      completeness: 20,
      optimizationDelta: 20,
      geoEntityDepth: 15,
      schemaValidity: 20,
    },
    status: "pending",
    createdAt: "2026-11-27T00:00:00.000Z",
    updatedAt: "2026-11-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("Task 5.1 — captured web sample provenance", () => {
  it("tags a hotel page with pack=hotel and a known pageType (app copy)", () => {
    const doc = createMockDocument(HOTEL_HTML, "https://luxuryresort.com/miami");
    const sample = extractCapturedWebSample(doc);

    expect(sample.pack).toBe("hotel");
    expect(MlPageTypeLabels as readonly string[]).toContain(sample.pageType);
    expect(sample.jsonLdTypes).toContain("Hotel");
  });

  it("tags a non-hotel page as unclassified with a known pageType", () => {
    const doc = createMockDocument(BLOG_HTML, "https://example.com/blog/packing-tips");
    const sample = extractCapturedWebSample(doc);

    expect(sample.pageType).toBe("article");
    expect(sample.pack).toBe("unclassified");
  });

  it("extension copy derives identical provenance (copy parity)", () => {
    const appDoc = createMockDocument(HOTEL_HTML, "https://luxuryresort.com/miami");
    const extDoc = createMockDocument(HOTEL_HTML, "https://luxuryresort.com/miami");
    const appSample = extractCapturedWebSample(appDoc);
    const extSample = extractExtSample(extDoc);

    expect(extSample.pack).toBe(appSample.pack);
    expect(extSample.pageType).toBe(appSample.pageType);
  });
});

describe("Task 5.1 — vault record provenance", () => {
  it("derivePack: hotel JSON-LD wins regardless of page type", () => {
    expect(derivePack(["Hotel"], "article")).toBe("hotel");
    expect(derivePack(["LodgingBusiness"])).toBe("hotel");
    expect(derivePackExt(["Hotel"], "article")).toBe("hotel");
  });

  it("derivePack: hotel-only page type is a fallback signal", () => {
    expect(derivePack([], "room_details")).toBe("hotel");
    expect(derivePack([], "dining")).toBe("hotel");
  });

  it("derivePack: no signal is unclassified, never guessed", () => {
    expect(derivePack([], "article")).toBe("unclassified");
    expect(derivePack([])).toBe("unclassified");
    expect(derivePackExt([], "article")).toBe("unclassified");
  });

  it("migration stamps pack from detected schemas on legacy records", () => {
    const migrated = migrateRecordToV3({
      id: "legacy_1",
      canonicalUrl: "https://luxuryresort.com/",
      rawInput: { url: "https://luxuryresort.com/", detectedSchemas: ["Hotel"] },
    });
    expect(migrated.pack).toBe("hotel");
  });

  it("migration leaves an explicit pack untouched", () => {
    const migrated = migrateRecordToV3({
      id: "legacy_2",
      canonicalUrl: "https://example.com/shop",
      pack: "retail",
      rawInput: { url: "https://example.com/shop", detectedSchemas: ["Product"] },
    });
    expect(migrated.pack).toBe("retail");
  });

  it("migration with no signals yields unclassified", () => {
    const migrated = migrateRecordToV3({
      id: "legacy_3",
      canonicalUrl: "https://example.com/blog/post",
      rawInput: { url: "https://example.com/blog/post", detectedSchemas: [] },
    });
    expect(migrated.pack).toBe("unclassified");
  });
});

describe("Task 5.1 — JSONL export records", () => {
  it("ChatML metadata carries pack and pageType", () => {
    const chatMl = recordToChatMl(sampleRecord(), true);
    expect(chatMl.metadata?.pack).toBe("hotel");
    expect(chatMl.metadata?.pageType).toBe("hotel_homepage");
  });

  it("ChatML metadata omits provenance when includeMetadata is false", () => {
    const chatMl = recordToChatMl(sampleRecord(), false);
    expect(chatMl.metadata).toBeUndefined();
  });

  it("LoRA example metadata carries pack and pageType", () => {
    const example = buildLoraExample({
      id: "t1",
      url: "https://luxuryresort.com/",
      audit: { overallScore: 59 },
      expertFix: { title: "New title" },
      quality: "reviewed",
      capturedAt: "2026-11-27T00:00:00.000Z",
      contentHash: "hash",
      consent: true,
      provenance: "measured",
      pack: "hotel",
      pageType: "hotel_homepage",
    });
    expect(example.metadata.pack).toBe("hotel");
    expect(example.metadata.pageType).toBe("hotel_homepage");
  });
});

describe("Task 5.1 — triple capture provenance", () => {
  it("respects well-formed client-supplied values", () => {
    const derived = deriveTripleProvenance("https://example.com/x", {
      pack: "retail",
      pageType: "article",
    });
    expect(derived).toEqual({ pack: "retail", pageType: "article" });
  });

  it("rejects a malformed page type and re-derives from the URL", () => {
    const derived = deriveTripleProvenance("https://example.com/blog/post", {
      pageType: "not-a-label",
    });
    expect(derived.pageType).toBe("article");
    expect(derived.pack).toBe("unclassified");
  });

  it("rejects a malformed pack slug and derives from the page type", () => {
    const derived = deriveTripleProvenance("https://luxuryresort.com/rooms", {
      pack: "Not A Slug!",
    });
    expect(derived.pack).toBe("hotel");
    expect(derived.pageType).toBe("room_details");
  });

  it("always returns both fields", () => {
    for (const url of ["https://example.com/", "https://example.com/contact", "https://a.b/c"]) {
      const derived = deriveTripleProvenance(url, {});
      expect(typeof derived.pack).toBe("string");
      expect(derived.pack.length).toBeGreaterThan(0);
      expect(MlPageTypeLabels as readonly string[]).toContain(derived.pageType);
    }
  });
});
