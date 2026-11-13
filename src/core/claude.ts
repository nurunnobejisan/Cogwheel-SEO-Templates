import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Pinned temperature for all grounded SEO/GEO drafting calls. */
export const CLAUDE_TEMPERATURE = 0.2 as const;

/** Default model; override with ANTHROPIC_MODEL (e.g. claude-3-5-sonnet-latest). */
export const DEFAULT_CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

let client: Anthropic | null = null;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Shared Claude client for all task drafting.
 * Temperature is pinned to 0.2 and cannot be overridden by callers.
 */
export async function generateClaudeText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await getClient().messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: CLAUDE_TEMPERATURE,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
