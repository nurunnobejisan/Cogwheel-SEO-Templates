import "server-only";
import { DEFAULT_CLAUDE_MODEL, generateClaudeText } from "@/core/claude";

/** Default model; override with ANTHROPIC_MODEL (e.g. claude-3-5-sonnet-latest). */
export const DEFAULT_MODEL = DEFAULT_CLAUDE_MODEL;

/**
 * Single entry point for all generation (Phase 2 rationale, Phase 3 Hilton copy).
 * Temperature is pinned to 0.2 and cannot be overridden by callers.
 */
export async function generateText(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  return generateClaudeText(opts);
}
