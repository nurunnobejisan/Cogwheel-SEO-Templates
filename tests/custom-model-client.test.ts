import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CustomModelConfig,
  DEFAULT_CUSTOM_MODEL_CONFIG,
  getCustomModelConfig,
  saveCustomModelConfig,
  testCustomModelConnection,
  generateSeoAutoFix,
  generateGeoSummary,
} from "../chrome-extension/src/engine/custom-model-client";

describe("Custom Fine-Tuned Model Client & Inference Router", () => {
  beforeEach(async () => {
    // Reset to default config before each test
    await saveCustomModelConfig({ ...DEFAULT_CUSTOM_MODEL_CONFIG });
  });

  describe("Configuration Management", () => {
    it("returns default configuration initially", async () => {
      const config = await getCustomModelConfig();
      expect(config.enabled).toBe(false);
      expect(config.provider).toBe("tuned_gemini");
      expect(config.endpointId).toBe("");
      expect(config.fallbackToDefault).toBe(true);
    });

    it("saves and persists updated configuration", async () => {
      const updated: CustomModelConfig = {
        enabled: true,
        provider: "tuned_gemini",
        endpointId: "tunedModels/hospitality-seo-v1",
        apiKey: "test_gemini_api_key",
        temperature: 0.3,
        maxTokens: 2048,
        fallbackToDefault: true,
      };

      await saveCustomModelConfig(updated);
      const reloaded = await getCustomModelConfig();

      expect(reloaded.enabled).toBe(true);
      expect(reloaded.endpointId).toBe("tunedModels/hospitality-seo-v1");
      expect(reloaded.apiKey).toBe("test_gemini_api_key");
      expect(reloaded.temperature).toBe(0.3);
    });
  });

  describe("Connection Testing", () => {
    it("rejects when endpoint ID is missing", async () => {
      const config: CustomModelConfig = {
        ...DEFAULT_CUSTOM_MODEL_CONFIG,
        endpointId: "",
      };

      const result = await testCustomModelConnection(config);
      expect(result.success).toBe(false);
      expect(result.message).toContain("Endpoint ID or URL is required");
    });

    it("verifies connection to simulated Tuned Gemini endpoint", async () => {
      const config: CustomModelConfig = {
        enabled: true,
        provider: "tuned_gemini",
        endpointId: "tunedModels/hospitality-seo-v1",
        apiKey: "AIzaSy_fake_key",
        temperature: 0.1,
        maxTokens: 64,
        fallbackToDefault: true,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Hospitality SEO model ready." }],
              },
            },
          ],
        }),
      });

      const res = await testCustomModelConnection(config, mockFetch as unknown as typeof fetch);

      expect(res.success).toBe(true);
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res.sampleOutput).toBe("Hospitality SEO model ready.");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain("generativelanguage.googleapis.com");
      expect(calledUrl).toContain("tunedModels/hospitality-seo-v1:generateContent");
    });

    it("verifies connection to simulated custom REST endpoint", async () => {
      const config: CustomModelConfig = {
        enabled: true,
        provider: "custom_rest",
        endpointId: "https://api.myhotelapp.com/v1/generate",
        apiKey: "bearer_secret_123",
        temperature: 0.1,
        maxTokens: 64,
        fallbackToDefault: true,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          text: "Custom REST model operational.",
        }),
      });

      const res = await testCustomModelConnection(config, mockFetch as unknown as typeof fetch);

      expect(res.success).toBe(true);
      expect(res.sampleOutput).toBe("Custom REST model operational.");

      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.headers["Authorization"]).toBe("Bearer bearer_secret_123");
    });

    it("handles remote endpoint HTTP failure gracefully", async () => {
      const config: CustomModelConfig = {
        enabled: true,
        provider: "tuned_gemini",
        endpointId: "tunedModels/invalid-id",
        apiKey: "bad_key",
        temperature: 0.1,
        maxTokens: 64,
        fallbackToDefault: true,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Model not found",
      });

      const res = await testCustomModelConnection(config, mockFetch as unknown as typeof fetch);
      expect(res.success).toBe(false);
      expect(res.message).toContain("HTTP 404");
    });

    it("handles network failure cleanly", async () => {
      const config: CustomModelConfig = {
        enabled: true,
        provider: "custom_rest",
        endpointId: "https://invalid-non-existent-domain.com",
        apiKey: "key",
        temperature: 0.1,
        maxTokens: 64,
        fallbackToDefault: true,
      };

      const mockFetch = vi.fn().mockRejectedValue(new Error("DNS Resolution Failed"));

      const res = await testCustomModelConnection(config, mockFetch as unknown as typeof fetch);
      expect(res.success).toBe(false);
      expect(res.message).toContain("DNS Resolution Failed");
    });
  });

  describe("Auto-Fix Routing & Fallback", () => {
    it("routes to default rules engine when custom model is disabled", async () => {
      await saveCustomModelConfig({
        ...DEFAULT_CUSTOM_MODEL_CONFIG,
        enabled: false,
      });

      const result = await generateSeoAutoFix({
        issueId: "title-len",
        hotelName: "SpringHill Suites Panama City Beachfront",
        brand: "Marriott",
      });

      expect(result.source).toBe("default_rules_engine");
      expect(result.optimalTitle).toBeDefined();
      expect(result.optimalTitle).toContain("Marriott Bonvoy");
    });

    it("routes to custom model when enabled and formats response", async () => {
      await saveCustomModelConfig({
        enabled: true,
        provider: "tuned_gemini",
        endpointId: "tunedModels/hospitality-v1",
        apiKey: "valid_key",
        temperature: 0.2,
        maxTokens: 512,
        fallbackToDefault: true,
      });

      const mockModelPayload = {
        optimizedTitle: "Beachfront Hotel Panama City Beach | SpringHill Suites",
        optimizedMetaDesc: "Book direct for oceanfront suites and lazy river pool.",
        optimizedH1: "SpringHill Suites Panama City Beachfront",
        brandGuardrail: "Marriott",
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockModelPayload) }],
              },
            },
          ],
        }),
      });

      const result = await generateSeoAutoFix(
        {
          issueId: "title-len",
          hotelName: "SpringHill Suites",
          brand: "Marriott",
        },
        mockFetch as unknown as typeof fetch
      );

      expect(result.source).toBe("custom_tuned_model");
      expect(result.optimalTitle).toBe(mockModelPayload.optimizedTitle);
      expect(result.codeSnippet).toContain(mockModelPayload.optimizedTitle);
      expect(result.modelIdentifier).toBe("tunedModels/hospitality-v1");
    });

    it("automatically falls back to default rules engine if custom endpoint fails", async () => {
      await saveCustomModelConfig({
        enabled: true,
        provider: "tuned_gemini",
        endpointId: "tunedModels/failing-endpoint",
        apiKey: "key",
        temperature: 0.2,
        maxTokens: 512,
        fallbackToDefault: true,
      });

      // Simulated failure
      const mockFetch = vi.fn().mockRejectedValue(new Error("Connection Timeout (504)"));

      const result = await generateSeoAutoFix(
        {
          issueId: "meta-len",
          hotelName: "SpringHill Suites Panama City Beachfront",
          brand: "Marriott",
        },
        mockFetch as unknown as typeof fetch
      );

      // Must fall back cleanly to default rules without crashing
      expect(result.source).toBe("default_rules_engine");
      // The rules engine never drafts descriptive copy: no suggestion was
      // produced and no placeholder meta description was invented either.
      expect(result.optimalMeta).toBeUndefined();
      expect(result.codeSnippet).toBe("");
      expect(result.description).toContain("no meta description suggestion was produced");
    });

    it("produces a blank suggestion when there is no property name source", async () => {
      await saveCustomModelConfig({
        ...DEFAULT_CUSTOM_MODEL_CONFIG,
        enabled: false,
      });

      const result = await generateSeoAutoFix({ issueId: "title-len" });

      expect(result.source).toBe("default_rules_engine");
      expect(result.optimalTitle).toBeUndefined();
      expect(result.codeSnippet).toBe("");
      expect(result.description).toContain("no title suggestion was produced");
    });

    it("never falls back to a fabricated property, brand or URL", async () => {
      await saveCustomModelConfig({
        ...DEFAULT_CUSTOM_MODEL_CONFIG,
        enabled: false,
      });

      const result = await generateSeoAutoFix({ issueId: "hotel-schema" });
      expect(result.codeSnippet).toBe("");

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("SpringHill Suites Panama City Beachfront");
      expect(serialized).not.toContain("marriott.com");
      expect(serialized).not.toContain("Beachfront Resort & Spa");
    });
  });

  describe("GEO Summary Generation & Fallback", () => {
    it("generates default GEO summary when custom model is disabled", async () => {
      await saveCustomModelConfig({
        ...DEFAULT_CUSTOM_MODEL_CONFIG,
        enabled: false,
      });

      const res = await generateGeoSummary({
        hotelName: "Seaside Inn",
        brand: "Independent",
        amenities: ["Free WiFi", "Heated pool"],
      });

      expect(res.source).toBe("default_rules_engine");
      // Facts only: the supplied property and the page's amenities.
      expect(res.geoSummary).toContain("Seaside Inn");
      expect(res.geoSummary).toContain("Free WiFi, Heated pool");
      // No invented prose and no invented FAQ answers.
      expect(res.geoSummary).not.toContain("official hospitality destination");
      expect(res.faqSchema).toBeUndefined();
    });

    it("returns an empty GEO summary when there is no property to summarize", async () => {
      await saveCustomModelConfig({
        ...DEFAULT_CUSTOM_MODEL_CONFIG,
        enabled: false,
      });

      const res = await generateGeoSummary({ brand: "Independent" });

      expect(res.source).toBe("default_rules_engine");
      expect(res.geoSummary).toBe("");
      expect(res.faqSchema).toBeUndefined();
    });

    it("generates GEO summary using custom model when enabled", async () => {
      await saveCustomModelConfig({
        enabled: true,
        provider: "tuned_gemini",
        endpointId: "tunedModels/hospitality-geo-v2",
        apiKey: "key",
        temperature: 0.2,
        maxTokens: 512,
        fallbackToDefault: true,
      });

      const mockTunedGeo = {
        geoEntityBlock: "SpringHill Suites Panama City Beachfront is an oceanfront resort featuring 200 beachfront suites on the Gulf of Mexico.",
        faqSchema: {
          "@type": "FAQPage",
          mainEntity: [],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockTunedGeo) }],
              },
            },
          ],
        }),
      });

      const res = await generateGeoSummary(
        {
          hotelName: "SpringHill Suites Panama City Beachfront",
          brand: "Marriott",
        },
        mockFetch as unknown as typeof fetch
      );

      expect(res.source).toBe("custom_tuned_model");
      expect(res.geoSummary).toBe(mockTunedGeo.geoEntityBlock);
      expect(res.modelIdentifier).toBe("tunedModels/hospitality-geo-v2");
    });
  });
});
