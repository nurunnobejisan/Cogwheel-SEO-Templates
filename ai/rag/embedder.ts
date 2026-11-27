/**
 * Deterministic hashing embedder (Phase 2)
 *
 * Dependency-free, offline embedding so the RAG pipeline works in CI, the
 * backend, and the extension without an external API key. The hashing-trick
 * bigram/trigram model captures lexical-semantic overlap well enough for
 * retrieving the small, curated SEO knowledge base.
 *
 * Swap in a provider embedder (Voyage/OpenAI/Gemini) by implementing Embedder.
 */

import type { Embedder } from "../types.ts";

const TOKEN_PATTERN = /[a-z0-9]+/g;
const UNIGRAM_WEIGHT = 1;
const BIGRAM_WEIGHT = 0.6;

/** FNV-1a 32-bit hash. */
function hashToken(token: string, seed: number): number {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

function accumulate(vector: number[], token: string, weight: number, dimensions: number): void {
  const index = hashToken(token, 0) % dimensions;
  const sign = (hashToken(token, 0x9e3779b1) & 1) === 0 ? 1 : -1;
  vector[index] = (vector[index] ?? 0) + sign * weight;
}

function l2Normalize(vector: number[]): number[] {
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  if (norm === 0) {
    return vector;
  }
  const scale = 1 / Math.sqrt(norm);
  return vector.map((value) => value * scale);
}

export function createHashingEmbedder(dimensions = 256): Embedder {
  const embed = (text: string): number[] => {
    const vector = new Array<number>(dimensions).fill(0);
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      accumulate(vector, token, UNIGRAM_WEIGHT, dimensions);
      if (i > 0) {
        accumulate(vector, `${tokens[i - 1]} ${token}`, BIGRAM_WEIGHT, dimensions);
      }
    }
    return l2Normalize(vector);
  };

  return {
    id: `hashing-${dimensions}`,
    dimensions,
    embed,
    embedBatch(texts: string[]) {
      return texts.map(embed);
    },
  };
}

/* ----------------------------------------------------- HTTP embedder ------ */

/**
 * Raised when `EMBEDDINGS_ENDPOINT` rejects a request or returns something
 * unparseable. Fail-closed: the caller sees the error instead of a silent
 * fallback to hashing, because mixing hashing query vectors with HTTP chunk
 * vectors would corrupt retrieval without any visible failure (D-018).
 */
export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

const PRIVATE_V4_PATTERNS: Array<(parts: number[]) => boolean> = [
  (p) => p[0] === 0, // 0.0.0.0/8 "this network"
  (p) => p[0] === 10, // 10.0.0.0/8
  (p) => p[0] === 127, // loopback
  (p) => p[0] === 169 && p[1] === 254, // link-local / cloud metadata
  (p) => p[0] === 172 && p[1] >= 16 && p[1] <= 31, // 172.16.0.0/12
  (p) => p[0] === 192 && p[1] === 168, // 192.168.0.0/16
  (p) => p[0] === 100 && p[1] >= 64 && p[1] <= 127, // CGNAT 100.64.0.0/10
];

function isPrivateLiteralHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan")
  ) {
    return true;
  }
  // IPv6: loopback ::1, link-local fe80::/10, unique-local fc00::/7.
  if (host.includes(":")) {
    return host === "::1" || host === "::" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  }
  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return PRIVATE_V4_PATTERNS.some((match) => match(parts));
  }
  return false;
}

/**
 * Syntactic SSRF check for the embeddings endpoint: http(s) only, no
 * credentials, no private/internal literal hosts. DNS resolution is handled
 * per request by `safeFetch` (src/lib/security/egress.ts), which re-validates
 * every redirect hop.
 */
export function isSafeEmbeddingsEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  if (url.username || url.password) {
    return false;
  }
  return !isPrivateLiteralHost(url.hostname);
}

export interface HttpEmbedderOptions {
  /** Request timeout in milliseconds (default 10s). */
  timeoutMs?: number;
  /** Optional bearer token sent as `Authorization: Bearer …`. */
  apiKey?: string;
  /**
   * Advisory vector width before the first response (default 1536). The
   * actual width is taken from the first response and enforced afterwards.
   */
  dimensions?: number;
  /** Injected fetch for tests; production uses the SSRF-guarded `safeFetch`. */
  fetchImpl?: typeof fetch;
  /** Response cap in bytes (default 8 MB — one vector batch is small). */
  maxResponseBytes?: number;
}

/** How many distinct texts to keep vectors for (bounds memory). */
const EMBEDDING_CACHE_LIMIT = 4096;

/** An embedder that is guaranteed to carry the async pair. */
export interface HttpEmbedder extends Embedder {
  embedAsync(text: string): Promise<number[]>;
  embedBatchAsync(texts: string[]): Promise<number[][]>;
}

/**
 * OpenAI-compatible embeddings client (POST `{ input: string[] }`).
 *
 * Synchronous `embed`/`embedBatch` throw by design — use `embedAsync` /
 * `embedBatchAsync`, or the knowledge base's `searchAsync`, which awaits the
 * queue. The endpoint is validated at construction (syntactic SSRF guard) and
 * on every request (DNS-aware via `safeFetch`).
 */
