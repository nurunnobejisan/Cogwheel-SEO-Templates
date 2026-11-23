import { describe, it, expect, vi } from "vitest";
import {
  formatSystemPrompt,
  formatUserPrompt,
  formatModelResponse,
  recordToGemini,
  recordToChatMl,
  filterRecords,
  buildGeminiJsonl,
  buildChatMlJsonl,
  estimateTokenCount,
  syncRecordToApi,
  syncBatchToApi,
  ApiSyncConfig,
} from "../src/engine/dataset-builder";
import { TrainingPairRecord } from "../src/storage/training-vault";

describe("Dataset Builder & Supervised Fine-Tuning Exporter", () => {
  const sampleRecord: TrainingPairRecord = {
    id: "sample_hotel_hash_123",
    schemaVersion: "3.0.0",
    canonicalUrlHash: "sample_hotel_hash_123",
    contentHash: "ch_sample123",
    version: 1,
    source: "manual",
    pageType: "hotel_homepage",
    extractionConfidence: 95,
    canonicalUrl: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    domain: "www.marriott.com",
    brand: "Marriott",
    status: "approved",
    qualityScore: 95,
    scoreBreakdown: {
      completeness: 30,
      optimizationDelta: 30,
      geoEntityDepth: 20,
      schemaValidity: 15,
    },
    rawInput: {
      url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/?source=ad",
      canonicalUrl: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
      domain: "www.marriott.com",
      rawTitle: "Beachfront Hotels Panama City Beach | SpringHill Suites Panama City Beachfront Resort & Spa",
      rawMetaDesc: "Stay beachfront in Panama City Beach suites with lazy river pool access.",
      rawH1: ["SpringHill Suites", "Panama City Beachfront Resort"],
      rawH2: ["Oceanfront Suites", "Dining & Beachfront Bar"],
      rawBodyText: "Welcome to our beachfront resort featuring luxury suites, an outdoor lazy river pool, and complimentary hot breakfast.",
      detectedSchemas: ["BreadcrumbList"],
      wordCount: 320,
    },
    targetOutput: {
      optimizedTitle: "Beachfront Hotel Panama City Beach | SpringHill Suites",
      optimizedMetaDesc: "Book direct at SpringHill Suites Panama City Beach for oceanfront suites, lazy river pool, free hot breakfast, and lowest rates guaranteed on Gulf Coast.",
      optimizedH1: "SpringHill Suites Panama City Beachfront",
      jsonLdSchema: {
        "@context": "https://schema.org",
        "@type": "Hotel",
        name: "SpringHill Suites Panama City Beachfront",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Panama City Beach",
          addressRegion: "FL",
        },
      },
      geoEntityBlock: "SpringHill Suites Panama City Beachfront is an oceanfront resort located in Panama City Beach, FL featuring 200 beachfront suites, lazy river, and daily breakfast.",
      brandGuardrail: "Marriott",
    },
    createdAt: "2026-11-23T10:00:00.000Z",
    updatedAt: "2026-11-23T10:00:00.000Z",
  };

  const pendingRecord: TrainingPairRecord = {
    ...sampleRecord,
    id: "sample_pending_hash_456",
    canonicalUrlHash: "sample_pending_hash_456",
    canonicalUrl: "https://www.hilton.com/hotel/denver-downtown/",
    domain: "www.hilton.com",
    brand: "Hilton",
    status: "pending",
    qualityScore: 68,
  };

  const rejectedRecord: TrainingPairRecord = {
    ...sampleRecord,
    id: "sample_rejected_hash_789",
    canonicalUrlHash: "sample_rejected_hash_789",
    canonicalUrl: "https://www.ihg.com/hotel/atlanta/",
    domain: "www.ihg.com",
    brand: "IHG",
    status: "rejected",
    qualityScore: 50,
  };

  describe("Google Gemini Supervised Fine-Tuning Format (.jsonl)", () => {
    it("converts record to valid Gemini schema with systemInstruction and user/model contents", () => {
      const geminiRecord = recordToGemini(sampleRecord);

      // Verify systemInstruction
      expect(geminiRecord.systemInstruction).toBeDefined();
      expect(geminiRecord.systemInstruction.parts).toHaveLength(1);
      expect(geminiRecord.systemInstruction.parts[0].text).toContain("Marriott franchise brand standards");

      // Verify contents
      expect(geminiRecord.contents).toHaveLength(2);
      expect(geminiRecord.contents[0].role).toBe("user");
      expect(geminiRecord.contents[0].parts[0].text).toContain("Optimize the following hotel webpage:");
      expect(geminiRecord.contents[0].parts[0].text).toContain(sampleRecord.canonicalUrl);

      expect(geminiRecord.contents[1].role).toBe("model");
      const modelPayload = JSON.parse(geminiRecord.contents[1].parts[0].text);
      expect(modelPayload.optimizedTitle).toBe(sampleRecord.targetOutput.optimizedTitle);
      expect(modelPayload.brandGuardrail).toBe("Marriott");
    });

    it("builds valid line-delimited JSONL with filtering", () => {
      const records = [sampleRecord, pendingRecord, rejectedRecord];

      // Export only approved
      const approvedOnlyJsonl = buildGeminiJsonl(records, { onlyApproved: true });
      const approvedLines = approvedOnlyJsonl.trim().split("\n");
      expect(approvedLines).toHaveLength(1);

      const parsed = JSON.parse(approvedLines[0]);
      expect(parsed.systemInstruction).toBeDefined();
      expect(parsed.contents).toHaveLength(2);

      // Export all records
      const allJsonl = buildGeminiJsonl(records, { onlyApproved: false });
      const allLines = allJsonl.trim().split("\n");
      expect(allLines).toHaveLength(3);
    });
  });

  describe("OpenAI / Llama / Unsloth ChatML Format (.jsonl)", () => {
    it("converts record to valid ChatML format with system, user, and assistant messages", () => {
      const chatMlRecord = recordToChatMl(sampleRecord, true);

      expect(chatMlRecord.messages).toHaveLength(3);
      expect(chatMlRecord.messages[0].role).toBe("system");
      expect(chatMlRecord.messages[0].content).toContain("hospitality SEO and Generative Engine Optimization");

      expect(chatMlRecord.messages[1].role).toBe("user");
      expect(chatMlRecord.messages[1].content).toContain(sampleRecord.rawInput.rawTitle);

      expect(chatMlRecord.messages[2].role).toBe("assistant");
      const assistantJson = JSON.parse(chatMlRecord.messages[2].content);
      expect(assistantJson.optimizedTitle).toBe(sampleRecord.targetOutput.optimizedTitle);

      expect(chatMlRecord.metadata?.canonicalUrl).toBe(sampleRecord.canonicalUrl);
      expect(chatMlRecord.metadata?.qualityScore).toBe(95);
    });

    it("builds valid line-delimited ChatML JSONL with quality score threshold", () => {
      const records = [sampleRecord, pendingRecord, rejectedRecord];

      // Filter by min quality score 70
      const filteredJsonl = buildChatMlJsonl(records, { minQualityScore: 70 });
      const lines = filteredJsonl.trim().split("\n");
      expect(lines).toHaveLength(1); // Only sampleRecord has score >= 70

      const parsed = JSON.parse(lines[0]);
      expect(parsed.messages).toHaveLength(3);
      expect(parsed.messages[0].role).toBe("system");
    });
  });

  describe("Dataset Filtering & Token Estimation", () => {
    it("filters records by brand correctly", () => {
      const records = [sampleRecord, pendingRecord, rejectedRecord];
      const hiltonOnly = filterRecords(records, { brandFilter: "Hilton" });
      expect(hiltonOnly).toHaveLength(1);
      expect(hiltonOnly[0].brand).toBe("Hilton");
    });

    it("estimates token count proportionally to character length", () => {
      const text = "A".repeat(400);
      const tokens = estimateTokenCount(text);
      expect(tokens).toBe(100);
    });
  });

  describe("Direct App API Sync", () => {
    it("returns error if endpoint URL is not provided", async () => {
      const config: ApiSyncConfig = {
        endpointUrl: "",
        bearerToken: "test_token",
      };

      const result = await syncRecordToApi(sampleRecord, config);
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain("Webhook endpoint URL is not configured");
    });

    it("successfully sends authenticated POST request with Bearer token", async () => {
      const config: ApiSyncConfig = {
        endpointUrl: "https://api.myhotelapp.com/v1/training-pairs",
        bearerToken: "cgw_secret_test_123",
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ id: "server_id_1" }),
      });

      const result = await syncRecordToApi(sampleRecord, config, mockFetch as unknown as typeof fetch);

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe(config.endpointUrl);
      expect(calledInit.method).toBe("POST");
      expect(calledInit.headers["Authorization"]).toBe("Bearer cgw_secret_test_123");
      expect(calledInit.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(calledInit.body);
      expect(body.event).toBe("training_pair_sync");
      expect(body.record.canonicalUrl).toBe(sampleRecord.canonicalUrl);
      expect(body.exportFormats.gemini).toBeDefined();
      expect(body.exportFormats.chatMl).toBeDefined();
    });

    it("handles HTTP error response properly", async () => {
      const config: ApiSyncConfig = {
        endpointUrl: "https://api.myhotelapp.com/v1/training-pairs",
        bearerToken: "invalid_token",
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized: Invalid Bearer token",
      });

      const result = await syncRecordToApi(sampleRecord, config, mockFetch as unknown as typeof fetch);

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      expect(result.message).toContain("Failed to sync record (HTTP 401)");
    });

    it("performs batch synchronization across multiple records", async () => {
      const config: ApiSyncConfig = {
        endpointUrl: "https://api.myhotelapp.com/v1/batch-sync",
        bearerToken: "token_abc",
      };

      const mockFetch = vi.fn().mockImplementation((_url, init) => {
        const body = JSON.parse(init.body);
        if (body.record.brand === "IHG") {
          return Promise.resolve({
            ok: false,
            status: 422,
            text: async () => "Validation error: Score too low",
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => "OK",
        });
      });

      const records = [sampleRecord, pendingRecord, rejectedRecord];
      const summary = await syncBatchToApi(records, config, mockFetch as unknown as typeof fetch);

      expect(summary.total).toBe(3);
      expect(summary.successful).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.errors).toHaveLength(1);
      expect(summary.errors[0]).toContain("Validation error");
    });
  });
});
