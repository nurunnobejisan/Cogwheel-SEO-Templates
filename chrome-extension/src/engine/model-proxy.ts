/**
 * SEO & GEO Studio — Model Inference Proxy (v2 WP8, decision D-037)
 *
 * The extension NEVER calls a fine-tuned model endpoint directly. All tuned
 * inference goes through the SEO Studio backend (`/api/extension/infer`),
 * which owns the endpoint configuration, the API key, `AI_ADAPTER_MODE`
 * rollout state, output gates and monitoring. The extension only ever holds
 * the app origin + operator token it already uses for training-data sync.
 *
 * Guarantees:
 * - origin guard: https-only (loopback http allowed for local dev), no
 *   userinfo, no raw-IP private/loopback hosts in production origins;
 * - no model credentials are stored in or sent from the extension;
 * - any proxy failure degrades to the deterministic rules engine — the
 *   extension never invents copy and never surfaces a raw provider error.
 */

/** Result of an inference request through the app backend. */
export type ModelProxyResult =
  | { ok: true; output: string; source: "adapter" | "standard"; latencyMs: number }
  | { ok: false; reason: string };

/**
 * True when `origin` may be used as the inference proxy target:
 * https origin without userinfo and without a private/loopback raw-IP host.
 * Plain http is accepted only for explicit loopback origins (local dev).
 */
export function isAllowedProxyOrigin(origin: string): boolean {
  const trimmed = (origin || "").trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.pathname && parsed.pathname !== "/" && parsed.pathname !== "") return false;
  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (parsed.protocol === "http:" && !isLoopback) return false;
  if (!isLoopback && isPrivateOrLocalHost(host)) return false;
  return true;
}

function isPrivateOrLocalHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  // Raw IPv4 — refuse private / loopback / link-local ranges.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false; // public IPv4 host is fine (rare but valid)
  }
  // IPv6 literal — refuse anything not globally scoped (best effort).
  if (host.startsWith("[")) return !/^\[200[0-9a-f]:/i.test(host) && host !== "[::1]" ? true : false;
  return false;
}

/**
 * Extract the proxy origin from the configured training API URL (which may
 * point at `/api/ai-training`), falling back to the deployment default.
 * Returns null when nothing usable is configured — callers fall back to the
 * rules engine instead of guessing.
 */
export function resolveProxyOrigin(apiUrl: string): string | null {
  const raw = (apiUrl || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const origin = `${parsed.protocol}//${parsed.host}`;
    return isAllowedProxyOrigin(origin) ? origin : null;
  } catch {
    return null;
  }
}

export interface ModelProxyRequest {
  /** Router task kind, e.g. "metadata_generation" or "schema_generation". */
  task: string;
  /** Fully composed prompt (the backend owns the system prompt + gates). */
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelProxyOptions {
  /** App origin (from extension options `apiUrl`) or explicit origin. */
  apiUrl: string;
  /** Operator API token configured in the extension options. */
  apiToken: string;
}

/**
 * POST one inference request to the app backend. Never throws: every failure
 * path returns `{ ok: false, reason }` so callers fall back to the rules
 * engine. Timeboxed at 20s so Auto-Fix stays interactive.
 */
export async function inferViaAppBackend(
  request: ModelProxyRequest,
  options: ModelProxyOptions,
  fetchFn: typeof fetch = fetch,
): Promise<ModelProxyResult> {
  const origin = resolveProxyOrigin(options.apiUrl);
  if (!origin) {
    return { ok: false, reason: "no app backend configured (or origin refused by the guard)" };
  }
  if (!options.apiToken.trim()) {
    return { ok: false, reason: "no API token configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const start = Date.now();
  try {
    const response = await fetchFn(`${origin}/api/extension/infer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiToken.trim()}`,
      },
      body: JSON.stringify({
        task: request.task,
        prompt: request.prompt,
        maxTokens: request.maxTokens ?? 1024,
        temperature: request.temperature,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    if (!response.ok) {
      return { ok: false, reason: `backend returned HTTP ${response.status}` };
    }
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      output?: unknown;
      source?: unknown;
    } | null;
    if (!payload || payload.ok !== true || typeof payload.output !== "string" || !payload.output.trim()) {
      return { ok: false, reason: "backend returned no usable output" };
    }
    const source = payload.source === "adapter" ? "adapter" : "standard";
    return { ok: true, output: payload.output, source, latencyMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `backend unreachable: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}
