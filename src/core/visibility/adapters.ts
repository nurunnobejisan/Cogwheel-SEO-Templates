/**
 * BYOK visibility provider adapters.
 *
 * Each adapter is enabled only when its key exists. No key, no official API,
 * or an exhausted daily cap returns `available: false` with a reason. Answers
 * are analysed deterministically (see analyze.ts); no LLM judge is used.
 *
 * AI Overviews intentionally has no scraping adapter: Google publishes no
 * official API for it, so the only honest result is `unavailable`.
 */

import type { BuyerPrompt, CitationType, PromptSet, ProviderAnswer, ProviderId } from "./types.ts";
import { modelFor } from "../ai/models.ts";
import { analyzeAnswer, unavailableAnswer } from "./analyze.ts";
import { buildVisibilityPrompt } from "./prompts.ts";
import { canUseVisibilityProvider, recordVisibilityUsage, refundVisibilityToken } from "./budget.ts";

export interface QueryContext {
  promptSet: PromptSet;
  prompt: BuyerPrompt;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** Environment variables that enable this adapter. */
  requires: string[];
  isConfigured(): boolean;
  unavailableReason(): string;
  estimatedCostUsd(): number;
  query(context: QueryContext): Promise<ProviderAnswer>;
}

const TIMEOUT_MS = 45_000;

function envCost(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function configured(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}

function missing(names: string[]): string {
  return `Not configured: set ${names.join(" or ")}`;
}

async function guardedQuery(
  id: ProviderId,
  estimatedCostUsd: number,
  isConfigured: boolean,
  unavailableReason: string,
  context: QueryContext,
  model: string,
  call: () => Promise<{ answer: string; citations: Array<{ url: string; title?: string }> }>,
  citationType?: CitationType | ((result: { citations: Array<{ url: string; title?: string }> }) => CitationType)
): Promise<ProviderAnswer> {
  if (!isConfigured) {
    return unavailableAnswer(id, context.prompt.id, unavailableReason, model);
  }
  const cost = estimatedCostUsd;
  let reserved = false;
  const budget = await canUseVisibilityProvider(cost, id);
  if (!budget.allowed) {
    return unavailableAnswer(id, context.prompt.id, budget.reason ?? "daily cap reached", model);
  }
  reserved = true;
  try {
    const result = await call();
    await recordVisibilityUsage(cost, id);
    const resolvedCitationType =
      typeof citationType === "function" ? citationType(result) : citationType;
    return analyzeAnswer({
      provider: id,
      promptId: context.prompt.id,
      brand: context.promptSet.brand,
      targetDomain: context.promptSet.domain,
      competitorDomains: context.promptSet.competitorDomains,
      model,
      answer: result.answer,
      providerCitations: result.citations,
      estimatedCostUsd: cost,
      citationType: resolvedCitationType,
    });
  } catch (error) {
    if (reserved) await refundVisibilityToken(id);
    return unavailableAnswer(
      id,
      context.prompt.id,
      `Provider request failed: ${error instanceof Error ? error.message : String(error)}`,
      model
    );
  }
}

/* -------------------------------------------------------------------------- */
/* OpenAI / ChatGPT                                                           */
/* -------------------------------------------------------------------------- */

interface OpenAiOutput {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string; title?: string }>;
    }>;
  }>;
  error?: { message?: string };
}

export function createChatGptAdapter(): ProviderAdapter {
  const model = process.env.OPENAI_VISIBILITY_MODEL || "gpt-4o-mini";
  return {
    id: "chatgpt",
    label: "ChatGPT (OpenAI)",
    requires: ["OPENAI_API_KEY"],
    isConfigured: () => configured("OPENAI_API_KEY"),
    unavailableReason: () => missing(["OPENAI_API_KEY"]),
    estimatedCostUsd: () => envCost("OPENAI_VISIBILITY_COST_USD", 0.01),
    query: (context) =>
      guardedQuery(
        "chatgpt",
        envCost("OPENAI_VISIBILITY_COST_USD", 0.01),
        configured("OPENAI_API_KEY"),
        missing(["OPENAI_API_KEY"]),
        context,
        model,
        async () => {
          const webSearch = process.env.OPENAI_WEB_SEARCH !== "false";
          const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              model,
              input: context.prompt.text,
              max_output_tokens: 900,
              ...(webSearch ? { tools: [{ type: "web_search_preview" }] } : {}),
            }),
          });
          const data = (await response.json().catch(() => ({}))) as OpenAiOutput;
          if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
          }
          const text = (data.output ?? [])
            .flatMap((item) => item.content ?? [])
            .filter((part) => part.type === "output_text" && typeof part.text === "string")
            .map((part) => part.text!)
            .join("\n")
            .trim();
          if (!text) throw new Error("empty answer");
          const citations = (data.output ?? [])
            .flatMap((item) => item.content ?? [])
            .flatMap((part) => part.annotations ?? [])
            .filter((annotation) => annotation.type === "url_citation" && annotation.url)
            .map((annotation) => ({ url: annotation.url!, title: annotation.title }));
          return { answer: text, citations };
        }
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Anthropic / Claude                                                         */
/* -------------------------------------------------------------------------- */

