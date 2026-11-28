import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/visibility/route.ts";

let dataDir: string;

function request(body: unknown, authenticated = true): NextRequest {
  return new NextRequest("http://localhost/api/visibility", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authenticated ? "cw_actor_id=operator; cw_actor_role=owner" : "",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "seo-studio-vis-route-"));
  vi.stubEnv("SEO_STUDIO_DATA_DIR", dataDir);
  vi.stubEnv("PLATFORM_DEV_AUTH", "1");
  for (const key of [
    "GEMINI_API_KEY",
    "GOOGLE_AI_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "PERPLEXITY_API_KEY",
    "VISIBILITY_FREE_PROVIDERS_ENABLED",
    "POLLINATIONS_ENABLED",
  ]) {
    vi.stubEnv(key, "");
  }
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("visibility route validation and auth", () => {
  it("requires an operator session for status and runs", async () => {
    expect((await GET(new NextRequest("http://localhost/api/visibility"))).status).toBe(401);
    const response = await POST(request({ targetUrl: "https://example.com" }, false));
    expect(response.status).toBe(401);
  });

  it("rejects batches larger than four prompts", async () => {
    const response = await POST(request({ targetUrl: "https://example.com", maxPrompts: 5 }));
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/Invalid visibility request/);
  });

  it("rejects unknown providers and non-public URLs", async () => {
    const unknown = await POST(
      request({ targetUrl: "https://example.com", providers: ["chatgpt_clone"] })
    );
    expect(unknown.status).toBe(400);
    const privateUrl = await POST(request({ targetUrl: "http://localhost/admin" }));
    expect(privateUrl.status).toBe(400);
  });

  it("records unmeasured rows instead of inventing answers with zero keys", async () => {
    const response = await POST(
      request({
        targetUrl: "https://example.com",
        brand: "Example Hotel",
        city: "Denver",
        maxPrompts: 2,
        providers: ["gemini_grounded"],
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      run: { results: Array<{ provider: string; available: boolean; reason?: string }> };
    };
    expect(payload.success).toBe(true);
    expect(payload.run.results.length).toBeGreaterThan(0);
    expect(payload.run.results.every((row) => row.provider === "gemini_grounded" && !row.available)).toBe(true);
    expect(payload.run.results[0]?.reason).toMatch(/opt in|key|not configured/i);
  });
});
