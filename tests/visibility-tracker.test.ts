import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generatePromptSet } from "../src/core/visibility/prompts";
import { analyzeAnswer, classifyCitation } from "../src/core/visibility/analyze";
import { adapterStatus, createAiOverviewsAdapter, createChatGptAdapter } from "../src/core/visibility/adapters";
import { summarizeResults, runVisibilityTracker } from "../src/core/visibility/tracker";
import { detectGaps } from "../src/core/visibility/gap-detector";
import { buildGapPatchPlans } from "../healing/gap-plans";
import { latestVisibilityRun, listVisibilityRuns, saveVisibilityRun } from "../src/core/visibility/store";
import type { PromptResult, VisibilityRun } from "../src/core/visibility/types";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "PERPLEXITY_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "VISIBILITY_FREE_PROVIDERS_ENABLED",
  "POLLINATIONS_ENABLED",
];

function clearProviderKeys(): void {
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buyer prompt generator", () => {
  it("generates unique hotel prompts without inventing volumes", () => {
    const set = generatePromptSet({
      targetUrl: "https://www.examplehotel.com",
      brand: "Example Hotel",
      mode: "hotel",
      city: "Denver",
      features: ["a rooftop pool", "free breakfast"],
    });
    expect(set.prompts.length).toBeGreaterThanOrEqual(8);
    expect(new Set(set.prompts.map((p) => p.id)).size).toBe(set.prompts.length);
    expect(set.prompts.some((p) => p.branded)).toBe(true);
    expect(set.prompts.some((p) => p.text.includes("Denver"))).toBe(true);
    expect(JSON.stringify(set).toLowerCase()).not.toMatch(/search volume|monthly searches/);
  });

  it("generates universal prompts and honours maxPrompts", () => {
    const set = generatePromptSet({
      targetUrl: "https://acme.example",
      brand: "Acme",
      mode: "universal",
      category: "accounting software",
      audience: "small businesses",
      maxPrompts: 6,
    });
    expect(set.mode).toBe("universal");
    expect(set.prompts).toHaveLength(6);
    expect(set.prompts.some((p) => p.text.includes("accounting software"))).toBe(true);
  });

  it("derives a brand label from the domain when none is supplied", () => {
    const set = generatePromptSet({ targetUrl: "https://www.catbirdhotel.com", mode: "hotel" });
    expect(set.brand.toLowerCase()).toBe("catbirdhotel");
    expect(set.domain).toBe("catbirdhotel.com");
  });
});

describe("deterministic answer analysis", () => {
  it("classifies own, competitor, social and informational citations", () => {
    expect(classifyCitation("https://example.com/rooms", "example.com")?.source).toBe("own");
    expect(classifyCitation("https://www.example.com/faq", "example.com")?.source).toBe("own");
    expect(classifyCitation("https://rival.com/page", "example.com", ["rival.com"])?.source).toBe("competitor");
    expect(classifyCitation("https://tripadvisor.com/hotel", "example.com")?.source).toBe("social");
    expect(classifyCitation("https://en.wikipedia.org/wiki/Hotel", "example.com")?.source).toBe("informational");
    expect(classifyCitation("not-a-url", "example.com")).toBeNull();
  });

  it("measures a mention and extracts citations", () => {
    const result = analyzeAnswer({
      provider: "chatgpt",
      promptId: "p1",
      brand: "Example Hotel",
      targetDomain: "example.com",
      competitorDomains: ["rival.com"],
      model: "test",
      answer:
        "Example Hotel is a boutique stay in Denver. See https://example.com/rooms. Another option is https://rival.com and reviews at https://tripadvisor.com/x.",
    });
    expect(result.available).toBe(true);
    expect(result.mentioned).toBe(true);
    expect(result.mentionSnippets[0]).toContain("Example Hotel");
    expect(result.citations.find((c) => c.source === "own")).toBeTruthy();
    expect(result.citations.find((c) => c.source === "competitor")).toBeTruthy();
    expect(result.ownCitationCount).toBe(1);
  });

  it("marks absence as measured false, not unknown", () => {
    const result = analyzeAnswer({
      provider: "perplexity",
      promptId: "p1",
      brand: "Example Hotel",
      targetDomain: "example.com",
      model: "sonar",
      answer: "Rival Hotel is the best option. https://rival.com",
    });
    expect(result.mentioned).toBe(false);
    expect(result.ownCitationCount).toBe(0);
  });
});

describe("provider adapters", () => {
  it("returns unavailable for every unconfigured provider", async () => {
    clearProviderKeys();
    const statuses = adapterStatus();
    const chatgpt = createChatGptAdapter();
    expect(chatgpt.isConfigured()).toBe(false);
    const context = {
      promptSet: generatePromptSet({ targetUrl: "https://example.com", brand: "Example", mode: "universal" }),
      prompt: { id: "p1", text: "best example", intent: "comparison" as const, branded: false },
    };
    const answer = await chatgpt.query(context);
    expect(answer.available).toBe(false);
    expect(answer.mentioned).toBeNull();
    expect(answer.reason).toContain("OPENAI_API_KEY");
    expect(statuses.every((status) => status.id === "ai_overviews" || !status.configured)).toBe(true);
  });

  it("always marks AI Overviews unavailable", async () => {
    const adapter = createAiOverviewsAdapter();
    const answer = await adapter.query({
      promptSet: generatePromptSet({ targetUrl: "https://example.com", brand: "Example" }),
      prompt: { id: "p1", text: "best hotel", intent: "local", branded: false },
    });
    expect(adapter.isConfigured()).toBe(false);
    expect(answer.available).toBe(false);
    expect(answer.reason).toMatch(/no official AI Overviews API/i);
  });
});