interface AnthropicContentBlock {
  type?: string;
  text?: string;
  citations?: Array<{ url?: string; title?: string }>;
  content?: Array<{ type?: string; url?: string; title?: string }>;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
}

export function createClaudeAdapter(): ProviderAdapter {
  const model = process.env.ANTHROPIC_VISIBILITY_MODEL || modelFor("anthropic");
  return {
    id: "claude",
    label: "Claude (Anthropic)",
    requires: ["ANTHROPIC_API_KEY"],
    isConfigured: () => configured("ANTHROPIC_API_KEY"),
    unavailableReason: () => missing(["ANTHROPIC_API_KEY"]),
    estimatedCostUsd: () => envCost("ANTHROPIC_VISIBILITY_COST_USD", 0.02),
    query: (context) =>
      guardedQuery(
        "claude",
        envCost("ANTHROPIC_VISIBILITY_COST_USD", 0.02),
        configured("ANTHROPIC_API_KEY"),
        missing(["ANTHROPIC_API_KEY"]),
        context,
        model,
        async () => {
          const webSearch = process.env.ANTHROPIC_WEB_SEARCH !== "false";
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": process.env.ANTHROPIC_API_KEY!,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              model,
              max_tokens: 900,
              temperature: 0.2,
              messages: [{ role: "user", content: context.prompt.text }],
              ...(webSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] } : {}),
            }),
          });
          const data = (await response.json().catch(() => ({}))) as AnthropicResponse;
          if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
          }
          const blocks = data.content ?? [];
          const text = blocks
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text!)
            .join("\n")
            .trim();
          if (!text) throw new Error("empty answer");
          const citations = blocks.flatMap((block) => [
            ...(block.citations ?? []).map((citation) => ({ url: citation.url ?? "", title: citation.title })),
            ...(block.content ?? [])
              .filter((item) => item.url)
              .map((item) => ({ url: item.url!, title: item.title })),
          ]).filter((citation) => citation.url);
          return { answer: text, citations };
        }
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Perplexity                                                                 */
/* -------------------------------------------------------------------------- */

interface PerplexityResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
  search_results?: Array<{ url?: string; title?: string }>;
  error?: { message?: string };
}

export function createPerplexityAdapter(): ProviderAdapter {
  const model = process.env.PERPLEXITY_MODEL || "sonar";
  return {
    id: "perplexity",
    label: "Perplexity",
    requires: ["PERPLEXITY_API_KEY"],
    isConfigured: () => configured("PERPLEXITY_API_KEY"),
    unavailableReason: () => missing(["PERPLEXITY_API_KEY"]),
    estimatedCostUsd: () => envCost("PERPLEXITY_VISIBILITY_COST_USD", 0.005),
    query: (context) =>
      guardedQuery(
        "perplexity",
        envCost("PERPLEXITY_VISIBILITY_COST_USD", 0.005),
        configured("PERPLEXITY_API_KEY"),
        missing(["PERPLEXITY_API_KEY"]),
        context,
        model,
        async () => {
          const response = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: context.prompt.text }],
              temperature: 0.2,
              max_tokens: 900,
            }),
          });
          const data = (await response.json().catch(() => ({}))) as PerplexityResponse;
          if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
          }
          const text = data.choices?.[0]?.message?.content?.trim() ?? "";
          if (!text) throw new Error("empty answer");
          const citations = [
            ...(data.citations ?? []).map((url) => ({ url })),
            ...(data.search_results ?? []).filter((item) => item.url).map((item) => ({ url: item.url!, title: item.title })),
          ];
          return { answer: text, citations };
        }
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Google Gemini                                                              */
/* -------------------------------------------------------------------------- */

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
  error?: { message?: string };
}

