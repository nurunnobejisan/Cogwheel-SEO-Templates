/**
 * Multi-Model Inference Router (Phase 2)
 *
 * Routes each task to a cost-appropriate tier:
 *   Tier 1 — fast/cheap models for structural JSON validation, metadata and alt
 *            text generation, and schema assembly.
 *   Tier 2 — frontier models for RAG synthesis, intent mapping and entity-gap
 *            reasoning.
 *
 * Provider credentials mirror src/core/claude.ts so the router stays in sync
 * with the existing AI provider configuration.
 */

import type { ProviderDescriptor, RouteDecision, TaskKind } from "./types.ts";
import { modelFor } from "../src/core/ai/models.ts";
import { isCustomModelConfigured } from "../src/core/ai/custom-model.ts";

export const TIER1_TASKS: readonly TaskKind[] = [
  "structured_extraction",
  "metadata_generation",
  "alt_text_generation",
  "schema_generation",
  "page_classification",
];

export const TIER2_TASKS: readonly TaskKind[] = [
  "semantic_reasoning",
  "rag_synthesis",
  "intent_mapping",
  "entity_gap_analysis",
];

/** Map a task kind to its tier. Unknown tasks default to Tier 1 (cheapest). */
export function classifyTask(task: TaskKind): "tier1" | "tier2" {
  return TIER2_TASKS.includes(task) ? "tier2" : "tier1";
}

/**
 * Build the provider registry from environment credentials. A provider is
 * "configured" only when its key is present, so routing degrades gracefully to
 * the deterministic synthesizer when nothing is available.
 */
export function loadProviders(env: NodeJS.ProcessEnv = process.env): ProviderDescriptor[] {
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY;

  return [
    {
      id: "claude",
      label: "Anthropic Claude (frontier)",
      tier: "tier2",
      model: modelFor("anthropic", env),
      configured: Boolean(anthropicKey),
    },
    {
      id: "gemini",
      label: "Google Gemini Flash (fast, free)",
      tier: "tier1",
      model: modelFor("gemini", env),
      configured: Boolean(geminiKey),
    },
    {
      id: "groq",
      label: "Groq Llama (fast, free)",
      tier: "tier1",
      model: modelFor("groq", env),
      configured: Boolean(env.GROQ_API_KEY),
    },
    {
      id: "openrouter",
      label: "OpenRouter (free models)",
      tier: "tier2",
      model: modelFor("openrouter", env),
      configured: Boolean(env.OPENROUTER_API_KEY),
    },
    {
      id: "cogwheel-tuned",
      label: "SEO Studio fine-tuned model",
      tier: "tier1",
      model: env.CUSTOM_MODEL_ID || "cogwheel-seo-unified",
      // Guard-aware: an endpoint that fails the SSRF check reports as
      // unconfigured so routing falls back instead of calling it (fail closed).
      configured: isCustomModelConfigured(env),
    },
  ];
}

const TIER_RATIONALE: Record<"tier1" | "tier2", string> = {
  tier1:
    "Structural/structured task — handled by a fast, low-cost model to keep latency and token spend minimal.",
  tier2:
    "Semantic reasoning task — escalated to a frontier model for RAG synthesis and intent/entity analysis.",
};

/**
 * Choose a provider for a task. Prefers a configured provider on the target
 * tier, otherwise any configured provider (tier mismatch noted in rationale).
 */
export function routeTask(
  task: TaskKind,
  providers: ProviderDescriptor[] = loadProviders()
): RouteDecision {
  const tier = classifyTask(task);
  // Phase 4: when the fine-tuned model is configured it owns its tier —
  // it is the purpose-built model for these tasks; otherwise fall back to
  // the first configured provider on the tier, then to any configured one.
  const primary =
    providers.find((p) => p.configured && p.tier === tier && p.id === "cogwheel-tuned") ??
    providers.find((p) => p.configured && p.tier === tier) ??
    null;
  const sameTier = providers.filter((p) => p.configured && p.tier === tier && p.id !== primary?.id);
  const otherTier = providers.filter((p) => p.configured && p.tier !== tier);
  const fallback = [...sameTier, ...otherTier];

  let rationale = TIER_RATIONALE[tier];
  if (primary?.id === "cogwheel-tuned") {
    rationale = `${rationale} The fine-tuned SEO Studio model is configured and handles this tier.`;
  }
  if (!primary) {
    rationale = fallback.length
      ? `${rationale} No ${tier} provider configured — using a configured fallback.`
      : `${rationale} No provider configured — deterministic synthesizer will be used.`;
  }

  return { task, tier, provider: primary ?? fallback[0] ?? null, rationale, fallback };
}

/** Route every task kind in one pass (used for diagnostics and tests). */
export function routeAllTasks(
  providers: ProviderDescriptor[] = loadProviders()
): Record<TaskKind, RouteDecision> {
  const tasks: TaskKind[] = [...TIER1_TASKS, ...TIER2_TASKS];
  const result = {} as Record<TaskKind, RouteDecision>;
  for (const task of tasks) {
    result[task] = routeTask(task, providers);
  }
  return result;
}
