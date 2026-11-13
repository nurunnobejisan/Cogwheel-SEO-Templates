import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { formatTrainingContext } from "@/core/training";

/** Pinned temperature for all grounded SEO/GEO drafting calls. */
export const CLAUDE_TEMPERATURE = 0.2 as const;

/** Default model; override with ANTHROPIC_MODEL (e.g. claude-3-5-sonnet-latest). */
export const DEFAULT_CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

let client: Anthropic | null = null;

export function getActiveAiProviderLabel(): string {
  if (process.env.ANTHROPIC_API_KEY) return `Claude (${DEFAULT_CLAUDE_MODEL})`;
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) return "Gemini 2.0 Flash (Free)";
  if (process.env.GROQ_API_KEY) return "Groq Llama 3.3 70B (Free)";
  if (process.env.OPENROUTER_API_KEY) return "OpenRouter Free LLM";
  if (process.env.ENABLE_FREE_ONLINE_AI !== "false") return "Free Online AI (Pollinations)";
  return "Not Configured";
}

export function isClaudeConfigured(): boolean {
  if (
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

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
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
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
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
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
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
        model: "openai",
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
