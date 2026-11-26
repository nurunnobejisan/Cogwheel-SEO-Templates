import { describe, it, expect } from "vitest";
import { isNewerVersion } from "../chrome-extension/src/background/auto-updater";

describe("SEO Studio Auto-Updater Engine", () => {
  it("correctly identifies newer remote versions", () => {
    expect(isNewerVersion("2.6.1", "2.7.0")).toBe(true);
    expect(isNewerVersion("2.6.0", "2.6.1")).toBe(true);
    expect(isNewerVersion("1.9.9", "2.0.0")).toBe(true);
    expect(isNewerVersion("v2.6.1", "v2.7.0")).toBe(true);
    expect(isNewerVersion("2.7", "2.7.1")).toBe(true);
  });

  it("returns false when remote version is equal or older", () => {
    expect(isNewerVersion("2.7.0", "2.7.0")).toBe(false);
    expect(isNewerVersion("2.7.0", "2.6.9")).toBe(false);
    expect(isNewerVersion("3.0.0", "2.9.9")).toBe(false);
    expect(isNewerVersion("v2.7.0", "v2.7.0")).toBe(false);
    expect(isNewerVersion("2.7.1", "2.7")).toBe(false);
  });
});
