import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { LLM_TEMPERATURE } from "@/config/hilton-rules";

/** Default model; override with ANTHROPIC_MODEL (e.g. claude-3-5-sonnet-latest). */
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Single entry point for all generation (Phase 2 rationale, Phase 3 Hilton copy).
 * Temperature is pinned to 0.2 and cannot be overridden by callers.
 */
export async function generateText(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  const res = await getClient().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: LLM_TEMPERATURE,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