export function createGeminiAdapter(): ProviderAdapter {
  const model = process.env.GEMINI_VISIBILITY_MODEL || modelFor("gemini");
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
  return {
    id: "gemini",
    label: "Gemini (Google)",
    requires: ["GEMINI_API_KEY or GOOGLE_AI_API_KEY"],
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
    unavailableReason: () => missing(["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"]),
    estimatedCostUsd: () => envCost("GEMINI_VISIBILITY_COST_USD", 0.002),
    query: (context) =>
      guardedQuery(
        "gemini",
        envCost("GEMINI_VISIBILITY_COST_USD", 0.002),
        Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
        missing(["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"]),
        context,
        model,
        async () => {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(TIMEOUT_MS),
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: context.prompt.text }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
              }),
            }
          );
          const data = (await response.json().catch(() => ({}))) as GeminiResponse;
          if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
          }
          const candidate = data.candidates?.[0];
          const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
          if (!text) throw new Error("empty answer");
          const citations = (candidate?.groundingMetadata?.groundingChunks ?? [])
            .filter((chunk) => chunk.web?.uri)
            .map((chunk) => ({ url: chunk.web!.uri!, title: chunk.web!.title }));
          return { answer: text, citations };
        }
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Google AI Overviews                                                        */
/* -------------------------------------------------------------------------- */

export function createAiOverviewsAdapter(): ProviderAdapter {
  return {
    id: "ai_overviews",
    label: "Google AI Overviews",
    requires: [],
    isConfigured: () => false,
    unavailableReason: () =>
      "Google publishes no official AI Overviews API. Scraping is not permitted, so this surface stays unavailable.",
    estimatedCostUsd: () => 0,
    query: async (context) =>
      unavailableAnswer(
        "ai_overviews",
        context.prompt.id,
        "Google publishes no official AI Overviews API. Scraping is not permitted, so this surface stays unavailable."
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Free-tier adapters (opt-in)                                                */
/* -------------------------------------------------------------------------- */

/**
 * These adapters are default-off. Enabling them is an explicit operator
 * choice, and only free tiers / keyless endpoints are used. The legacy BYOK
 * adapters above keep their original configuration contract.
 */
function freeVisibilityEnabled(): boolean {
  return process.env.VISIBILITY_FREE_PROVIDERS_ENABLED === "true" || process.env.VISIBILITY_FREE_PROVIDERS_ENABLED === "1";
}

const FREE_OPT_IN_REASON = "Opt in by setting VISIBILITY_FREE_PROVIDERS_ENABLED=true";

interface ChatCompletionOutput {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

function chatCompletionText(data: ChatCompletionOutput): string {
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error(data.error?.message || "empty answer");
  return text;
}

export function createGeminiGroundedAdapter(): ProviderAdapter {
  const model = process.env.GEMINI_VISIBILITY_MODEL || "gemini-2.5-flash";
  const configured = () => freeVisibilityEnabled() && Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  const reason = () => (freeVisibilityEnabled() ? missing(["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"]) : FREE_OPT_IN_REASON);
  return {
    id: "gemini_grounded",
    label: "Gemini 2.x (grounded)",
    requires: ["VISIBILITY_FREE_PROVIDERS_ENABLED", "GEMINI_API_KEY or GOOGLE_AI_API_KEY"],
    isConfigured: configured,
    unavailableReason: reason,
    estimatedCostUsd: () => envCost("GEMINI_VISIBILITY_COST_USD", 0),
    query: (context) =>
      guardedQuery(
        "gemini_grounded",
        envCost("GEMINI_VISIBILITY_COST_USD", 0),
        configured(),
        reason(),
        context,
        model,
        async () => {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
              process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ""
            )}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(TIMEOUT_MS),
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: buildVisibilityPrompt(context.prompt.text, true) }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
              }),
            }
          );
          const data = (await response.json().catch(() => ({}))) as GeminiResponse;
          if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
          const candidate = data.candidates?.[0];
          const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
          if (!text) throw new Error("empty answer");
          const citations = (candidate?.groundingMetadata?.groundingChunks ?? [])
            .filter((chunk) => chunk.web?.uri)
            .map((chunk) => ({ url: chunk.web!.uri!, title: chunk.web!.title }));
          return { answer: text, citations };
        },
        // No grounding chunks means the answer is model memory, not a web citation.
        (result) => (result.citations.length > 0 ? "web_grounded" : "model_memory")
      ),
  };
}