describe("visibility runs, gaps and plans", () => {
  function result(overrides: Partial<PromptResult>): PromptResult {
    return {
      promptId: "p1",
      prompt: "best hotel in Denver",
      intent: "local",
      branded: false,
      provider: "chatgpt",
      available: true,
      mentioned: false,
      mentionCount: 0,
      ownCitations: 0,
      citations: [],
      model: "test",
      answeredAt: "2026-11-26T00:00:00.000Z",
      ...overrides,
    };
  }

  function run(results: PromptResult[]): VisibilityRun {
    return {
      id: "vis_test",
      targetUrl: "https://examplehotel.com",
      brand: "Example Hotel",
      mode: "hotel",
      startedAt: "2026-11-26T00:00:00.000Z",
      finishedAt: "2026-11-26T00:01:00.000Z",
      providersRequested: ["chatgpt", "perplexity"],
      results,
      summary: summarizeResults(["p1", "p2"], results, [createChatGptAdapter(), createAiOverviewsAdapter()]),
    };
  }

  it("summarizes only measured answers", () => {
    const summary = summarizeResults(
      ["p1", "p2"],
      [
        result({ promptId: "p1", mentioned: false }),
        result({ promptId: "p2", mentioned: true, provider: "perplexity" }),
        result({ promptId: "p2", provider: "ai_overviews", available: false, mentioned: null, reason: "no API" }),
      ],
      [createChatGptAdapter(), createAiOverviewsAdapter()]
    );
    expect(summary.availableAnswers).toBe(2);
    expect(summary.unavailableAnswers).toBe(1);
    expect(summary.mentionRate).toBe(0.5);
    expect(summary.absentPromptIds).toEqual(["p1"]);
  });

  it("creates critical gaps for branded prompts and keeps unmeasured prompts separate", () => {
    const report = detectGaps(
      run([
        result({ promptId: "p1", prompt: "Is Example Hotel a good hotel?", intent: "branded", branded: true }),
        result({ promptId: "p2", provider: "chatgpt", available: false, mentioned: null, reason: "no key" }),
        result({ promptId: "p2", provider: "perplexity", available: false, mentioned: null, reason: "no key" }),
      ])
    );
    expect(report.gaps).toHaveLength(1);
    expect(report.gaps[0]?.severity).toBe("critical");
    expect(report.gaps[0]?.recommendedActions[0]).toMatch(/schema/i);
    expect(report.unmeasuredPrompts.map((p) => p.promptId)).toEqual(["p2"]);
  });

  it("emits patch plans that require approval and never auto-apply", () => {
    const report = detectGaps(run([result({ promptId: "p1" })]));
    const plans = buildGapPatchPlans(report, "2026-11-26T00:00:00.000Z");
    expect(plans).toHaveLength(1);
    expect(plans[0]?.status).toBe("pending_approval");
    expect(plans[0]?.approval.required).toBe(true);
    expect(plans[0]?.approval.approvedBy).toBeNull();
    expect(plans[0]?.autoApply).toBe(false);
    expect(plans[0]?.proposedChanges.length).toBeGreaterThan(0);
  });

  it("records an all-unavailable run without fabricating mentions", async () => {
    clearProviderKeys();
    const created = await runVisibilityTracker({
      targetUrl: "https://examplehotel.com",
      brand: "Example Hotel",
      mode: "hotel",
      city: "Denver",
      maxPrompts: 4,
    });
    expect(created.results.length).toBeGreaterThan(0);
    expect(created.results.every((row) => row.available === false)).toBe(true);
    expect(created.results.every((row) => row.mentioned === null)).toBe(true);
    expect(created.summary.mentionRate).toBeNull();
    expect(created.summary.unmeasuredPromptIds.length).toBe(4);
  });
});

describe("local visibility store", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "seo-studio-vis-"));
    vi.stubEnv("SEO_STUDIO_DATA_DIR", dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("round-trips runs and returns the latest for a URL", async () => {
    const base = {
      targetUrl: "https://example.com",
      brand: "Example",
      mode: "universal" as const,
      startedAt: "2026-11-26T00:00:00.000Z",
      providersRequested: [],
      results: [],
      summary: {
        totalPrompts: 0,
        totalAnswersRequested: 0,
        availableAnswers: 0,
        unavailableAnswers: 0,
        mentionRate: null,
        ownCitationCount: null,
        byProvider: [],
        absentPromptIds: [],
        unmeasuredPromptIds: [],
      },
    };
    await saveVisibilityRun({ ...base, id: "one", finishedAt: "2026-11-26T00:00:00.000Z" });
    await saveVisibilityRun({ ...base, id: "two", finishedAt: "2026-11-26T00:01:00.000Z" });
    const all = await listVisibilityRuns({ targetUrl: "https://example.com" });
    expect(all).toHaveLength(2);
    expect((await latestVisibilityRun("https://example.com"))?.id).toBe("two");
    expect(await listVisibilityRuns({ targetUrl: "https://other.com" })).toHaveLength(0);
  });
});
