import { afterEach, describe, expect, it } from "vitest";
import { buildCrawlCacheKey, crawlCacheDescriptor, crawlStoreDescriptor } from "@/core/crawler";
import { propertyStorageDescriptor } from "@/core/property";
import { EPHEMERAL_STORAGE, storageDescriptor } from "@/core/storage";
import { crawlPropertyBodySchema } from "@/app/api/crawl-property/schema";
import { POST as crawlPropertyPost } from "@/app/api/crawl-property/route";

const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
let saved: Record<string, string | undefined> | null = null;

function setSupabase(entries: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>): void {
  for (const key of ENV_KEYS) {
    if (key in entries) {
      const value = entries[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}

afterEach(() => {
  if (saved) {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
  saved = null;
});

function snapshotEnv(): void {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

describe("storage descriptors", () => {
  it("labels in-memory stores as ephemeral", () => {
    expect(EPHEMERAL_STORAGE.persistent).toBe(false);
    expect(EPHEMERAL_STORAGE.label).toContain("ephemeral");
    expect(storageDescriptor(false)).toBe(EPHEMERAL_STORAGE);
    expect(storageDescriptor(true).persistent).toBe(true);
  });

  it("reports the crawl cache as ephemeral — it never survives a restart", () => {
    const descriptor = crawlCacheDescriptor();
    expect(descriptor.persistent).toBe(false);
    expect(descriptor.label).toContain("ephemeral");
  });

  it("reports property storage as durable only when Supabase is configured", () => {
    snapshotEnv();
    setSupabase({});
    expect(propertyStorageDescriptor().persistent).toBe(false);
    expect(crawlStoreDescriptor().persistent).toBe(false);

    setSupabase({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" });
    expect(propertyStorageDescriptor().persistent).toBe(true);
    expect(crawlStoreDescriptor().persistent).toBe(true);
  });
});

describe("buildCrawlCacheKey", () => {
  const url = "https://Example.com/rooms";
  const text = "Oceanfront suites";

  it("scopes the cache by client/property id first", () => {
    const a = buildCrawlCacheKey(url, text, "client-a|property-1");
    const b = buildCrawlCacheKey(url, text, "client-b|property-1");
    expect(a).not.toBe(b);
    expect(a.startsWith("client-a|property-1|")).toBe(true);
  });

  it("keeps different owners apart even for identical URLs and text", () => {
    const first = buildCrawlCacheKey(url, text, "prop-1");
    const second = buildCrawlCacheKey(url, text, "prop-2");
    expect(first).not.toBe(second);
  });

  it("normalises case and whitespace on every part", () => {
    expect(buildCrawlCacheKey(url, text, " PROP-1 ")).toBe(buildCrawlCacheKey(url.toLowerCase(), text, "prop-1"));
  });

  it("falls back to an explicit global scope when no owner is given", () => {
    expect(buildCrawlCacheKey(url, text)).toBe(buildCrawlCacheKey(url, text, "   "));
    expect(buildCrawlCacheKey(url, text).startsWith("global|")).toBe(true);
  });
});

describe("crawl-property body schema", () => {
  it("requires a URL and treats scopeKey as optional", () => {
    expect(crawlPropertyBodySchema.safeParse({ url: "https://example.com" }).success).toBe(true);
    expect(
      crawlPropertyBodySchema.safeParse({ url: "https://example.com", scopeKey: "client-1|prop-1" }).success,
    ).toBe(true);
  });

  it("rejects a missing URL, an empty scope and an oversized scope", () => {
    expect(crawlPropertyBodySchema.safeParse({}).success).toBe(false);
    expect(crawlPropertyBodySchema.safeParse({ url: "https://example.com", scopeKey: "" }).success).toBe(false);
    expect(
      crawlPropertyBodySchema.safeParse({ url: "https://example.com", scopeKey: "x".repeat(201) }).success,
    ).toBe(false);
    expect(
      crawlPropertyBodySchema.safeParse({ url: "https://example.com", scopeKey: 42 }).success,
    ).toBe(false);
  });
});

describe("POST /api/crawl-property", () => {
  it("fails closed on loopback targets (SSRF guard)", async () => {
    const res = await crawlPropertyPost(
      new Request("http://localhost/api/crawl-property", {
        method: "POST",
        body: JSON.stringify({ url: "http://127.0.0.1/admin" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed body before any network call", async () => {
    const res = await crawlPropertyPost(
      new Request("http://localhost/api/crawl-property", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid URL");
  });
});
