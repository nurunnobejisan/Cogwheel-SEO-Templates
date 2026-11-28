import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { requireOperator } from "../src/lib/security/operator";
import { GET as aiTrainingGet, POST as aiTrainingPost } from "../src/app/api/ai-training/route";

const ENV_SNAPSHOT = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ENV_SNAPSHOT)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ENV_SNAPSHOT);
}

describe("WP1 — operator bearer authentication", () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it("fails closed with 401 in production when SEO_STUDIO_API_BEARER_TOKEN is unset", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.SEO_STUDIO_API_BEARER_TOKEN;

    const req = new NextRequest("http://localhost:3000/api/full-audit", { method: "POST" });
    const res = await middleware(req);
    expect(res.status).toBe(401);

    const direct = await requireOperator(new Request("http://localhost:3000/api/ai-training"));
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.status).toBe(401);
  });

  it("allows with a one-line warning in development when SEO_STUDIO_API_BEARER_TOKEN is unset", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.SEO_STUDIO_API_BEARER_TOKEN;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = new NextRequest("http://localhost:3000/api/full-audit", { method: "POST" });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0] ?? "")).toContain("SEO_STUDIO_API_BEARER_TOKEN");
  });

  it("blocks unauthenticated writes and Origin-less curl requests with 401 when configured", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.SEO_STUDIO_API_BEARER_TOKEN = "super-secret-operator-token-32bytes";

    const unauthWrite = new NextRequest("http://localhost:3000/api/generate-hc", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    expect((await middleware(unauthWrite)).status).toBe(401);

    const curlWithoutOrigin = new NextRequest("http://localhost:3000/api/tasks/title-meta/run", {
      method: "POST",
      headers: { host: "localhost:3000" },
    });
    expect((await middleware(curlWithoutOrigin)).status).toBe(401);

    const wrongToken = new NextRequest("http://localhost:3000/api/brain", {
      method: "GET",
      headers: { authorization: "Bearer wrong-token" },
    });
    expect((await middleware(wrongToken)).status).toBe(401);
  });

  it("protects costly crawl/LLM GET routes and allows valid Bearer tokens", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.SEO_STUDIO_API_BEARER_TOKEN = "super-secret-operator-token-32bytes";

    for (const path of [
      "/api/brain",
      "/api/full-audit",
      "/api/heading-audit",
      "/api/image-audit",
      "/api/geo/check",
    ]) {
      const blocked = await middleware(new NextRequest(`http://localhost:3000${path}`, { method: "GET" }));
      expect(blocked.status, path).toBe(401);

      const allowed = await middleware(
        new NextRequest(`http://localhost:3000${path}`, {
          method: "GET",
          headers: { authorization: "Bearer super-secret-operator-token-32bytes" },
        }),
      );
      expect(allowed.status, path).toBe(200);
    }

    const validPost = await middleware(
      new NextRequest("http://localhost:3000/api/full-audit", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          authorization: "Bearer super-secret-operator-token-32bytes",
        },
      }),
    );
    expect(validPost.status).toBe(200);
  });

  it("/api/ai-training rejects POST when token env is missing and redacts unauthenticated GET", async () => {
    delete process.env.SEO_STUDIO_API_BEARER_TOKEN;

    const missingEnvPost = await aiTrainingPost(
      new Request("http://localhost:3000/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Rule", ruleText: "Must keep clean" }),
      }),
    );
    expect(missingEnvPost.status).toBe(401);

    const anonGet = await aiTrainingGet(new Request("http://localhost:3000/api/ai-training"));
    expect(anonGet.status).toBe(200);
    const anonJson = (await anonGet.json()) as Record<string, unknown>;
    expect(anonJson.authenticated).toBe(false);
    expect(typeof anonJson.rulesCount).toBe("number");
    expect(typeof anonJson.historyCount).toBe("number");
    expect(anonJson.rules).toBeUndefined();
    expect(anonJson.history).toBeUndefined();

    process.env.SEO_STUDIO_API_BEARER_TOKEN = "super-secret-operator-token-32bytes";
    const authedGet = await aiTrainingGet(
      new Request("http://localhost:3000/api/ai-training", {
        headers: { authorization: "Bearer super-secret-operator-token-32bytes" },
      }),
    );
    expect(authedGet.status).toBe(200);
    const authedJson = (await authedGet.json()) as Record<string, unknown>;
    expect(authedJson.authenticated).toBe(true);
    expect(Array.isArray(authedJson.rules)).toBe(true);
  });
});
