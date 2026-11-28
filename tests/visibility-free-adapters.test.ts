import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  adapterStatus,
  createGeminiGroundedAdapter,
  createGroqLlamaAdapter,
  createOpenRouterFreeAdapter,
  createPollinationsAdapter,
} from "../src/core/visibility/adapters.ts";
import { buildVisibilityPrompt, generatePromptSet } from "../src/core/visibility/prompts.ts";
import type { PromptSet } from "../src/core/visibility/types.ts";

const FREE_IDS = ["gemini_grounded", "groq_llama", "openrouter_free", "pollinations"] as const;

const promptSet: PromptSet = generatePromptSet({
  targetUrl: "https://examplehotel.com",
  brand: "Example Hotel",
  mode: "hotel",
  city: "Denver",
  maxPrompts: 1,
});

const context = {
  promptSet,
  prompt: promptSet.prompts[0]!,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let dataDir: string;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "seo-studio-free-vis-"));
  vi.stubEnv("SEO_STUDIO_DATA_DIR", dataDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("free visibility adapters", () => {
  it("keeps every new adapter opt-in by default", () => {
    vi.stubEnv("VISIBILITY_FREE_PROVIDERS_ENABLED", "");
    vi.stubEnv("POLLINATIONS_ENABLED", "");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    for (const status of adapterStatus()) {
      if (FREE_IDS.includes(status.id as (typeof FREE_IDS)[number])) {
        expect(status.configured).toBe(false);
        expect(status.reason).toMatch(/opt in/i);
      }
    }
  });

  it("adds only neutral answering instructions to buyer prompts", () => {
    const grounded = buildVisibilityPrompt("best hotels in Denver", true);
    const memory = buildVisibilityPrompt("best hotels in Denver", false);
    expect(grounded.startsWith("best hotels in Denver")).toBe(true);
    expect(grounded).toMatch(/web sources you actually used/i);
    expect(memory).toMatch(/model memory/i);
    expect(grounded).not.toMatch(/Example Hotel/);
  });

  it("labels grounded Gemini citations separately from model memory", async () => {
    vi.stubEnv("VISIBILITY_FREE_PROVIDERS_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          {
            content: { parts: [{ text: "Example Hotel is recommended. https://examplehotel.com/rooms" }] },
            groundingMetadata: { groundingChunks: [{ web: { uri: "https://examplehotel.com/rooms" } }] },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const grounded = await createGeminiGroundedAdapter().query(context);
    expect(grounded.available).toBe(true);
    expect(grounded.model).toBe("gemini-2.5-flash");
    expect(grounded.citationType).toBe("web_grounded");
    expect(grounded.ownCitationCount).toBe(1);
    expect(grounded.estimatedCostUsd).toBe(0);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.tools).toEqual([{ google_search: {} }]);
    expect(sent.contents[0].parts[0].text).toMatch(/web sources you actually used/);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: "Example Hotel may be a good fit. https://examplehotel.com" }] } }],
        })
      )
    );
    const memory = await createGeminiGroundedAdapter().query(context);
    expect(memory.citationType).toBe("model_memory");
    expect(memory.citations).toEqual([]);
    expect(memory.ownCitationCount).toBe(0);
    expect(memory.mentioned).toBe(true);
  });

  it("queries Groq Llama 3.3 as model memory with no invented citations", async () => {
    vi.stubEnv("VISIBILITY_FREE_PROVIDERS_ENABLED", "true");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: "Example Hotel is a boutique stay. See https://examplehotel.com" } }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createGroqLlamaAdapter();
    expect(adapter.label).toBe("Llama 3.3 (Groq)");
    const answer = await adapter.query(context);
    expect(answer.available).toBe(true);
    expect(answer.model).toBe("llama-3.3-70b-versatile");
    expect(answer.citationType).toBe("model_memory");
    expect(answer.citations).toEqual([]);
    expect(answer.ownCitationCount).toBe(0);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.model).toBe("llama-3.3-70b-versatile");
    expect(sent.messages[0].content).toMatch(/model memory/i);
  });

  it("only uses OpenRouter models marked :free", async () => {
    vi.stubEnv("VISIBILITY_FREE_PROVIDERS_ENABLED", "true");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_VISIBILITY_MODEL", "meta-llama/llama-3.3-70b-instruct");
    expect(createOpenRouterFreeAdapter().isConfigured()).toBe(false);

    vi.stubEnv("OPENROUTER_VISIBILITY_MODEL", "meta-llama/llama-3.3-70b-instruct:free");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "Rival Hotel is better." } }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const answer = await createOpenRouterFreeAdapter().query(context);
    expect(answer.available).toBe(true);
    expect(answer.citationType).toBe("model_memory");
    expect(answer.model).toContain(":free");
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.model).toContain(":free");
  });

  it("requires an explicit Pollinations opt-in and never charges a key", async () => {
    vi.stubEnv("POLLINATIONS_ENABLED", "");
    expect(createPollinationsAdapter().isConfigured()).toBe(false);
    expect(createPollinationsAdapter().unavailableReason()).toMatch(/POLLINATIONS_ENABLED=true/);

    vi.stubEnv("POLLINATIONS_ENABLED", "true");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "Example Hotel is a good choice." } }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const answer = await createPollinationsAdapter().query(context);
    expect(answer.available).toBe(true);
    expect(answer.mentioned).toBe(true);
    expect(answer.citationType).toBe("model_memory");
    expect(answer.estimatedCostUsd).toBe(0);
  });
});
