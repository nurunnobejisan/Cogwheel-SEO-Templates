import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deployment security headers", () => {
  it("sets baseline headers outside production", () => {
    const response = middleware(new NextRequest("http://localhost/"));
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("adds HSTS and CSP only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = middleware(new NextRequest("http://localhost/"));

    expect(response.headers.get("strict-transport-security")).toContain("max-age=63072000");
    const csp = response.headers.get("content-security-policy") ?? "";
    for (const directive of [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it("keeps the local Python bridge out of Vercel uploads without hiding Next API routes", () => {
    const patterns = readFileSync(".vercelignore", "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    expect(patterns).toEqual(["api/"]);
  });
});
