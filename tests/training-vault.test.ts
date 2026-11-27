import { describe, it, expect, beforeEach } from "vitest";
import {
  computeCanonicalHash,
  computeDatasetQualityScore,
  saveTrainingPair,
  getTrainingPairByUrl,
  getAllTrainingPairs,
  clearTrainingVault,
  exportVaultAsJsonl,
  RawWebInput,
  TargetOptimizedOutput,
} from "../shared/ts/training-vault";

describe("Training Data Vault (IndexedDB / Local Store)", () => {
  beforeEach(async () => {
    await clearTrainingVault();
  });

  const mockRawInput: RawWebInput = {
    url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/?source=google",
    canonicalUrl: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    domain: "www.marriott.com",
    rawTitle: "Beachfront Hotels Panama City Beach | SpringHill Suites Panama City Beachfront Resort & Spa",
    rawMetaDesc: "Stay beachfront in Panama City Beach suites with lazy river pool access.",
    rawH1: ["SpringHill Suites", "Panama City Beachfront Resort"],
    rawH2: ["Suites & Amenities", "Dining & Beachfront Bar"],
    rawBodyText: "Welcome to our beachfront hotel in Panama City Beach featuring 200 oceanfront suites, lazy river pool, and breakfast.",
    detectedSchemas: ["BreadcrumbList"],
    wordCount: 320,
  };

  const mockTargetOutput: TargetOptimizedOutput = {
    optimizedTitle: "Beachfront Hotel Panama City Beach | SpringHill Suites",
    optimizedMetaDesc: "Book direct at SpringHill Suites Panama City Beach for oceanfront suites, lazy river pool, free hot breakfast, and lowest rates guaranteed on Gulf Coast.",
    optimizedH1: "SpringHill Suites Panama City Beachfront",
    jsonLdSchema: {
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "SpringHill Suites Panama City Beachfront",
      address: {
        "@type": "PostalAddress",
        streetAddress: "14401 Front Beach Rd",
        addressLocality: "Panama City Beach",
        addressRegion: "FL",
        postalCode: "32413",
      },
    },
    geoEntityBlock: "SpringHill Suites Panama City Beachfront is located at 14401 Front Beach Rd, Panama City Beach, FL 32413. The resort features 200 oceanfront suites, an on-site beachfront pool bar, lazy river, and daily complimentary hot breakfast.",
    brandGuardrail: "Marriott",
  };

  describe("Canonical URL Hashing & Deduplication", () => {
    it("generates deterministic hashes regardless of protocol or trailing slashes", async () => {
      const url1 = "https://www.marriott.com/hotel/ecpsb/";
      const url2 = "http://www.marriott.com/hotel/ecpsb";
      const url3 = "HTTPS://WWW.MARRIOTT.COM/hotel/ecpsb///";

      const hash1 = await computeCanonicalHash(url1);
      const hash2 = await computeCanonicalHash(url2);
      const hash3 = await computeCanonicalHash(url3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1.length).toBeGreaterThan(6);
    });

    it("generates distinct hashes for different property canonical URLs", async () => {
      const hashA = await computeCanonicalHash("https://www.marriott.com/hotel/miami/");
      const hashB = await computeCanonicalHash("https://www.hilton.com/hotel/denver/");

      expect(hashA).not.toBe(hashB);
    });
  });

  describe("Dataset Quality Scoring Algorithm", () => {
    it("awards high quality score (>= 85/100) to complete and optimized pairs", () => {
      const { qualityScore, breakdown } = computeDatasetQualityScore(
        mockRawInput,
        mockTargetOutput
      );

      expect(qualityScore).toBeGreaterThanOrEqual(85);
      expect(qualityScore).toBeLessThanOrEqual(100);
      expect(breakdown.completeness).toBe(30);
      expect(breakdown.geoEntityDepth).toBe(20);
      expect(breakdown.schemaValidity).toBe(20);
    });

    it("penalizes thin or incomplete samples appropriately", () => {
      const thinRaw: RawWebInput = {
        url: "https://example.com",
        canonicalUrl: "https://example.com",
        domain: "example.com",
        rawTitle: "",
        rawMetaDesc: "",
        rawH1: [],
        rawH2: [],
        rawBodyText: "Too short",
        detectedSchemas: [],
        wordCount: 10,
      };

      const thinTarget: TargetOptimizedOutput = {
        optimizedTitle: "Short",
        optimizedMetaDesc: "Short",
        optimizedH1: "",
        jsonLdSchema: {},
        geoEntityBlock: "",
        brandGuardrail: "Independent",
      };

      const { qualityScore } = computeDatasetQualityScore(thinRaw, thinTarget);
      expect(qualityScore).toBeLessThan(40);
    });
  });

  describe("Persistent Vault Storage & Querying", () => {
    it("saves a training pair and retrieves it by canonical URL", async () => {
      const saved = await saveTrainingPair({
        rawInput: mockRawInput,
        targetOutput: mockTargetOutput,
        brand: "Marriott",
      });

      expect(saved.id).toBeDefined();
      expect(saved.qualityScore).toBeGreaterThanOrEqual(85);
      expect(saved.brand).toBe("Marriott");

      const retrieved = await getTrainingPairByUrl(mockRawInput.canonicalUrl);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(saved.id);
      expect(retrieved?.rawInput.rawTitle).toBe(mockRawInput.rawTitle);
      expect(retrieved?.targetOutput.optimizedTitle).toBe(mockTargetOutput.optimizedTitle);
    });

    it("deduplicates records with identical canonical URLs by updating in place", async () => {
      // Save initial record
      await saveTrainingPair({
        rawInput: mockRawInput,
        targetOutput: mockTargetOutput,
        brand: "Marriott",
      });

      const countBefore = (await getAllTrainingPairs()).length;
      expect(countBefore).toBe(1);

      // Save updated record for same canonical URL
      const updatedTarget = {
        ...mockTargetOutput,
        optimizedTitle: "SpringHill Suites Panama City Beachfront | Official Site",
      };

      await saveTrainingPair({
        rawInput: mockRawInput,
        targetOutput: updatedTarget,
        brand: "Marriott",
      });

      const allRecords = await getAllTrainingPairs();
      expect(allRecords.length).toBe(1); // Deduplicated
      expect(allRecords[0].targetOutput.optimizedTitle).toBe(updatedTarget.optimizedTitle);
    });

    it("exports vault records in clean JSONL fine-tuning format", async () => {
      await saveTrainingPair({
        rawInput: mockRawInput,
        targetOutput: mockTargetOutput,
        brand: "Marriott",
      });

      const jsonl = await exportVaultAsJsonl();
      expect(jsonl).toContain('"messages":');
      expect(jsonl).toContain('"role":"system"');
      expect(jsonl).toContain('"role":"user"');
      expect(jsonl).toContain('"role":"assistant"');

      // Verify each line is valid JSON
      const lines = jsonl.trim().split("\n");
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.metadata.canonicalUrl).toBe(mockRawInput.canonicalUrl);
      expect(parsed.metadata.brand).toBe("Marriott");
    });
  });
});
