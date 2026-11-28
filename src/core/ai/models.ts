/**
 * Central AI model configuration.
 *
 * Free-first by design: SEO Studio defaults to providers that are usable on a free
 * tier and never *requires* a paid key. A paid key (ANTHROPIC_API_KEY) is opt-in;
 * if it is absent the drafting client falls through the free providers below.
 *
 * Every model id is env-overridable, so a newer model can be adopted without a
 * code change. The ids here are the current (late-2026) names; the ones that a
 * paid key unlocks are only reached when that key is present.
 */

export type ProviderId = "anthropic" | "gemini" | "groq" | "openrouter" | "pollinations";

export interface ProviderModel {
  id: ProviderId;
  label: string;
  /** Current model id (or the env override). */
  model: string;
  /** Env var that overrides `model`. */
  envVar: string;
  /** True when the provider is usable without a paid key. */
  free: boolean;
  /** Credential env var(s). Empty for keyless providers (Pollinations). */
  requires: string[];
}

/**
 * Resolve the provider/model table from the environment. Defaults favour free
 * tiers; a paid model is only listed (and only used) when its key is set.
 */
export function resolveProviderModels(env: NodeJS.ProcessEnv = process.env): ProviderModel[] {
  return [
    {
      id: "anthropic",
      label: "Anthropic Claude",
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      envVar: "ANTHROPIC_MODEL",
      free: false,
      requires: ["ANTHROPIC_API_KEY"],
    },
    {
      id: "gemini",
      label: "Google Gemini Flash",
      model: env.GEMINI_MODEL || "gemini-3.8-flash",
      envVar: "GEMINI_MODEL",
      free: true,
      requires: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"],
    },
    {
      id: "groq",
      label: "Groq Llama",
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      envVar: "GROQ_MODEL",
      free: true,
      requires: ["GROQ_API_KEY"],
    },
    {
      id: "openrouter",
      label: "OpenRouter (free models)",
      model: env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      envVar: "OPENROUTER_MODEL",
      free: true,
      requires: ["OPENROUTER_API_KEY"],
    },
    {
      id: "pollinations",
      label: "Pollinations (keyless)",
      model: env.POLLINATIONS_MODEL || "openai",
      envVar: "POLLINATIONS_MODEL",
      free: true,
      requires: [],
    },
  ];
}

/** The resolved model id for one provider. */
export function modelFor(id: ProviderId, env: NodeJS.ProcessEnv = process.env): string {
  return resolveProviderModels(env).find((provider) => provider.id === id)?.model ?? "";
}

/** True when the provider is usable without paying (free tier or keyless). */
export function isFreeProvider(id: ProviderId): boolean {
  return resolveProviderModels().find((provider) => provider.id === id)?.free ?? false;
}

/**
 * Free providers in the order the drafting client tries them. Anthropic is not
 * included: it is only attempted when its paid key is present.
 */
export function freeProviderOrder(env: NodeJS.ProcessEnv = process.env): ProviderId[] {
  return resolveProviderModels(env)
    .filter((provider) => provider.free)
    .map((provider) => provider.id);
}
