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
  isRegistryModelSelectable,
} from "../src/core/ai/custom-model.ts";
import {
  computeCanaryBucket,
  getActiveAiProviderLabel,
  getAdapterCanaryPct,
  getAdapterGateCounters,
  getAdapterLatencyStats,
  getAdapterMode,
  isClaudeConfigured,
  generateClaudeText,
  resetAdapterGateCounters,
  shouldRouteCanary,
  V1_ADAPTER_TASKS,
} from "../src/core/claude.ts";
import { loadProviders, routeTask, V1_ADAPTER_TASKS as ROUTER_V1_TASKS } from "../ai/router.ts";
import type { ProviderDescriptor } from "../ai/types.ts";

// v2 WP3 (D-036): adapter eligibility is measured registry scope. These tests
// grant a measured `readyTasks` scope explicitly; null falls back to the real
// (fail-closed) registry read — today that is "no task".
const adapterScope = vi.hoisted(() => ({ tasks: null as string[] | null }));

vi.mock("../src/core/ai/custom-model.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/core/ai/custom-model.ts")>();
  return {
    ...actual,
    isAdapterTaskReady: (task: string | undefined | null) =>
      adapterScope.tasks !== null
        ? adapterScope.tasks.includes(task ?? "")
        : actual.isAdapterTaskReady(task),
    getAdapterReadyTasks: () => (adapterScope.tasks !== null ? adapterScope.tasks : actual.getAdapterReadyTasks()),
  };
});

// Shadow mode records review-queue rows on the filesystem; keep tests pure.
vi.mock("@/lib/review/shadow-recorder", () => ({
  recordShadowDisagreement: vi.fn(async () => null),
}));

const SAFE_ENDPOINT = "https://example.com/v1/chat/completions";
const PRIVATE_ENDPOINT = "http://127.0.0.1:8000/v1/chat/completions";

