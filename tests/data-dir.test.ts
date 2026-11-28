import { afterEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { seoStudioDataDir, seoStudioDataFile } from "../src/lib/platform/data-dir";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("writable data directory", () => {
  it("honours SEO_STUDIO_DATA_DIR when set", () => {
    vi.stubEnv("SEO_STUDIO_DATA_DIR", "/tmp/seo-studio-explicit");
    vi.stubEnv("VERCEL", "");
    expect(seoStudioDataDir()).toBe("/tmp/seo-studio-explicit");
    expect(seoStudioDataFile("x.json")).toBe("/tmp/seo-studio-explicit/x.json");
  });

  it("uses the OS temp dir on Vercel instead of the read-only deployment", () => {
    vi.stubEnv("SEO_STUDIO_DATA_DIR", "");
    vi.stubEnv("VERCEL", "1");
    expect(seoStudioDataDir()).toBe(path.join(os.tmpdir(), "seo-studio-data"));
  });

  it("uses the repo data dir locally", () => {
    vi.stubEnv("SEO_STUDIO_DATA_DIR", "");
    vi.stubEnv("VERCEL", "");
    expect(seoStudioDataDir()).toBe(path.join(process.cwd(), "data"));
  });
});
