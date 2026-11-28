/**
 * Extension model-inference proxy guard (v2 WP8, decision D-037).
 *
 * The extension never calls a model endpoint directly: every tuned inference
 * goes through the SEO Studio backend. These tests pin the origin guard, the
 * proxy client's fail-soft behaviour, and the guarantee that no model
 * endpoint URL or model API key is ever dialed from the extension.
 */

import { describe, expect, it, vi } from "vitest";

import {
  inferViaAppBackend,
  isAllowedProxyOrigin,
  resolveProxyOrigin,
} from "../chrome-extension/src/engine/model-proxy";
import {
  DEFAULT_CUSTOM_MODEL_CONFIG,
  generateSeoAutoFix,
  saveCustomModelConfig,
} from "../chrome-extension/src/engine/custom-model-client";

describe("isAllowedProxyOrigin", () => {
  it("accepts https origins", () => {
    expect(isAllowedProxyOrigin("https://seo-studio-one.vercel.app")).toBe(true);
    expect(isAllowedProxyOrigin("https://app.example.com")).toBe(true);
  });

  it("accepts plain http only for loopback dev origins", () => {
    expect(isAllowedProxyOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedProxyOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isAllowedProxyOrigin("http://app.example.com")).toBe(false);
    expect(isAllowedProxyOrigin("http://10.0.0.1")).toBe(false);
  });

  it("refuses userinfo, garbage and empty origins", () => {
    expect(isAllowedProxyOrigin("https://user:pass@app.example.com")).toBe(false);
    expect(isAllowedProxyOrigin("not a url")).toBe(false);
    expect(isAllowedProxyOrigin("")).toBe(false);
    expect(isAllowedProxyOrigin("ftp://app.example.com")).toBe(false);
  });

  it("refuses private and link-local raw-IP hosts", () => {
    expect(isAllowedProxyOrigin("https://192.168.1.10")).toBe(false);
    expect(isAllowedProxyOrigin("https://10.1.2.3")).toBe(false);
    expect(isAllowedProxyOrigin("https://172.16.0.9")).toBe(false);
    expect(isAllowedProxyOrigin("https://169.254.1.1")).toBe(false);
    // Loopback is the one raw-IP exception: local dev backends are allowed on
    // either scheme (the token still gates every call).
    expect(isAllowedProxyOrigin("https://127.0.0.1")).toBe(true);
  });
});

describe("resolveProxyOrigin", () => {
  it("derives the origin from a configured API URL that includes a path", () => {
    expect(resolveProxyOrigin("https://seo-studio-one.vercel.app/api/ai-training")).toBe(
      "https://seo-studio-one.vercel.app",
    );
  });

  it("returns null for empty, unsafe or unparseable values", () => {
    expect(resolveProxyOrigin("")).toBeNull();
    expect(resolveProxyOrigin("http://intranet.local/api")).toBeNull();
    expect(resolveProxyOrigin("https://192.168.0.5/api/ai-training")).toBeNull();
  });
});

describe("inferViaAppBackend", () => {
  const options = { apiUrl: "https://app.example.com", apiToken: "tok" };

  it("POSTs the task and prompt to /api/extension/infer with the bearer token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, output: "gated output", source: "adapter" }),
    });
    const result = await inferViaAppBackend(
      { task: "metadata_generation", prompt: "hello" },
      options,
      mockFetch as unknown as typeof fetch,
    );
    expect(result).toEqual({ ok: true, output: "gated output", source: "adapter", latencyMs: expect.any(Number) });
    expect(mockFetch.mock.calls[0][0]).toBe("https://app.example.com/api/extension/infer");
    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toMatchObject({ task: "metadata_generation", prompt: "hello" });
  });

  it("fails soft on HTTP errors, bad payloads and network failures", async () => {
    const httpFail = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    expect(await inferViaAppBackend({ task: "metadata_generation", prompt: "p" }, options, httpFail as unknown as typeof fetch))
      .toMatchObject({ ok: false });

    const badPayload = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, reason: "inference unavailable" }),
    });
    expect(await inferViaAppBackend({ task: "metadata_generation", prompt: "p" }, options, badPayload as unknown as typeof fetch))
      .toMatchObject({ ok: false });

    const networkFail = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await inferViaAppBackend({ task: "metadata_generation", prompt: "p" }, options, networkFail as unknown as typeof fetch))
      .toMatchObject({ ok: false, reason: expect.stringContaining("boom") });
  });

  it("refuses to dial an origin the guard rejects", async () => {
    const mockFetch = vi.fn();
    const result = await inferViaAppBackend(
      { task: "metadata_generation", prompt: "p" },
      { apiUrl: "http://192.168.1.5:8000", apiToken: "tok" },
      mockFetch as unknown as typeof fetch,
    );
    expect(result).toMatchObject({ ok: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refuses when no token is configured", async () => {
    const mockFetch = vi.fn();
    const result = await inferViaAppBackend(
      { task: "metadata_generation", prompt: "p" },
      { apiUrl: "https://app.example.com", apiToken: "  " },
      mockFetch as unknown as typeof fetch,
    );
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("token") });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("extension never dials a model endpoint directly", () => {
  it("falls back to the rules engine even with a legacy direct endpoint configured", async () => {
    await saveCustomModelConfig({
      ...DEFAULT_CUSTOM_MODEL_CONFIG,
      enabled: true,
      endpointId: "https://attacker.example.com/v1/generate",
      apiKey: "model-secret-key",
    });
    const mockFetch = vi.fn();

    const result = await generateSeoAutoFix(
      { issueId: "title-len", hotelName: "Seaside Inn", brand: "Independent" },
      mockFetch as unknown as typeof fetch,
    );

    // No extension options in this environment -> no API token -> proxy
    // refuses; the rules engine answers. Nothing was dialed at all, so the
    // legacy endpointId/apiKey can never leak.
    expect(result.source).toBe("default_rules_engine");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