export function createHttpEmbedder(
  endpoint: string,
  options: HttpEmbedderOptions = {},
): HttpEmbedder {
  if (!isSafeEmbeddingsEndpoint(endpoint)) {
    throw new EmbeddingError(
      `EMBEDDINGS_ENDPOINT failed the SSRF guard (https required, no private hosts): ${endpoint}`,
    );
  }

  const {
    timeoutMs = 10_000,
    apiKey,
    dimensions: advisoryDimensions = 1536,
    fetchImpl,
    maxResponseBytes = 8_000_000,
  } = options;

  const cache = new Map<string, number[]>();
  let dimensions = advisoryDimensions;
  let widthLocked = false;

  const remember = (text: string, vector: number[]): void => {
    if (cache.size >= EMBEDDING_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
    cache.set(text, vector);
  };

  const validateWidth = (vectors: number[][]): void => {
    for (const vector of vectors) {
      if (vector.length === 0 || vector.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
        throw new EmbeddingError("embeddings endpoint returned a non-numeric or empty vector");
      }
      if (!widthLocked) {
        dimensions = vector.length;
        widthLocked = true;
      } else if (vector.length !== dimensions) {
        throw new EmbeddingError(
          `embeddings endpoint returned width ${vector.length}, expected ${dimensions} — refusing to mix vector spaces`,
        );
      }
    }
  };

  const request = async (texts: string[]): Promise<number[][]> => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    const body = JSON.stringify({ input: texts });

    let response: Response;
    if (fetchImpl) {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } else {
      // Lazy: keeps `node:dns` out of any bundle that never constructs an
      // HttpEmbedder (ai/rag is imported by client-adjacent code paths).
      const { safeFetch } = await import("../../src/lib/security/egress.ts");
      const result = await safeFetch(
        endpoint,
        { method: "POST", headers, body },
        { timeoutMs, maxRedirects: 0 },
      );
      response = result.response;
    }

    if (!response.ok) {
      // Never log the body: it may echo request text (no prompt logging).
      throw new EmbeddingError(`embeddings endpoint returned HTTP ${response.status}`);
    }

    const text = await response.text();
    if (text.length > maxResponseBytes) {
      throw new EmbeddingError("embeddings response exceeded the size cap");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new EmbeddingError("embeddings endpoint returned invalid JSON");
    }

    // Accept the OpenAI shape `{ data: [{ embedding }] }`, `{ embeddings: [[]] }`,
    // and a bare `[[]]`.
    let vectors: number[][] | null = null;
    if (Array.isArray(parsed)) {
      vectors = parsed as number[][];
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.data)) {
        vectors = record.data.map((entry) => {
          const embedding = (entry as Record<string, unknown>)?.embedding;
          if (!Array.isArray(embedding)) {
            throw new EmbeddingError("embeddings endpoint `data` entry has no `embedding` array");
          }
          return embedding as number[];
        });
      } else if (Array.isArray(record.embeddings)) {
        vectors = record.embeddings as number[][];
      }
    }
    if (!vectors || vectors.length !== texts.length) {
      throw new EmbeddingError(
        `embeddings endpoint returned ${vectors?.length ?? 0} vectors for ${texts.length} inputs`,
      );
    }
    validateWidth(vectors);
    return vectors;
  };

  const embedBatchAsync = async (texts: string[]): Promise<number[][]> => {
    const out: number[][] = new Array(texts.length);
    const misses: Array<{ index: number; text: string }> = [];
    texts.forEach((text, index) => {
      const cached = cache.get(text);
      if (cached) {
        out[index] = cached;
      } else {
        misses.push({ index, text });
      }
    });
    if (misses.length > 0) {
      const fetched = await request(misses.map((miss) => miss.text));
      misses.forEach((miss, position) => {
        out[miss.index] = fetched[position]!;
        remember(miss.text, fetched[position]!);
      });
    }
    return out;
  };

  const asyncOnly = (method: string): never => {
    throw new EmbeddingError(
      `HttpEmbedder.${method} is async-only — use embedAsync/embedBatchAsync (or searchAsync on the knowledge base)`,
    );
  };

  return {
    id: `http-${new URL(endpoint).host}`,
    get dimensions() {
      return dimensions;
    },
    embed(): number[] {
      return asyncOnly("embed");
    },
    embedBatch(): number[][] {
      return asyncOnly("embedBatch");
    },
    async embedAsync(text: string): Promise<number[]> {
      const [vector] = await embedBatchAsync([text]);
      return vector!;
    },
    embedBatchAsync,
  };
}

export interface EmbedderFromEnvOptions extends HttpEmbedderOptions {
  /** Environment to read (default: `process.env` when available). */
  env?: Record<string, string | undefined>;
}

/**
 * Resolve the pipeline embedder from configuration:
 *
 * - `EMBEDDINGS_ENDPOINT` unset → deterministic offline hashing embedder
 *   (CI and the extension keep working with no network — the Phase 0 rule);
 * - set → SSRF-validated `HttpEmbedder`. Construction throws on an unsafe
 *   endpoint; there is no per-request fallback to hashing (D-018), because a
 *   silent fallback would mix vector spaces.
 */
export function createEmbedderFromEnv(options: EmbedderFromEnvOptions = {}): Embedder {
  const env =
    options.env ?? (typeof process !== "undefined" ? process.env : undefined);
  const endpoint = env?.EMBEDDINGS_ENDPOINT?.trim();
  if (!endpoint) {
    return createHashingEmbedder(options.dimensions ?? 256);
  }
  const { env: _env, ...httpOptions } = options;
  return createHttpEmbedder(endpoint, httpOptions);
}
