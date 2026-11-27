import { describe, expect, it } from "vitest";
import {
  EmbeddingError,
  createEmbedderFromEnv,
  createHashingEmbedder,
  createHttpEmbedder,
  isSafeEmbeddingsEndpoint,
} from "../ai/rag/embedder";
import { createKnowledgeBase } from "../ai/rag/knowledge-base";
import { createRagPipeline } from "../ai/rag";
import type { Embedder, RagChunk } from "../ai/types";

/** Deterministic fake endpoint: every input gets a vector of `width`. */
function fakeFetch(
  width = 4,
  options: { status?: number; body?: string } = {},
): { fetchImpl: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (options.status !== undefined && options.status >= 400) {
      return new Response("boom", { status: options.status });
    }
    const body =
      options.body ??
      JSON.stringify({
        data: JSON.parse(String(init?.body)).input.map((text: string) => ({
          embedding: Array.from({ length: width }, (_, i) => (text.length + i) % 7),
        })),
      });
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const CHUNKS: RagChunk[] = [
  { id: "a", title: "Hotel schema", text: "Use Hotel JSON-LD for lodging pages.", source: "seed", tags: ["schema"] },
  { id: "b", title: "Robots txt", text: "Allow AI crawlers in robots.txt.", source: "seed", tags: ["technical"] },
];

describe("createEmbedderFromEnv", () => {
  it("falls back to the offline hashing embedder when the endpoint is unset", () => {
    const embedder = createEmbedderFromEnv({ env: {} });
    expect(embedder.id).toMatch(/^hashing-/);
    const vector = embedder.embed("hotel schema");
    expect(vector).toHaveLength(256);
    expect(embedder.embedBatch(["a", "b"])).toHaveLength(2);
  });

  it("returns an HttpEmbedder when EMBEDDINGS_ENDPOINT is set", () => {
    const embedder = createEmbedderFromEnv({
      env: { EMBEDDINGS_ENDPOINT: "https://api.example.com/v1/embeddings" },
    });
    expect(embedder.id).toMatch(/^http-/);
  });

  it("refuses to construct an unsafe endpoint (fail-closed, no hashing fallback)", () => {
    expect(() =>
      createEmbedderFromEnv({ env: { EMBEDDINGS_ENDPOINT: "http://localhost:9999" } }),
    ).toThrow(EmbeddingError);
  });
});

describe("isSafeEmbeddingsEndpoint", () => {
  const unsafe = [
    "file:///etc/passwd",
    "ftp://example.com/x",
    "not a url",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://10.1.2.3",
    "http://172.16.0.9",
    "http://192.168.1.10",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://service.internal",
    "http://db.local",
    "https://user:pass@example.com",
  ];
  for (const endpoint of unsafe) {
    it(`rejects ${endpoint}`, () => {
      expect(isSafeEmbeddingsEndpoint(endpoint)).toBe(false);
    });
  }

  const safe = [
    "https://api.example.com/v1/embeddings",
    "http://embeddings.example.org",
    "https://203.0.113.5:8443/embed",
  ];
  for (const endpoint of safe) {
    it(`accepts ${endpoint}`, () => {
      expect(isSafeEmbeddingsEndpoint(endpoint)).toBe(true);
    });
  }
});

describe("HttpEmbedder", () => {
  it("POSTs {input:[...]} and parses the OpenAI response shape", async () => {
    const { fetchImpl, calls } = fakeFetch(4);
    const embedder = createHttpEmbedder("https://api.example.com/embed", { fetchImpl });
    const vectors = await embedder.embedBatchAsync!(["hello", "world"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.example.com/embed");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ input: ["hello", "world"] });
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(4);
    expect(embedder.dimensions).toBe(4); // advisory 1536 replaced by actual width
  });

  it("sends a bearer token only when an apiKey is configured", async () => {
    const withKey = fakeFetch();
    const embedderA = createHttpEmbedder("https://api.example.com/embed", {
      fetchImpl: withKey.fetchImpl,
      apiKey: "secret",
    });
    await embedderA.embedAsync("x");
    expect(withKey.calls[0]!.init?.headers).toMatchObject({ authorization: "Bearer secret" });

    const withoutKey = fakeFetch();
    const embedderB = createHttpEmbedder("https://api.example.com/embed", {
      fetchImpl: withoutKey.fetchImpl,
    });
    await embedderB.embedAsync("x");
    expect(withoutKey.calls[0]!.init?.headers).not.toHaveProperty("authorization");
  });

  it("caches repeated texts instead of re-requesting", async () => {
    const { fetchImpl, calls } = fakeFetch();
    const embedder = createHttpEmbedder("https://api.example.com/embed", { fetchImpl });
    await embedder.embedAsync("same text");
    await embedder.embedAsync("same text");
    expect(calls).toHaveLength(1);
  });

  it("throws from the synchronous pair instead of mixing vector spaces", () => {
    const { fetchImpl } = fakeFetch();
    const embedder = createHttpEmbedder("https://api.example.com/embed", { fetchImpl });
    expect(() => embedder.embed("x")).toThrow(EmbeddingError);
    expect(() => embedder.embedBatch(["x"])).toThrow(EmbeddingError);
  });

  it("fails closed on non-2xx, invalid JSON, count mismatch and width drift", async () => {
    const failing = fakeFetch(4, { status: 503 });
    const e1 = createHttpEmbedder("https://api.example.com/embed", { fetchImpl: failing.fetchImpl });
    await expect(e1.embedAsync("x")).rejects.toThrow("HTTP 503");

    const badJson = fakeFetch(4, { body: "<html>nope</html>" });
    const e2 = createHttpEmbedder("https://api.example.com/embed", { fetchImpl: badJson.fetchImpl });
    await expect(e2.embedAsync("x")).rejects.toThrow("invalid JSON");

    const short = fakeFetch(4, { body: JSON.stringify({ data: [] }) });
    const e3 = createHttpEmbedder("https://api.example.com/embed", { fetchImpl: short.fetchImpl });
    await expect(e3.embedAsync("x")).rejects.toThrow("0 vectors for 1 inputs");

    let width = 4;
    const drift = (async () => {
      width = width === 4 ? 8 : 4;
      return new Response(
        JSON.stringify({ data: [{ embedding: Array.from({ length: width }, () => 1) }] }),
        { status: 200 },
      );
    }) as typeof fetch;
    const e4 = createHttpEmbedder("https://api.example.com/embed", { fetchImpl: drift });
    await e4.embedAsync("x");
    await expect(e4.embedAsync("y")).rejects.toThrow("refusing to mix vector spaces");
  });

  it("rejects an unsafe endpoint at construction", () => {
    expect(() => createHttpEmbedder("http://127.0.0.1:8080")).toThrow(EmbeddingError);
  });
});

describe("knowledge base with an async embedder", () => {
  function asyncEmbedder(width = 4, fail = false): Embedder {
    const { fetchImpl } = fakeFetch(width);
    const http = createHttpEmbedder("https://api.example.com/embed", { fetchImpl });
    if (fail) {
      const failing = fakeFetch(width, { status: 500 });
      return createHttpEmbedder("https://api.example.com/embed", {
        fetchImpl: failing.fetchImpl,
      });
    }
    return http;
  }

  it("queues upserts and serves them via searchAsync", async () => {
    const kb = createKnowledgeBase(asyncEmbedder());
    kb.upsert(CHUNKS);
    const results = await kb.searchAsync("Hotel JSON-LD", { topK: 2 });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id).sort()).toEqual(["a", "b"]);
    for (const result of results) {
      expect(Number.isFinite(result.score)).toBe(true);
    }
    expect(await kb.ready()).toBeUndefined();
    expect(kb.size()).toBe(2);
  });

  it("throws from the synchronous search instead of returning wrong-space vectors", () => {
    const kb = createKnowledgeBase(asyncEmbedder());
    kb.upsert(CHUNKS);
    expect(() => kb.search("anything")).toThrow(/searchAsync/);
  });

  it("fails closed and stays failed when the endpoint errors", async () => {
    const kb = createKnowledgeBase(asyncEmbedder(4, true));
    kb.upsert(CHUNKS);
    await expect(kb.searchAsync("query")).rejects.toThrow("HTTP 500");
    // Sticky: a later read must not silently serve an empty/partial index.
    await expect(kb.searchAsync("query")).rejects.toThrow("HTTP 500");
    await expect(kb.ready()).rejects.toThrow("HTTP 500");
  });
});

describe("createRagPipeline with an injected embedder", () => {
  it("embeds the seed corpus in the background and answers searchAsync", async () => {
    const pipeline = createRagPipeline({ embedder: asyncEmbedderForPipeline() });
    await pipeline.ready();
    expect(pipeline.size()).toBeGreaterThan(10);
    const hits = await pipeline.knowledgeBase.searchAsync("What did the GEO paper find?", {
      topK: 3,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.source).toBeTruthy();
  });
});

function asyncEmbedderForPipeline(): Embedder {
  const { fetchImpl } = fakeFetch(8);
  return createHttpEmbedder("https://api.example.com/embed", { fetchImpl });
}

describe("hashing embedder (unchanged default)", () => {
  it("stays deterministic and synchronous", () => {
    const a = createHashingEmbedder(64);
    const b = createHashingEmbedder(64);
    expect(a.embed("hotel schema")).toEqual(b.embed("hotel schema"));
    expect(a.embedAsync).toBeUndefined();
  });
});
