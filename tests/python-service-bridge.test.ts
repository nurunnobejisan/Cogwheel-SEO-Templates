/**
 * Phase D — HTTP bridge between the Next.js app and the FastAPI Python
 * service (`api/server.py`).
 *
 * Locks three things:
 *  1. `@/lib/python/service` — env-only config (never request-derived), bearer
 *     propagation, timeouts, and fail-closed error mapping;
 *  2. `POST /api/content-similarity` — zod caps mirroring the Python side,
 *     501 when the bridge is off, no upstream internals echoed;
 *  3. `POST /api/seo-visibility-report` — the generation chain: HTTP bridge
 *     first (PYTHON_SERVICE_URL), then the local execFile opt-in, then 501.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  PythonServiceError,
  callPythonService,
  callPythonServiceJson,
  pythonServiceConfig,
} from "@/lib/python/service";
import { POST as similarityPost } from "@/app/api/content-similarity/route";
import { POST as reportPost } from "@/app/api/seo-visibility-report/route";

const ENV_KEYS = [
  "PYTHON_SERVICE_URL",
  "SEO_PY_SERVICE_TOKEN",
  "SEO_STUDIO_ALLOW_LOCAL_PYTHON",
] as const;

let savedEnv: Record<string, string | undefined> = {};

function setEnv(entries: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (!(key in entries)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  setEnv({});
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv = {};
  vi.unstubAllGlobals();
});

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl as never);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Client configuration — env-only, fail-closed
// ─────────────────────────────────────────────────────────────────────────────
describe("pythonServiceConfig", () => {
  it("returns null when PYTHON_SERVICE_URL is unset (bridge off)", () => {
    expect(pythonServiceConfig()).toBeNull();
  });

  it("reads the base URL and optional token from env, stripping trailing slashes", () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077/", SEO_PY_SERVICE_TOKEN: "s3cret" });
    expect(pythonServiceConfig()).toEqual({
      baseUrl: "http://127.0.0.1:8077",
      token: "s3cret",
    });
  });

  it("throws on an unusable URL instead of silently disabling the bridge", () => {
    setEnv({ PYTHON_SERVICE_URL: "not a url" });
    expect(() => pythonServiceConfig()).toThrow(PythonServiceError);
    setEnv({ PYTHON_SERVICE_URL: "ftp://files.example.com" });
    expect(() => pythonServiceConfig()).toThrow(/http\(s\)/);
  });
});

describe("callPythonService", () => {
  it("fails closed with 501 when unconfigured", async () => {
    await expect(callPythonService("/v1/health")).rejects.toMatchObject({
      status: 501,
      name: "PythonServiceError",
    });
  });

  it("sends JSON with the bearer token and returns the ok response", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077", SEO_PY_SERVICE_TOKEN: "t0k" });
    const fetchMock = mockFetch(() => jsonResponse({ ok: true }));

    const res = await callPythonService("/v1/content/similarity", { json: { pages: [] } });
    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8077/v1/content/similarity");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t0k");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ pages: [] }));
  });

  it("maps upstream 4xx to the upstream status with its short detail", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077" });
    mockFetch(() => jsonResponse({ detail: "Unauthorized" }, 401));

    await expect(callPythonService("/v1/x")).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized",
    });
  });

  it("maps upstream 5xx to 502 without echoing the body", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077" });
    mockFetch(() => new Response("<html>traceback</html>", { status: 500 }));

    await expect(callPythonService("/v1/x")).rejects.toMatchObject({
      status: 502,
      message: "Python service returned 500",
    });
  });

  it("maps transport failures to a generic 502", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077" });
    mockFetch(() => Promise.reject(new TypeError("fetch failed")));

    await expect(callPythonService("/v1/x")).rejects.toMatchObject({
      status: 502,
      message: "Python service is unreachable",
    });
  });

  it("maps timeouts to a generic 502", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077" });
    const timeoutError = new Error("The operation was aborted");
    timeoutError.name = "TimeoutError";
    mockFetch(() => Promise.reject(timeoutError));

    await expect(callPythonService("/v1/x", { timeoutMs: 5 })).rejects.toMatchObject({
      status: 502,
      message: "Python service request timed out",
    });
  });

  it("rejects an ok response with an unparseable body", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077" });
    mockFetch(() => new Response("not json", { status: 200 }));

    await expect(callPythonServiceJson("/v1/x")).rejects.toMatchObject({
      status: 502,
      message: "Python service returned an invalid response",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bridge route: POST /api/content-similarity
// ─────────────────────────────────────────────────────────────────────────────
function similarityRequest(body: unknown): Request {
  return new Request("http://localhost/api/content-similarity", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validPages = {
  pages: [
    { id: "a", url: "https://example.com/a", content: "alpha content" },
    { id: "b", content: "beta content" },
  ],
};

describe("POST /api/content-similarity", () => {
  it("answers 501 when the bridge is not configured", async () => {
    const res = await similarityPost(similarityRequest(validPages));
    expect(res.status).toBe(501);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("python_service_unconfigured");
  });

  it("rejects malformed JSON before any config or network work", async () => {
    const res = await similarityPost(similarityRequest("not json"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("invalid_json");
  });

  it("applies the same payload caps as api/server.py", async () => {
    const tooMany = { pages: Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, content: "x" })) };
    const res = await similarityPost(similarityRequest(tooMany));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; issues: unknown[] };
    expect(body.code).toBe("invalid_payload");
    expect(body.issues.length).toBeGreaterThan(0);

    const tooBig = { pages: [{ id: "a", content: "x".repeat(200_001) }] };
    const res2 = await similarityPost(similarityRequest(tooBig));
    expect(res2.status).toBe(400);
  });

  it("reports a misconfigured service URL loudly (500), never falls back", async () => {
    setEnv({ PYTHON_SERVICE_URL: "definitely-not-a-url" });
    const res = await similarityPost(similarityRequest(validPages));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("python_service_misconfigured");
  });

  it("forwards the payload to the service in snake_case and passes results through", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077", SEO_PY_SERVICE_TOKEN: "t0k" });
    const fetchMock = mockFetch(() =>
      jsonResponse({ all_passed: false, results: [{ id: "a", is_duplicate_blocked: true }] }),
    );

    const res = await similarityPost(
      similarityRequest({ ...validPages, maxSimilarity: 0.8, minWords: 100 }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { all_passed: boolean };
    expect(body.all_passed).toBe(false);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8077/v1/content/similarity");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t0k");
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toEqual({
      pages: validPages.pages.map((p) => ({ id: p.id, url: p.url ?? "", content: p.content })),
      max_similarity: 0.8,
      min_words: 100,
    });
  });

  it("preserves upstream 4xx statuses and maps everything else to 502", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077" });
    mockFetch(() => jsonResponse({ detail: "Unauthorized" }, 401));
    const res401 = await similarityPost(similarityRequest(validPages));
    expect(res401.status).toBe(401);

    mockFetch(() => Promise.reject(new TypeError("fetch failed")));
    const res502 = await similarityPost(similarityRequest(validPages));
    expect(res502.status).toBe(502);
    const body = (await res502.json()) as { code: string; error: string };
    expect(body.code).toBe("python_service_error");
    expect(body.error).toBe("Python service is unreachable");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bridge route: POST /api/seo-visibility-report (generation chain)
// ─────────────────────────────────────────────────────────────────────────────
function reportRequest(): NextRequest {
  const fd = new FormData();
  fd.append("template", new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "template.pptx"));
  fd.append("xlsx", new File([new Uint8Array([0x50, 0x4b])], "My Property keywords.xlsx"));
  return new NextRequest("http://localhost/api/seo-visibility-report", {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/seo-visibility-report generation chain", () => {
  it("stays disabled (501) with no bridge and no local-python opt-in", async () => {
    const res = await reportPost(reportRequest());
    expect(res.status).toBe(501);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("report_generation_disabled");
  });

  it("bridges over HTTP when PYTHON_SERVICE_URL is set — no local spawn needed", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077", SEO_PY_SERVICE_TOKEN: "t0k" });
    const deck = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const fetchMock = mockFetch(
      () =>
        new Response(deck, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          },
        }),
    );

    const res = await reportPost(reportRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="seo_visibility_report_My_Property_keywords.pptx"',
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8077/v1/reports/seo-visibility");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t0k");
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    expect((fd.get("template") as File).name).toBe("template.pptx");
    expect((fd.get("xlsx") as File).name).toBe("My Property keywords.xlsx");
    expect(fd.get("pdf")).toBeNull();
  });

  it("maps bridge failures to stable codes without leaking internals", async () => {
    setEnv({ PYTHON_SERVICE_URL: "http://127.0.0.1:8077" });
    mockFetch(() => Promise.reject(new TypeError("connect ECONNREFUSED 127.0.0.1:8077")));

    const res = await reportPost(reportRequest());
    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("python_service_error");
    expect(body.error).toBe("Python service is unreachable");
    expect(body.error).not.toContain("ECONNREFUSED");
  });

  it("reports a misconfigured service URL loudly (500)", async () => {
    setEnv({ PYTHON_SERVICE_URL: "not-a-url" });
    const res = await reportPost(reportRequest());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("python_service_misconfigured");
  });

  it("keeps the local execFile opt-in working when the bridge is off", async () => {
    // SEO_STUDIO_ALLOW_LOCAL_PYTHON is unset in this suite, so the local branch
    // must still answer 501 — proving the bridge branch did not swallow it.
    setEnv({ PYTHON_SERVICE_URL: undefined, SEO_STUDIO_ALLOW_LOCAL_PYTHON: undefined });
    const res = await reportPost(reportRequest());
    expect(res.status).toBe(501);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("report_generation_disabled");
    expect(body.error).toContain("SEO_STUDIO_ALLOW_LOCAL_PYTHON=1");
  });
});