const MANAGED_KEYS = [
  "CUSTOM_MODEL_ENDPOINT",
  "CUSTOM_MODEL_ID",
  "CUSTOM_MODEL_API_KEY",
  "AI_ADAPTER_MODE",
  "AI_ADAPTER_CANARY_PCT",
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
  adapterScope.tasks = null;
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

describe("Phase 4 / WP2 — generateClaudeText task routing", () => {
  it("exports V1_ADAPTER_TASKS scoped strictly to schema_generation and metadata_generation", () => {
    expect(V1_ADAPTER_TASKS).toEqual(["schema_generation", "metadata_generation"]);
    expect(ROUTER_V1_TASKS).toEqual(["schema_generation", "metadata_generation"]);
  });

  it("skips the custom adapter for untagged calls and falls back to the main provider chain", async () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      GROQ_API_KEY: "groq-test-key",
    });
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      jsonResponse({ choices: [{ message: { content: "from groq chain" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await generateClaudeText({ system: "sys", prompt: "q" });
    expect(text).toBe("from groq chain");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.groq.com");
  });

  it("uses the custom adapter first for v1 Tier 1 tasks when AI_ADAPTER_MODE=on", async () => {
    adapterScope.tasks = ["schema_generation", "metadata_generation"];
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      AI_ADAPTER_MODE: "on",
    });
    const schemaReply = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "Tuned Hotel",
    });
    const metaReply = JSON.stringify({
      title: "Tuned Hotel — Boutique Stay",
      metaDescription: "Book direct at Tuned Hotel for waterfront suites, dining, and flexible member rates.",
    });
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      void url;
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ content?: string }> };
      const userPrompt = body.messages?.[1]?.content ?? "";
      const content = userPrompt.includes("schema_req") ? schemaReply : metaReply;
      return jsonResponse({ choices: [{ message: { content } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const schemaText = await generateClaudeText({
      system: "sys",
      prompt: "schema_req for Tuned Hotel",
      task: "schema_generation",
    });
    expect(schemaText).toBe(schemaReply);

    const metaText = await generateClaudeText({
      system: "sys",
      prompt: "meta_req for Tuned Hotel",
      task: "metadata_generation",
    });
    expect(metaText).toBe(metaReply);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(SAFE_ENDPOINT);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(SAFE_ENDPOINT);
  });

  it("never calls the custom adapter for Tier 2 or non-v1 Tier 1 tasks", async () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      AI_ADAPTER_MODE: "on",
      GROQ_API_KEY: "groq-test-key",
    });
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      jsonResponse({ choices: [{ message: { content: "standard chain output" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const task of ["rag_synthesis", "entity_gap_analysis", "alt_text_generation"] as const) {
      await generateClaudeText({ system: "sys", prompt: "q", task });
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toBe(SAFE_ENDPOINT);
      expect(String(call[0])).toContain("api.groq.com");
    }
  });

  it("falls through to the error path when a v1 task fails on the tuned endpoint", async () => {
    adapterScope.tasks = ["schema_generation"];
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      AI_ADAPTER_MODE: "on",
      ENABLE_FREE_ONLINE_AI: "false",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "busy" }, 500)),
    );

    await expect(
      generateClaudeText({ system: "sys", prompt: "q", task: "schema_generation" }),
    ).rejects.toThrow(/Fine-tuned \(seo-studio-unified\)/);
  });

  it("does not touch the network when the endpoint fails the guard", async () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: PRIVATE_ENDPOINT,
      AI_ADAPTER_MODE: "on",
      ENABLE_FREE_ONLINE_AI: "false",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateClaudeText({ system: "sys", prompt: "q", task: "schema_generation" }),
    ).rejects.toThrow(/All online AI providers failed/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the tuned provider in the label and configured check only when rollout mode serves traffic", () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      AI_ADAPTER_MODE: "on",
    });
    expect(getActiveAiProviderLabel()).toBe("SEO Studio fine-tuned (seo-studio-tuned-v1)");
    expect(isClaudeConfigured()).toBe(true);

    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      AI_ADAPTER_MODE: "shadow",
    });
    expect(getActiveAiProviderLabel()).toBe("Not Configured");
    expect(isClaudeConfigured()).toBe(false);

    setEnv({ CUSTOM_MODEL_ENDPOINT: PRIVATE_ENDPOINT, AI_ADAPTER_MODE: "on" });
    expect(getActiveAiProviderLabel()).not.toContain("fine-tuned");
    expect(isClaudeConfigured()).toBe(false);
  });

  it("refuses retired Gemini 1.5 Flash and any non-ready registry entries (WP4)", async () => {
    snapshotEnv();
    expect(isRegistryModelSelectable("seo-studio-unified-tuned_gemini-v1795487332")).toBe(false);
    expect(isRegistryModelSelectable("seo-studio-unified-tuned_gemini-v1795486557")).toBe(false);
    expect(isRegistryModelSelectable("gemini-1.5-flash-002")).toBe(false);
    expect(
      isRegistryModelSelectable("seo-studio-unverified", {
        activeModelId: null,
        models: [{ modelId: "seo-studio-unverified", status: "unverified" }],
      }),
    ).toBe(false);
    expect(
      isRegistryModelSelectable("seo-studio-qwen-ready", {
        activeModelId: "seo-studio-qwen-ready",
        models: [{ modelId: "seo-studio-qwen-ready", status: "ready" }],
      }),
    ).toBe(true);

    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-unified-tuned_gemini-v1795487332",
    });
    expect(isCustomModelConfigured()).toBe(false);

    await expect(
      callCustomModel({
        system: "s",
        prompt: "p",
        maxTokens: 64,
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/retired or not ready/i);
  });
});

