/**
 * Phase 0 — vendored dependency guard (M5).
 *
 * `xlsx` must install from the vendored tarball in `vendor/`, never from a
 * CDN URL: a clean clone (and any sandbox without network access to
 * cdn.sheetjs.com) has to build green. The lock-file integrity is checked
 * against the actual bytes of the tarball so the pair cannot drift.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8")) as {
  dependencies?: Record<string, string>;
};
const lock = JSON.parse(readFileSync(`${ROOT}/package-lock.json`, "utf8")) as {
  packages: Record<string, { resolved?: string; integrity?: string; version?: string; dependencies?: Record<string, string> }>;
};

describe("Phase 0 — xlsx is vendored, not fetched from a CDN", () => {
  it("package.json points at the vendored tarball", () => {
    expect(pkg.dependencies?.xlsx).toBe("file:vendor/xlsx-0.20.3.tgz");
  });

  it("package-lock.json resolves the same vendored file", () => {
    const entry = lock.packages["node_modules/xlsx"];
    expect(entry?.resolved).toBe("file:vendor/xlsx-0.20.3.tgz");
    expect(lock.packages[""]?.dependencies?.xlsx).toBe("file:vendor/xlsx-0.20.3.tgz");
  });

  it("no CDN sheetjs reference remains anywhere in the manifests", () => {
    for (const file of ["package.json", "package-lock.json"]) {
      const text = readFileSync(`${ROOT}/${file}`, "utf8");
      expect(text, `${file} must not reference cdn.sheetjs.com`).not.toContain(
        "cdn.sheetjs.com",
      );
    }
  });

  it("the vendored tarball exists and its sha512 matches the lock integrity", () => {
    const tarball = `${ROOT}/vendor/xlsx-0.20.3.tgz`;
    expect(existsSync(tarball), `missing ${tarball}`).toBe(true);
    const digest = createHash("sha512").update(readFileSync(tarball)).digest("base64");
    expect(lock.packages["node_modules/xlsx"]?.integrity).toBe(`sha512-${digest}`);
  });

  it("the installed xlsx is the pinned version", async () => {
    const XLSX = (await import("xlsx")) as { version?: string };
    expect(XLSX.version).toBe("0.20.3");
    expect(lock.packages["node_modules/xlsx"]?.version).toBe("0.20.3");
  });
});
