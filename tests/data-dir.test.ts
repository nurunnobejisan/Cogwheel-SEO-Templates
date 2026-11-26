import { afterEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { cogwheelDataDir, cogwheelDataFile } from "../src/lib/platform/data-dir";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("writable data directory", () => {
  it("honours COGWHEEL_DATA_DIR when set", () => {
    vi.stubEnv("COGWHEEL_DATA_DIR", "/tmp/cogwheel-explicit");
    vi.stubEnv("VERCEL", "");
    expect(cogwheelDataDir()).toBe("/tmp/cogwheel-explicit");
    expect(cogwheelDataFile("x.json")).toBe("/tmp/cogwheel-explicit/x.json");
  });

  it("uses the OS temp dir on Vercel instead of the read-only deployment", () => {
    vi.stubEnv("COGWHEEL_DATA_DIR", "");
    vi.stubEnv("VERCEL", "1");
    expect(cogwheelDataDir()).toBe(path.join(os.tmpdir(), "cogwheel-data"));
  });

  it("uses the repo data dir locally", () => {
    vi.stubEnv("COGWHEEL_DATA_DIR", "");
    vi.stubEnv("VERCEL", "");
    expect(cogwheelDataDir()).toBe(path.join(process.cwd(), "data"));
  });
});
