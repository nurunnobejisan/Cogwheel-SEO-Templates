import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as propertiesGET } from "../src/app/api/properties/route";
import { GET as trainingGET, POST as trainingPOST } from "../src/app/api/ai-training/route";
import { isOperator, requireOperator } from "../src/lib/auth/requireOperator";
import { middleware } from "../src/middleware";

const ENV_KEYS = [
  "SEO_STUDIO_API_BEARER_TOKEN",
  "PLATFORM_OPERATOR_TOKEN",
  "PLATFORM_SESSION_SECRET",
  "PLATFORM_DEV_AUTH",
  "SITE_AUTH_ENABLED",
  "SITE_BASIC_AUTH_USER",
  "SITE_BASIC_AUTH_PASSWORD",
];

function clearAuthEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("Shared operator guard", () => {
  beforeEach(clearAuthEnv);
  afterEach(clearAuthEnv);

  it("denies requests when no credential is configured", async () => {
    const request = new Request("http://localhost/api/generate-kr", { method: "POST" });
    expect(await isOperator({ headers: request.headers })).toBe(false);
    const denied = await requireOperator({ headers: request.headers });
    expect(denied?.status).toBe(401);
  });

  it("accepts the configured bearer token and rejects a wrong one", async () => {
    process.env.SEO_STUDIO_API_BEARER_TOKEN = "test-operator-token";
    const valid = new Request("http://localhost/api/generate-kr", {
      method: "POST",
      headers: { Authorization: "Bearer test-operator-token" },
    });
    const invalid = new Request("http://localhost/api/generate-kr", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    });
    expect(await isOperator({ headers: valid.headers })).toBe(true);
    expect(await isOperator({ headers: invalid.headers })).toBe(false);
  });

  it("fails closed on ai-training POST when the bearer env var is unset", async () => {
    const response = await trainingPOST(
      new Request("http://localhost/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Leak check", ruleText: "Internal rule text must not be written" }),
      }),
    );
    expect([401, 500]).toContain(response.status);
    expect(response.status).not.toBe(200);
  });

  it("does not expose rule text on ai-training GET without a token", async () => {
    const response = await trainingGET(new Request("http://localhost/api/ai-training"));
    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toContain("vanity site");
    expect(body).not.toContain("Grounded Property Claims");
    expect(body).not.toContain("provider");
  });

  it("requires auth for the property search API", async () => {
    const anonymous = await propertiesGET(new Request("http://localhost/api/properties?q=demo"));
    expect(anonymous.status).toBe(401);
    process.env.SEO_STUDIO_API_BEARER_TOKEN = "test-operator-token";
    const authorized = await propertiesGET(
      new Request("http://localhost/api/properties?q=demo", {
        headers: { Authorization: "Bearer test-operator-token" },
      }),
    );
    expect(authorized.status).toBe(200);
    const payload = (await authorized.json()) as { total: number; results: Array<{ name: string }> };
    expect(payload.total).toBeGreaterThan(0);
    expect(payload.results.length).toBeLessThanOrEqual(25);
  });
});

describe("Middleware auth gate", () => {
  beforeEach(clearAuthEnv);
  afterEach(clearAuthEnv);

  it("blocks tokenless API writes including generate-kr", async () => {
    const response = await middleware(
      new NextRequest("http://localhost/api/generate-kr", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.9" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("blocks tokenless ai-training GET and allows a valid bearer", async () => {
    process.env.SEO_STUDIO_API_BEARER_TOKEN = "test-operator-token";
    const anonymous = await middleware(new NextRequest("http://localhost/api/ai-training"));
    expect(anonymous.status).toBe(401);
    const authorized = await middleware(
      new NextRequest("http://localhost/api/ai-training", {
        headers: { Authorization: "Bearer test-operator-token" },
      }),
    );
    expect(authorized.status).toBe(200);
  });

  it("gates pages behind SITE_AUTH_ENABLED but keeps marketing paths public", async () => {
    process.env.SITE_AUTH_ENABLED = "1";
    process.env.SITE_BASIC_AUTH_USER = "operator";
    process.env.SITE_BASIC_AUTH_PASSWORD = "secret";
    expect((await middleware(new NextRequest("http://localhost/"))).status).toBe(401);
    expect((await middleware(new NextRequest("http://localhost/strategy-matrix"))).status).toBe(401);
    expect((await middleware(new NextRequest("http://localhost/templates"))).status).toBe(200);
    expect((await middleware(new NextRequest("http://localhost/robots.txt"))).status).toBe(200);

    const credentials = `Basic ${btoa("operator:secret")}`;
    const authorized = await middleware(
      new NextRequest("http://localhost/", { headers: { Authorization: credentials } }),
    );
    expect(authorized.status).toBe(200);
  });

  it("fails closed when site auth is enabled without credentials", async () => {
    process.env.SITE_AUTH_ENABLED = "1";
    const response = await middleware(new NextRequest("http://localhost/"));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
  });
});
