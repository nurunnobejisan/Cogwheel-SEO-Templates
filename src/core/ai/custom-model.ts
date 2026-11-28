/**
 * SEO Studio fine-tuned model client (`CUSTOM_MODEL_*`).
 *
 * The server-side twin of `chrome-extension/src/engine/custom-model-client.ts`:
 * it calls an OpenAI-compatible `/v1/chat/completions` endpoint — typically
 * `ml/serve/server.py` in front of a Phase 3 adapter — and is the first
 * provider `generateClaudeText` tries when `CUSTOM_MODEL_ENDPOINT` is set.
 *
 * Security (docs/PLATFORM_RUNTIME.md):
 * - the endpoint is read from **env only**, never from a request body;
 * - it passes the same syntactic SSRF check as `EMBEDDINGS_ENDPOINT`
 *   (`isSafeEmbeddingsEndpoint`) at call time, and every request goes through
 *   the DNS-aware `safeFetch` (src/lib/security/egress.ts) — loopback and
 *   private hosts are refused, so the model server must be reachable on a
 *   public address;
 * - failures throw `CustomModelError` and the caller falls through to the
 *   existing providers (never a hard dependency).
 *
 * Standard library + existing app utilities only; no new dependencies.
 */

import { isSafeEmbeddingsEndpoint } from "../../../ai/rag/embedder.ts";

/** Thrown for any tuned-model failure: misconfiguration, guard, HTTP or shape. */
export class CustomModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomModelError";
  }
}

export interface CustomModelSettings {
  /** Trimmed endpoint; empty string when unset. */
  endpoint: string;
  /** Model id sent in the request body. */
  model: string;
  /** Optional bearer token. */
  apiKey?: string;
}

/** Read `CUSTOM_MODEL_*` from the environment (all optional). */
export function getCustomModelSettings(
  env: Record<string, string | undefined> = process.env,
): CustomModelSettings {
  const endpoint = (env.CUSTOM_MODEL_ENDPOINT ?? "").trim();
  const model = (env.CUSTOM_MODEL_ID ?? "").trim() || "seo-studio-unified";
  const apiKey = (env.CUSTOM_MODEL_API_KEY ?? "").trim();
  return { endpoint, model, ...(apiKey ? { apiKey } : {}) };
}

/**
 * True only when an endpoint is set **and** it passes the SSRF guard — an
 * unsafe endpoint reports as unconfigured so the router falls back instead
 * of attempting a call (fail closed).
 */
export function isCustomModelConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const { endpoint } = getCustomModelSettings(env);
  return endpoint.length > 0 && isSafeEmbeddingsEndpoint(endpoint);
}

export interface CustomModelCallOptions {
  system: string;
  prompt: string;
  maxTokens: number;
  /** Defaults to the pinned drafting temperature (0.2). */
  temperature?: number;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  /** Injected fetch for tests; production uses the SSRF-guarded `safeFetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * POST `{model, temperature, max_tokens, messages}` to the tuned endpoint and
 * return the assistant text. Throws `CustomModelError` on any failure so the
 * caller can record the reason and fall through to the next provider.
 */
export async function callCustomModel(opts: CustomModelCallOptions): Promise<string> {
  const env = opts.env ?? process.env;
  const settings = getCustomModelSettings(env);
  if (!settings.endpoint) {
    throw new CustomModelError("CUSTOM_MODEL_ENDPOINT is not set");
  }
  if (!isSafeEmbeddingsEndpoint(settings.endpoint)) {
    throw new CustomModelError(
      `CUSTOM_MODEL_ENDPOINT failed the SSRF guard (https required, no private hosts): ${settings.endpoint}`,
    );
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
  const init: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: settings.model,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
    }),
  };

  let res: Response;
  if (opts.fetchImpl) {
    res = await opts.fetchImpl(settings.endpoint, init);
  } else {
    const { safeFetch } = await import("../../lib/security/egress.ts");
    const result = await safeFetch(settings.endpoint, init, {
      timeoutMs: opts.timeoutMs ?? 30_000,
    });
    res = result.response;
  }

  if (!res.ok) {
    throw new CustomModelError(`fine-tuned endpoint HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new CustomModelError("fine-tuned endpoint returned no assistant content");
  }
  return content;
}
