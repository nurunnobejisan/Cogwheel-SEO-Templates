/**
 * Server-side client for the FastAPI Python service (`api/server.py`).
 *
 * Configuration is read from server env only — never from a request — so a
 * caller cannot steer these fetches (no SSRF vector through the bridge):
 *
 *   PYTHON_SERVICE_URL    Base URL of the service; unset disables the bridge
 *                         entirely (callers fall through to their next path).
 *   SEO_PY_SERVICE_TOKEN  Bearer token, sent when the service requires one.
 *
 * Fail-closed behaviour:
 *   - unset config  → `pythonServiceConfig()` returns null (bridge off);
 *   - unusable config (bad URL, non-http scheme) → throws, never silently
 *     falls back to a different transport;
 *   - transport errors/timeouts → `PythonServiceError` with status 502 and a
 *     generic message (no connection details leak to operators);
 *   - upstream error bodies are read capped and only a short string `detail`
 *     is ever surfaced — never an echoed stack or HTML error page.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const UPSTREAM_DETAIL_CAP = 4_096;

export class PythonServiceError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PythonServiceError";
    this.status = status;
  }
}

export interface PythonServiceConfig {
  baseUrl: string;
  token?: string;
}

/**
 * Resolve the bridge configuration.
 *
 * @returns null when `PYTHON_SERVICE_URL` is unset (bridge disabled).
 * @throws {PythonServiceError} when the configured URL is unusable — a
 *   misconfigured bridge must surface loudly, not degrade to another path.
 */
export function pythonServiceConfig(): PythonServiceConfig | null {
  const raw = process.env.PYTHON_SERVICE_URL?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PythonServiceError("PYTHON_SERVICE_URL is not a valid URL", 500);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PythonServiceError("PYTHON_SERVICE_URL must be an http(s) URL", 500);
  }

  const token = process.env.SEO_PY_SERVICE_TOKEN?.trim();
  return token
    ? { baseUrl: raw.replace(/\/+$/, ""), token }
    : { baseUrl: raw.replace(/\/+$/, "") };
}

interface CallOptions {
  method?: "GET" | "POST";
  /** JSON request body (sets Content-Type: application/json). */
  json?: unknown;
  /** Multipart body — the boundary is set by fetch. */
  formData?: FormData;
  timeoutMs?: number;
}

async function upstreamDetail(res: Response): Promise<string> {
  try {
    const text = (await readBodyCapped(res, UPSTREAM_DETAIL_CAP)).trim();
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.length > 0 && parsed.detail.length <= 300) {
      return parsed.detail;
    }
  } catch {
    // Non-JSON or oversized error body: fall through to the generic message.
  }
  return `Python service returned ${res.status}`;
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        if (total >= maxBytes) break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= merged.byteLength) break;
    const slice = chunk.subarray(0, merged.byteLength - offset);
    merged.set(slice, offset);
    offset += slice.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/**
 * Call the Python service and return the raw ok-Response.
 *
 * @throws {PythonServiceError} when unconfigured (501), the transport fails or
 *   times out (502), or the service answers with a non-2xx status (upstream
 *   status preserved for 4xx so auth/validation failures stay recognisable).
 */
export async function callPythonService(path: string, options: CallOptions = {}): Promise<Response> {
  const config = pythonServiceConfig();
  if (!config) {
    throw new PythonServiceError("Python service is not configured", 501);
  }

  const { method = "POST", json, formData, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const headers: Record<string, string> = {};
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  let body: BodyInit | undefined;
  if (formData) {
    body = formData;
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const cause = err as Error;
    const timedOut = cause.name === "TimeoutError" || cause.name === "AbortError";
    throw new PythonServiceError(
      timedOut ? "Python service request timed out" : "Python service is unreachable",
      502,
    );
  }

  if (!res.ok) {
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new PythonServiceError(await upstreamDetail(res), status);
  }
  return res;
}

/** Call the Python service and parse a JSON body from the ok-Response. */
export async function callPythonServiceJson<T>(path: string, options: CallOptions = {}): Promise<T> {
  const res = await callPythonService(path, options);
  try {
    return (await res.json()) as T;
  } catch {
    throw new PythonServiceError("Python service returned an invalid response", 502);
  }
}
