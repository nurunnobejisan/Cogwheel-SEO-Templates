import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPrivateOrReservedIp, UrlValidationError, validateTargetUrl } from "../src/core/crawler/url";
import { assertEgressAllowed, EgressBlockedError } from "../src/lib/security/egress";
import { clientKey, consume, limitForRequest, resetRateLimits } from "../src/lib/security/rate-limit";
import {
  createSessionToken,
  devAuthEnabled,
  readCookie,
  sessionCookie,
  verifySessionToken,
} from "../src/lib/platform/session";
import { principalFromRequest } from "../src/lib/platform/auth";

describe("SSRF: private / reserved address classification", () => {
  it("flags loopback, RFC1918, link-local and cloud metadata", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "0.0.0.0",
      "100.64.0.1",
      "198.18.0.1",
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(false);
    }
  });

  it("rejects private literals and internal hostnames at URL validation", () => {
    expect(() => validateTargetUrl("http://169.254.169.254/latest/meta-data/")).toThrow();
    expect(() => validateTargetUrl("http://100.64.0.1/")).toThrow();
    expect(() => validateTargetUrl("http://localhost:3000")).toThrow();
    expect(() => validateTargetUrl("http://printer.local")).toThrow();
    expect(() => validateTargetUrl("file:///etc/passwd")).toThrow();
  });

  it("blocks egress for private literal IPs without a DNS lookup", async () => {
    await expect(assertEgressAllowed("http://127.0.0.1:8080")).rejects.toBeInstanceOf(UrlValidationError);
    await expect(assertEgressAllowed("http://169.254.169.254/")).rejects.toBeInstanceOf(UrlValidationError);
    // EgressBlockedError is a UrlValidationError subtype (DNS-level rejection).
    expect(new EgressBlockedError("x")).toBeInstanceOf(UrlValidationError);
  });

  it("normalizes a public URL", async () => {
    await expect(assertEgressAllowed("https://example.com/path")).resolves.toBe("https://example.com/path");
  });
});

describe("Rate limiting", () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => resetRateLimits());

  it("allows up to the limit then reports retry information", () => {
    const rule = { limit: 2, windowMs: 60_000 };
    const now = 1_000_000;
    expect(consume("k", rule, now).allowed).toBe(true);
    expect(consume("k", rule, now).allowed).toBe(true);
    const blocked = consume("k", rule, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const rule = { limit: 1, windowMs: 1_000 };
    expect(consume("k", rule, 0).allowed).toBe(true);
    expect(consume("k", rule, 500).allowed).toBe(false);
    expect(consume("k", rule, 1_001).allowed).toBe(true);
  });

  it("uses the stricter crawl budget for crawl routes", () => {
    expect(limitForRequest("/api/full-audit", "POST").limit).toBe(10);
    expect(limitForRequest("/api/templates", "GET").limit).toBe(240);
    expect(limitForRequest("/api/templates", "POST").limit).toBe(30);
  });

  it("prefers the first x-forwarded-for hop", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientKey(headers)).toBe("203.0.113.7");
  });
});

describe("Signed operator sessions", () => {
  const secret = "test-session-secret-0123456789abcdef";

  beforeEach(() => {
    process.env.PLATFORM_SESSION_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.PLATFORM_SESSION_SECRET;
    delete process.env.PLATFORM_DEV_AUTH;
  });

  it("round-trips a principal", async () => {
    const token = await createSessionToken({ id: "ops@example.com", role: "specialist", organizationId: "org_1" });
    await expect(verifySessionToken(token)).resolves.toEqual({
      id: "ops@example.com",
      role: "specialist",
      organizationId: "org_1",
    });
  });

  it("rejects a tampered payload and a tampered signature", async () => {
    const token = await createSessionToken({ id: "ops@example.com", role: "viewer" });
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "attacker", role: "admin", exp: Math.floor(Date.now() / 1000) + 600 }),
    )
      .toString("base64url");

    await expect(verifySessionToken(`${forgedPayload}.${signature}`)).resolves.toBeNull();
    await expect(verifySessionToken(`${payload}.${signature?.slice(0, -2)}AA`)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken({ id: "ops@example.com", role: "admin" }, -10);
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("rejects everything when no secret is configured", async () => {
    const token = await createSessionToken({ id: "ops@example.com", role: "admin" });
    delete process.env.PLATFORM_SESSION_SECRET;
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("reads a cookie and emits hardened Set-Cookie attributes", () => {
    expect(readCookie("a=1; cw_session=abc%2Edef; b=2", "cw_session")).toBe("abc.def");
    const cookie = sessionCookie("abc.def");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("only enables unsigned dev auth when explicitly opted in outside production", () => {
    expect(devAuthEnabled()).toBe(false);
    process.env.PLATFORM_DEV_AUTH = "1";
    expect(devAuthEnabled()).toBe(true);
  });

  it("resolves a verified session and ignores spoofed actor headers", async () => {
    const token = await createSessionToken({ id: "ops@example.com", role: "admin" });
    const principal = await principalFromRequest({
      header: (name) =>
        name === "cookie" ? `cw_session=${encodeURIComponent(token)}` : name === "x-actor-role" ? "admin" : null,
    });
    expect(principal).toEqual({ id: "ops@example.com", role: "admin" });

    const spoofed = await principalFromRequest({
      header: (name) =>
        name === "cookie" ? "cw_actor_id=attacker; cw_actor_role=admin" : null,
    });
    expect(spoofed).toEqual({ id: "", role: "viewer" });
  });
});