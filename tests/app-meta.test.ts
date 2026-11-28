import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_UPDATED_AT, APP_UPDATED_LABEL, APP_VERSION, APP_YEAR } from "../src/config/app-meta";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("displayed release metadata has one source of truth", () => {
  it("matches every packaged version", () => {
    expect(JSON.parse(read("package.json")).version).toBe(APP_VERSION);
    expect(JSON.parse(read("chrome-extension/package.json")).version).toBe(APP_VERSION);
    expect(JSON.parse(read("chrome-extension/public/manifest.json")).version).toBe(APP_VERSION);
    expect(read("updates.xml")).toContain(`version='${APP_VERSION}'`);
  });

  it("keeps the label, ISO date and copyright year consistent", () => {
    expect(APP_YEAR).toBe(APP_UPDATED_AT.slice(0, 4));
    expect(APP_UPDATED_LABEL).toBe("November 24, 2026");
    expect(new Date(APP_UPDATED_AT).toISOString().slice(0, 10)).toBe(APP_UPDATED_AT);
  });
});
