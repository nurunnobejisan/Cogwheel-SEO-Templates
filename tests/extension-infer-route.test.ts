/**
 * `/api/extension/infer` (v2 WP8, D-037) — the model-inference proxy route.
 *
 * Operator-only; task-allowlisted; degrades with `{ ok: false }` instead of
 * leaking provider errors; never echoes the prompt back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as inferPost } from "../src/app/api/extension/infer/route";

type RouteRequest = Parameters<typeof inferPost>[0];

function postRequest(body: unknown, headers: Record<string, string> = {}): RouteRequest {
  return new Request("http://localhost/api/extension/infer", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as unknown as RouteRequest;
}

const OPERATOR_HEADERS = { cookie: "cw_actor_id=op-1; cw_actor_role=admin" };

beforeEach(() => {
  process.env.PLATFORM_DEV_AUTH = "1";
  delete process.env.PLATFORM_SESSION_SECRET;
  delete process.env.AI_ADAPTER_MODE;
});

afterEach(() => {
  delete process.env.PLATFORM_DEV_AUTH;
  delete process.env.GROQ_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("auth", () => {
  it("401s without an authenticated principal", async () => {
    const res = await inferPost(postRequest({ task: "metadata_generation", prompt: "p" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("input validation", () => {
  it("400s on a task outside the router allowlist", async () => {
    const res = await inferPost(postRequest({ task: "freeform_essay", prompt: "p" }, OPERATOR_HEADERS));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toContain("task not allowed");
  });

  it("400s on a missing or oversized prompt", async () => {
    const missing = await inferPost(postRequest({ task: "metadata_generation" }, OPERATOR_HEADERS));
    expect(missing.status).toBe(400);

    const huge = await inferPost(
      postRequest({ task: "metadata_generation", prompt: "x".repeat(25_000) }, OPERATOR_HEADERS),
    );
    expect(huge.status).toBe(400);
  });

  it("400s on invalid JSON", async () => {
    const req = new Request("http://localhost/api/extension/infer", {
      method: "POST",
      headers: { "content-type": "application/json", ...OPERATOR_HEADERS },
      body: "{not json",
    }) as unknown as RouteRequest;
    expect((await inferPost(req)).status).toBe(400);
  });
});

describe("inference", () => {
  it("returns the gated output for an allowlisted task", async () => {
    process.env.GROQ_API_KEY = "groq-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) =>
        String(url).includes("groq")
          ? {
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: '{"title":"Gated Title"}' } }],
              }),
            }
          : { ok: false, status: 500, json: async () => ({}) },
      ),
    );
    const res = await inferPost(
      postRequest({ task: "metadata_generation", prompt: "Write a title for Seaside Inn" }, OPERATOR_HEADERS),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.output).toBe("string");
    expect(body.output.length).toBeGreaterThan(0);
    // Never echoes the prompt back.
    expect(body.output).not.toBe("Write a title for Seaside Inn");
  });

  it("503s with ok:false when every provider fails (no provider error text)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ANTHROPIC_SECRET_KEY invalid at api.anthropic.com");
      }),
    );
    const res = await inferPost(
      postRequest({ task: "metadata_generation", prompt: "p" }, OPERATOR_HEADERS),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("ANTHROPIC_SECRET_KEY");
  });
});
