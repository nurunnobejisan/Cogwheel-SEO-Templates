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

import modelRegistryJson from "../../../data/models/model_registry.json";
import { isSafeEmbeddingsEndpoint } from "../../../ai/rag/embedder.ts";

export interface ReadyTasksProvenance {
  /** Must be "ml.serve.register" — the only writer allowed to widen scope. */
  by?: string;
  /** sha256 of the run_eval report the measured decision came from. */
  reportSha256?: string;
  /** ISO-8601 timestamp of the measured promotion decision. */
  measuredAt?: string;
}

export interface RegistryEntryShape {
  modelId?: string;
  baseModel?: string;
  status?: string;
  createdAt?: string;
  promotedAt?: string;
  /** Per-task adapter scope (v2 D-036). Empty until register.py widens it. */
  readyTasks?: string[];
  readyTasksProvenance?: ReadyTasksProvenance;
}

export interface ModelRegistryShape {
  activeModelId?: string | null;
  models?: RegistryEntryShape[];
}

/**
 * Returns false when `modelId` refers to a retired Gemini 1.5 Flash model or
 * matches any registry entry whose `status` is not `"ready"`.
 */
export function isRegistryModelSelectable(
  modelId: string,
  registry: ModelRegistryShape = modelRegistryJson,
): boolean {
  const trimmed = modelId.trim();
  if (!trimmed) return false;
  if (/^gemini-1\.5-flash/i.test(trimmed)) return false;

  const entry = registry.models?.find((m) => m.modelId === trimmed);
  if (entry) {
    return entry.status === "ready";
  }
  return true;
}

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
  const { endpoint, model } = getCustomModelSettings(env);
  return (
    endpoint.length > 0 &&
    isSafeEmbeddingsEndpoint(endpoint) &&
    isRegistryModelSelectable(model)
  );
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
  if (!isRegistryModelSelectable(settings.model)) {
    throw new CustomModelError(
      `Model '${settings.model}' is retired or not ready in model_registry.json and cannot be selected.`,
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

/**
 * The active `status: "ready"` registry entry, preferring the `activeModelId`
 * match, then the newest `promotedAt`/`createdAt`. `null` when none is ready —
 * the adapter is then used for **no task** (v2 D-036).
 */
export function getActiveReadyEntry(
  registry: ModelRegistryShape = modelRegistryJson,
): RegistryEntryShape | null {
  const models = registry.models ?? [];
  const ready = models.filter((m) => m.status === "ready");
  if (!ready.length) return null;
  const active = ready.find((m) => m.modelId === registry.activeModelId);
  if (active) return active;
  return [...ready].sort((a, b) =>
    String(b.promotedAt ?? b.createdAt ?? "").localeCompare(String(a.promotedAt ?? a.createdAt ?? "")),
  )[0];
}

/**
 * Per-task adapter scope of the active ready entry (v2 decision 1).
 *
 * Fail-closed provenance rule: a non-empty `readyTasks` list is honoured only
 * when it carries `readyTasksProvenance` written by `ml.serve.register` (a
 * 64-hex report sha and a measuredAt timestamp). Hand-edited scope without
 * provenance is treated as empty — nothing outside `register.py` can widen
 * the adapter's task set.
 */
export function getAdapterReadyTasks(
  registry: ModelRegistryShape = modelRegistryJson,
): readonly string[] {
  const entry = getActiveReadyEntry(registry);
  if (!entry) return [];
  const tasks = entry.readyTasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const provenance = entry.readyTasksProvenance;
  const provenanceOk =
    !!provenance &&
    provenance.by === "ml.serve.register" &&
    /^[0-9a-f]{64}$/.test(String(provenance.reportSha256 ?? "")) &&
    /^\d{4}-\d{2}-\d{2}T/.test(String(provenance.measuredAt ?? ""));
  if (!provenanceOk) return [];
  return tasks.filter((task): task is string => typeof task === "string" && task.length > 0);
}

/** True only when `task` is in the measured `readyTasks` of the active ready entry. */
export function isAdapterTaskReady(
  task: string | undefined | null,
  registry: ModelRegistryShape = modelRegistryJson,
): boolean {
  if (!task) return false;
  return getAdapterReadyTasks(registry).includes(task);
}