export function createGroqLlamaAdapter(): ProviderAdapter {
  const model = process.env.GROQ_VISIBILITY_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const configured = () => freeVisibilityEnabled() && Boolean(process.env.GROQ_API_KEY);
  const reason = () => (freeVisibilityEnabled() ? missing(["GROQ_API_KEY"]) : FREE_OPT_IN_REASON);
  return {
    id: "groq_llama",
    label: "Llama 3.3 (Groq)",
    requires: ["VISIBILITY_FREE_PROVIDERS_ENABLED", "GROQ_API_KEY"],
    isConfigured: configured,
    unavailableReason: reason,
    estimatedCostUsd: () => envCost("GROQ_VISIBILITY_COST_USD", 0),
    query: (context) =>
      guardedQuery(
        "groq_llama",
        envCost("GROQ_VISIBILITY_COST_USD", 0),
        configured(),
        reason(),
        context,
        model,
        async () => {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: buildVisibilityPrompt(context.prompt.text, false) }],
              temperature: 0.2,
              max_tokens: 900,
            }),
          });
          const data = (await response.json().catch(() => ({}))) as ChatCompletionOutput;
          if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
          return { answer: chatCompletionText(data), citations: [] };
        },
        "model_memory"
      ),
  };
}

export function createOpenRouterFreeAdapter(): ProviderAdapter {
  const model = process.env.OPENROUTER_VISIBILITY_MODEL || process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const configured = () =>
    freeVisibilityEnabled() && Boolean(process.env.OPENROUTER_API_KEY) && model.endsWith(":free");
  const reason = () => {
    if (!freeVisibilityEnabled()) return FREE_OPT_IN_REASON;
    if (!process.env.OPENROUTER_API_KEY) return missing(["OPENROUTER_API_KEY"]);
    return "Only OpenRouter models ending in :free are enabled; set OPENROUTER_VISIBILITY_MODEL to a free model id.";
  };
  return {
    id: "openrouter_free",
    label: "OpenRouter free tier",
    requires: ["VISIBILITY_FREE_PROVIDERS_ENABLED", "OPENROUTER_API_KEY", "OPENROUTER_VISIBILITY_MODEL (:free)"],
    isConfigured: configured,
    unavailableReason: reason,
    estimatedCostUsd: () => envCost("OPENROUTER_VISIBILITY_COST_USD", 0),
    query: (context) =>
      guardedQuery(
        "openrouter_free",
        envCost("OPENROUTER_VISIBILITY_COST_USD", 0),
        configured(),
        reason(),
        context,
        model,
        async () => {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
              "X-Title": "SEO & GEO Studio",
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: buildVisibilityPrompt(context.prompt.text, false) }],
              temperature: 0.2,
              max_tokens: 900,
            }),
          });
          const data = (await response.json().catch(() => ({}))) as ChatCompletionOutput;
          if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
          return { answer: chatCompletionText(data), citations: [] };
        },
        "model_memory"
      ),
  };
}

export function createPollinationsAdapter(): ProviderAdapter {
  const model = process.env.POLLINATIONS_MODEL || "openai";
  const configured = () => process.env.POLLINATIONS_ENABLED === "true";
  const reason = () => "Opt in by setting POLLINATIONS_ENABLED=true (keyless, model-memory answers only)";
  return {
    id: "pollinations",
    label: "Pollinations (keyless, model memory)",
    requires: ["POLLINATIONS_ENABLED"],
    isConfigured: configured,
    unavailableReason: reason,
    estimatedCostUsd: () => 0,
    query: (context) =>
      guardedQuery(
        "pollinations",
        0,
        configured(),
        reason(),
        context,
        model,
        async () => {
          const response = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: buildVisibilityPrompt(context.prompt.text, false) }],
              temperature: 0.2,
              max_tokens: 900,
            }),
          });
          const data = (await response.json().catch(() => ({}))) as ChatCompletionOutput;
          if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
          return { answer: chatCompletionText(data), citations: [] };
        },
        "model_memory"
      ),
  };
}

const ADAPTERS: ProviderAdapter[] = [
  createChatGptAdapter(),
  createClaudeAdapter(),
  createPerplexityAdapter(),
  createGeminiAdapter(),
  createGeminiGroundedAdapter(),
  createGroqLlamaAdapter(),
  createOpenRouterFreeAdapter(),
  createPollinationsAdapter(),
  createAiOverviewsAdapter(),
];

export function getProviderAdapters(): ProviderAdapter[] {
  return ADAPTERS;
}

export function adapterStatus(): Array<{
  id: ProviderId;
  label: string;
  configured: boolean;
  requires: string[];
  reason?: string;
  estimatedCostUsd: number;
}> {
  return ADAPTERS.map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    configured: adapter.isConfigured(),
    requires: adapter.requires,
    reason: adapter.isConfigured() ? undefined : adapter.unavailableReason(),
    estimatedCostUsd: adapter.estimatedCostUsd(),
  }));
}
