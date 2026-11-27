import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { formatTrainingContext } from "@/core/training";
import { modelFor } from "@/core/ai/models";
import {
  callCustomModel,
  getCustomModelSettings,
  isCustomModelConfigured,
} from "@/core/ai/custom-model";

/** Pinned temperature for all grounded SEO/GEO drafting calls. */
export const CLAUDE_TEMPERATURE = 0.2 as const;

/**
 * Default model for the paid Anthropic path. Only reached when
 * ANTHROPIC_API_KEY is set; otherwise the client uses the free providers. See
 * `src/core/ai/models.ts` — override with ANTHROPIC_MODEL.
 */
export const DEFAULT_CLAUDE_MODEL = modelFor("anthropic");

let client: Anthropic | null = null;

export function getActiveAiProviderLabel(): string {
  if (isCustomModelConfigured()) {
    const { model } = getCustomModelSettings();
    return `SEO Studio fine-tuned (${model})`;
  }
  if (process.env.ANTHROPIC_API_KEY) return `Claude (${DEFAULT_CLAUDE_MODEL})`;
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) return `Gemini (${modelFor("gemini")}) — free tier`;
  if (process.env.GROQ_API_KEY) return `Groq (${modelFor("groq")}) — free`;
  if (process.env.OPENROUTER_API_KEY) return `OpenRouter (${modelFor("openrouter")}) — free`;
  if (process.env.ENABLE_FREE_ONLINE_AI !== "false") return `Free Online AI (Pollinations, keyless)`;
  return "Not Configured";
}

export function isClaudeConfigured(): boolean {
  if (
    isCustomModelConfigured() ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY
  ) {
    return true;
  }
  return process.env.ENABLE_FREE_ONLINE_AI !== "false" && process.env.NODE_ENV !== "test";
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function callGeminiFree(system: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const model = modelFor("gemini");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: CLAUDE_TEMPERATURE,
          maxOutputTokens: maxTokens,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function callOpenAiCompatible(opts: {
  endpoint: string;
  apiKey?: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
}): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const res = await fetch(opts.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: opts.model,
      temperature: CLAUDE_TEMPERATURE,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`AI endpoint HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("AI endpoint returned empty response");
  return text;
}

/**
 * Shared multi-provider AI drafting client with automatic free online fallback.
 * Temperature is pinned to 0.2 and active AI training rules are always injected.
 */
export async function generateClaudeText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  taskId?: string;
}): Promise<string> {
  const trainingAppendix = await formatTrainingContext(opts.taskId);
  const fullSystem = `${opts.system}${trainingAppendix}`;
  const maxTokens = opts.maxTokens ?? 2048;
  const errors: string[] = [];

  // Phase 4 — the SEO Studio fine-tuned model goes first when configured.
  // Any failure (guard, transport, shape) falls through to the providers
  // below, so an unset or unreachable endpoint never breaks drafting.
  if (isCustomModelConfigured()) {
    try {
      return await callCustomModel({
        system: fullSystem,
        prompt: opts.prompt,
        maxTokens,
      });
    } catch (err) {
      const { model } = getCustomModelSettings();
      errors.push(`Fine-tuned (${model}): ${(err as Error).message}`);
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await getClient().messages.create({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature: CLAUDE_TEMPERATURE,
        system: fullSystem,
        messages: [{ role: "user", content: opts.prompt }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (text) return text;
    } catch (err) {
      errors.push(`Anthropic: ${(err as Error).message}`);
    }
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
    try {
      return await callGeminiFree(fullSystem, opts.prompt, maxTokens);
    } catch (err) {
      errors.push(`Gemini: ${(err as Error).message}`);
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      return await callOpenAiCompatible({
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        model: modelFor("groq"),
        system: fullSystem,
        prompt: opts.prompt,
        maxTokens,
      });
    } catch (err) {
      errors.push(`Groq: ${(err as Error).message}`);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenAiCompatible({
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: modelFor("openrouter"),
        system: fullSystem,
        prompt: opts.prompt,
        maxTokens,
      });
    } catch (err) {
      errors.push(`OpenRouter: ${(err as Error).message}`);
    }
  }

  if (process.env.ENABLE_FREE_ONLINE_AI !== "false") {
    try {
      return await callOpenAiCompatible({
        endpoint: "https://text.pollinations.ai/openai",
        model: modelFor("pollinations"),
        system: fullSystem,
        prompt: opts.prompt,
        maxTokens,
      });
    } catch (err) {
      errors.push(`FreeOnlineAI: ${(err as Error).message}`);
    }
  }

  throw new Error(`All online AI providers failed: ${errors.join(" | ") || "none configured"}`);
}
