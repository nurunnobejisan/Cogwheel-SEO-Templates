/**
 * Phase 4 — the SEO Studio fine-tuned model (`CUSTOM_MODEL_*`).
 *
 * Covers the settings reader, the fail-closed SSRF guard, the OpenAI-shaped
 * call, first-attempt ordering in `generateClaudeText` with fall-through on
 * failure, and router precedence for the `seo-studio-tuned` provider.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CustomModelError,
  callCustomModel,
  getCustomModelSettings,
  isCustomModelConfigured,
} from "../src/core/ai/custom-model.ts";
import {
  getActiveAiProviderLabel,
  isClaudeConfigured,
  generateClaudeText,
} from "../src/core/claude.ts";
import { loadProviders, routeTask } from "../ai/router.ts";
import type { ProviderDescriptor } from "../ai/types.ts";

const SAFE_ENDPOINT = "https://example.com/v1/chat/completions";
const PRIVATE_ENDPOINT = "http://127.0.0.1:8000/v1/chat/completions";

const MANAGED_KEYS = [
  "CUSTOM_MODEL_ENDPOINT",
  "CUSTOM_MODEL_ID",
  "CUSTOM_MODEL_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "ENABLE_FREE_ONLINE_AI",
] as const;

let savedEnv: Record<string, string | undefined> = {};

function setEnv(entries: Record<string, string | undefined>): void {
  for (const key of MANAGED_KEYS) {
    if (!(key in entries)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv = {};
});

function snapshotEnv(): void {
  savedEnv = Object.fromEntries(MANAGED_KEYS.map((key) => [key, process.env[key]]));
}

describe("Phase 4 — custom model settings", () => {
  it("reads CUSTOM_MODEL_* with the de-branded default model id", () => {
    snapshotEnv();
    setEnv({ CUSTOM_MODEL_ENDPOINT: " https://models.example.com/v1/chat/completions " });
    const settings = getCustomModelSettings();
    expect(settings.endpoint).toBe("https://models.example.com/v1/chat/completions");
    expect(settings.model).toBe("seo-studio-unified");
    expect(settings.apiKey).toBeUndefined();

    setEnv({ CUSTOM_MODEL_ID: "seo-studio-tuned-v1", CUSTOM_MODEL_API_KEY: "k" });
    expect(getCustomModelSettings().model).toBe("seo-studio-tuned-v1");
    expect(getCustomModelSettings().apiKey).toBe("k");
  });

  it("is unconfigured when unset, and fail-closed on an unsafe endpoint", () => {
    snapshotEnv();
    setEnv({});
    expect(isCustomModelConfigured()).toBe(false);

    setEnv({ CUSTOM_MODEL_ENDPOINT: PRIVATE_ENDPOINT });
    expect(isCustomModelConfigured()).toBe(false);

    setEnv({ CUSTOM_MODEL_ENDPOINT: "ftp://models.example.com/x" });
    expect(isCustomModelConfigured()).toBe(false);

    setEnv({ CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT });
    expect(isCustomModelConfigured()).toBe(true);
  });
});

describe("Phase 4 — callCustomModel", () => {
  it("POSTs an OpenAI-shaped body and returns the assistant content", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "TUNED OUTPUT" } }] }),
    );
    const text = await callCustomModel({
      system: "system prompt",
      prompt: "user prompt",
      maxTokens: 512,
      env: { CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT, CUSTOM_MODEL_API_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(text).toBe("TUNED OUTPUT");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SAFE_ENDPOINT);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("seo-studio-unified");
    expect(body.max_tokens).toBe(512);
    expect(body.messages).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "user prompt" },
    ]);
  });

  it("throws CustomModelError on HTTP errors and empty responses", async () => {
    await expect(
      callCustomModel({
        system: "s",
        prompt: "p",
        maxTokens: 16,
        env: { CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT },
        fetchImpl: (async () => jsonResponse({}, 503)) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(CustomModelError);

    await expect(
      callCustomModel({
        system: "s",
        prompt: "p",
        maxTokens: 16,
        env: { CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT },
        fetchImpl: (async () => jsonResponse({ choices: [] })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/no assistant content/);
  });

  it("never calls the network for an unsafe endpoint or when unset", async () => {
    const fetchImpl = vi.fn();
    await expect(
      callCustomModel({
        system: "s",
        prompt: "p",
        maxTokens: 16,
        env: { CUSTOM_MODEL_ENDPOINT: PRIVATE_ENDPOINT },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/SSRF guard/);

    await expect(
      callCustomModel({
        system: "s",
        prompt: "p",
        maxTokens: 16,
        env: {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/not set/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Phase 4 — generateClaudeText ordering", () => {
  it("tries the fine-tuned endpoint first when configured", async () => {
    snapshotEnv();
    setEnv({ CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT, CUSTOM_MODEL_ID: "seo-studio-tuned-v1" });
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      jsonResponse({ choices: [{ message: { content: "from the tuned model" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await generateClaudeText({ system: "sys", prompt: "q" });
    expect(text).toBe("from the tuned model");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(SAFE_ENDPOINT);
  });

  it("falls through to the error path when the tuned endpoint fails", async () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      ENABLE_FREE_ONLINE_AI: "false",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "busy" }, 500)),
    );

    await expect(generateClaudeText({ system: "sys", prompt: "q" })).rejects.toThrow(
      /Fine-tuned \(seo-studio-unified\)/,
    );
  });

  it("does not touch the network when the endpoint fails the guard", async () => {
    snapshotEnv();
    setEnv({ CUSTOM_MODEL_ENDPOINT: PRIVATE_ENDPOINT, ENABLE_FREE_ONLINE_AI: "false" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateClaudeText({ system: "sys", prompt: "q" })).rejects.toThrow(
      /All online AI providers failed/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the tuned provider in the label and configured check", () => {
    snapshotEnv();
    setEnv({ CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT, CUSTOM_MODEL_ID: "seo-studio-tuned-v1" });
    expect(getActiveAiProviderLabel()).toBe("SEO Studio fine-tuned (seo-studio-tuned-v1)");
    expect(isClaudeConfigured()).toBe(true);

    setEnv({ CUSTOM_MODEL_ENDPOINT: PRIVATE_ENDPOINT });
    expect(getActiveAiProviderLabel()).not.toContain("fine-tuned");
    expect(isClaudeConfigured()).toBe(false);
  });
});

describe("Phase 4 — router precedence", () => {
  const tuned: ProviderDescriptor = {
    id: "seo-studio-tuned",
    label: "SEO Studio fine-tuned model",
    tier: "tier1",
    model: "seo-studio-unified",
    configured: true,
  };
  const gemini: ProviderDescriptor = {
    id: "gemini",
    label: "Gemini",
    tier: "tier1",
    model: "gemini-2.0-flash",
    configured: true,
  };
  const claude: ProviderDescriptor = {
    id: "claude",
    label: "Claude",
    tier: "tier2",
    model: "claude-sonnet-4-5",
    configured: true,
  };

  it("prefers the fine-tuned model for its tier when configured", () => {
    const decision = routeTask("metadata_generation", [claude, gemini, tuned]);
    expect(decision.provider?.id).toBe("seo-studio-tuned");
    expect(decision.rationale).toMatch(/fine-tuned SEO Studio model is configured/);
    expect(decision.fallback.map((p) => p.id)).toContain("gemini");
  });

  it("leaves tier2 tasks on the frontier provider", () => {
    const decision = routeTask("rag_synthesis", [claude, gemini, tuned]);
    expect(decision.provider?.id).toBe("claude");
  });

  it("ignores the fine-tuned provider when it is not configured", () => {
    const unconfigured = { ...tuned, configured: false };
    const decision = routeTask("metadata_generation", [gemini, unconfigured]);
    expect(decision.provider?.id).toBe("gemini");
  });

  it("marks seo-studio-tuned configured only for a guard-passing endpoint", () => {
    const configured = loadProviders({
      NODE_ENV: "test",
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
    }).find((p) => p.id === "seo-studio-tuned");
    expect(configured?.configured).toBe(true);

    const guarded = loadProviders({
      NODE_ENV: "test",
      CUSTOM_MODEL_ENDPOINT: PRIVATE_ENDPOINT,
    }).find((p) => p.id === "seo-studio-tuned");
    expect(guarded?.configured).toBe(false);
  });
});
