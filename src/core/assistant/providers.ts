import "server-only";

import { modelFor } from "@/core/ai/models";

/**
 * Audit Assistant provider chain. Free tiers are tried first; paid keys are
 * opt-in add-ons. A rules engine is always the final fallback in the route.
 * No provider is contacted unless its server-side credential is present.
 */

export interface AssistantProvider {
  id: string;
  label: string;
  free: boolean;
  call(system: string, prompt: string): Promise<string>;
}

const TIMEOUT_MS = 9_000;

async function fetchJson(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

function requireText(text: string, provider: string): string {
  const value = text.trim();
  if (!value) throw new Error(`${provider} returned an empty answer`);
  return value;
}

function geminiProvider(): AssistantProvider | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  return {
    id: "gemini",
    label: `Gemini (${model}) — free tier`,
    free: true,
    async call(system, prompt) {
      const response = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
          }),
        }
      );
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return requireText(
        (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join(""),
        "Gemini"
      );
    },
  };
}

function openAiCompatibleProvider(opts: {
  id: string;
  label: string;
  free: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
}): AssistantProvider {
  return {
    id: opts.id,
    label: opts.label,
    free: opts.free,
    async call(system, prompt) {
      const response = await fetchJson(opts.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
          ...opts.extraHeaders,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        }),
      });
      if (!response.ok) throw new Error(`${opts.id} HTTP ${response.status}`);
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return requireText(data.choices?.[0]?.message?.content ?? "", opts.id);
    },
  };
}

function groqProvider(): AssistantProvider | null {
  if (!process.env.GROQ_API_KEY) return null;
  const model = process.env.GROQ_MODEL || modelFor("groq");
  return openAiCompatibleProvider({
    id: "groq",
    label: `Llama 3.3 (Groq, ${model}) — free tier`,
    free: true,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: process.env.GROQ_API_KEY,
    model,
  });
}

function openRouterFreeProvider(): AssistantProvider | null {
  if (!process.env.OPENROUTER_API_KEY) return null;
  const model = process.env.OPENROUTER_MODEL || modelFor("openrouter");
  if (!model.endsWith(":free")) return null;
  return openAiCompatibleProvider({
    id: "openrouter_free",
    label: `OpenRouter free (${model})`,
    free: true,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: process.env.OPENROUTER_API_KEY,
    model,
    extraHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": "SEO & GEO Studio",
    },
  });
}

function openAiPaidProvider(): AssistantProvider | null {
  if (!process.env.OPENAI_API_KEY) return null;
  const model = process.env.OPENAI_VISIBILITY_MODEL || "gpt-4o-mini";
  return openAiCompatibleProvider({
    id: "openai_paid",
    label: `OpenAI (${model}) — paid add-on`,
    free: false,
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: process.env.OPENAI_API_KEY,
    model,
  });
}

function anthropicPaidProvider(): AssistantProvider | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const model = process.env.ANTHROPIC_MODEL || modelFor("anthropic");
  return {
    id: "anthropic_paid",
    label: `Claude (${model}) — paid add-on`,
    free: false,
    async call(system, prompt) {
      const response = await fetchJson("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          temperature: 0.2,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);
      const data = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      return requireText(
        (data.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join(""),
        "Anthropic"
      );
    },
  };
}

/** Gemini → Groq → OpenRouter free → optional paid add-ons. */
export function assistantProviderChain(): AssistantProvider[] {
  return [
    geminiProvider(),
    groqProvider(),
    openRouterFreeProvider(),
    openAiPaidProvider(),
    anthropicPaidProvider(),
  ].filter((provider): provider is AssistantProvider => provider !== null);
}

export function assistantProviderStatus(): Array<{ id: string; label: string; free: boolean }> {
  return assistantProviderChain().map(({ id, label, free }) => ({ id, label, free }));
}