describe("WP5 — AI_ADAPTER_MODE rollout modes", () => {
  afterEach(() => {
    resetAdapterGateCounters();
  });

  const validSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: "Canary Hotel",
  });

  it("parses AI_ADAPTER_MODE defaulting safely to off and clamps AI_ADAPTER_CANARY_PCT", () => {
    expect(getAdapterMode({})).toBe("off");
    expect(getAdapterMode({ AI_ADAPTER_MODE: "SHADOW" })).toBe("shadow");
    expect(getAdapterMode({ AI_ADAPTER_MODE: "canary" })).toBe("canary");
    expect(getAdapterMode({ AI_ADAPTER_MODE: "on" })).toBe("on");
    expect(getAdapterMode({ AI_ADAPTER_MODE: "invalid-mode" })).toBe("off");

    expect(getAdapterCanaryPct({})).toBe(0);
    expect(getAdapterCanaryPct({ AI_ADAPTER_CANARY_PCT: "-5" })).toBe(0);
    expect(getAdapterCanaryPct({ AI_ADAPTER_CANARY_PCT: "25" })).toBe(25);
    expect(getAdapterCanaryPct({ AI_ADAPTER_CANARY_PCT: "250" })).toBe(100);
    expect(getAdapterCanaryPct({ AI_ADAPTER_CANARY_PCT: "abc" })).toBe(0);
  });

  it("skips the custom adapter when AI_ADAPTER_MODE is off or unset", async () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      GROQ_API_KEY: "groq-test-key",
    });
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      jsonResponse({ choices: [{ message: { content: "from standard chain" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await generateClaudeText({
      system: "sys",
      prompt: "q",
      task: "schema_generation",
    });
    expect(out).toBe("from standard chain");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.groq.com");
  });

  it("runs concurrently in shadow mode, always returns standard output, and records latency + gate counters without logging content", async () => {
    adapterScope.tasks = ["schema_generation"];
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      AI_ADAPTER_MODE: "shadow",
      GROQ_API_KEY: "groq-test-key",
    });

    const adapterOut = '{"@context":"https://schema.org","@type":"InvalidShadowType"}';
    const standardOut = validSchema;

    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url) === SAFE_ENDPOINT) {
        return jsonResponse({ choices: [{ message: { content: adapterOut } }] });
      }
      return jsonResponse({ choices: [{ message: { content: standardOut } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await generateClaudeText({
      system: "sys",
      prompt: "SHADOW_SECRET_PROMPT Hotel",
      task: "schema_generation",
      propertyId: "prop-shadow-1",
    });

    expect(out).toBe(standardOut);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(SAFE_ENDPOINT);
    expect(urls.some((u) => u.includes("api.groq.com"))).toBe(true);

    const counters = getAdapterGateCounters();
    expect(counters["schema_generation|shadow|adapter:fail"]).toBe(1);
    expect(counters["schema_generation|shadow|standard:pass"]).toBe(1);

    const latencies = getAdapterLatencyStats();
    expect(latencies["schema_generation|shadow|adapter"]?.count).toBe(1);
    expect(latencies["schema_generation|shadow|standard"]?.count).toBe(1);

    const allLogs = [...logSpy.mock.calls.flat(), ...warnSpy.mock.calls.flat(), ...errSpy.mock.calls.flat()].join(" ");
    expect(allLogs).not.toContain("SHADOW_SECRET_PROMPT");
    expect(allLogs).not.toContain("InvalidShadowType");
  });

  it("still returns the standard response in shadow mode even if the adapter errors", async () => {
    adapterScope.tasks = ["schema_generation"];
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      AI_ADAPTER_MODE: "shadow",
      GROQ_API_KEY: "groq-test-key",
    });

    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url) === SAFE_ENDPOINT) {
        return jsonResponse({ error: "timeout" }, 504);
      }
      return jsonResponse({ choices: [{ message: { content: validSchema } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await generateClaudeText({
      system: "sys",
      prompt: "Property: Canary Hotel",
      task: "schema_generation",
    });
    expect(out).toBe(validSchema);
    expect(getAdapterGateCounters()["schema_generation|shadow|adapter:transport_error"]).toBe(1);
  });

  it("buckets canary traffic deterministically by propertyId / requestId", async () => {
    adapterScope.tasks = ["schema_generation"];
    const b1 = computeCanaryBucket("prop-alpha");
    const b2 = computeCanaryBucket("prop-alpha");
    expect(b1).toBe(b2);
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b1).toBeLessThan(100);

    expect(shouldRouteCanary("prop-alpha", 0)).toBe(false);
    expect(shouldRouteCanary("prop-alpha", 100)).toBe(true);

    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      AI_ADAPTER_MODE: "canary",
      AI_ADAPTER_CANARY_PCT: "50",
      GROQ_API_KEY: "groq-test-key",
    });

    let inSliceSeed = "seed-0";
    let outSliceSeed = "seed-1";
    for (let i = 0; i < 500; i += 1) {
      const candidate = `prop-${i}`;
      const bucket = computeCanaryBucket(candidate);
      if (bucket < 50) inSliceSeed = candidate;
      if (bucket >= 50) outSliceSeed = candidate;
      if (computeCanaryBucket(inSliceSeed) < 50 && computeCanaryBucket(outSliceSeed) >= 50) break;
    }

    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url) === SAFE_ENDPOINT) {
        return jsonResponse({ choices: [{ message: { content: validSchema } }] });
      }
      return jsonResponse({ choices: [{ message: { content: "from groq" } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const selectedOut = await generateClaudeText({
      system: "sys",
      prompt: "Property: Canary Hotel",
      task: "schema_generation",
      propertyId: inSliceSeed,
    });
    expect(selectedOut).toBe(validSchema);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(SAFE_ENDPOINT);

    const bypassedOut = await generateClaudeText({
      system: "sys",
      prompt: "Property: Canary Hotel",
      task: "schema_generation",
      requestId: outSliceSeed,
    });
    expect(bypassedOut).toBe("from groq");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("api.groq.com");
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
