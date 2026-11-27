/**
 * Phase B — shared TS package (`shared/ts/`) single-source guarantees.
 *
 * Before Phase B the Next.js app and the Chrome extension each carried their
 * own copy of the training vault, dataset builder and capture extractor, and
 * two parity suites existed only to catch the copies drifting apart. The
 * copies are merged into `shared/ts/`; this suite pins the Phase B invariants:
 *
 *   1. the extension's vault wrapper re-exports the *same* shared functions
 *      (identity, not just behavioural equality);
 *   2. every product importer points at `shared/ts/` (source guard);
 *   3. the seven deleted per-tree copies are gone, and nothing imports them.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as sharedVault from "../shared/ts/training-vault";
import * as sharedDatasetBuilder from "../shared/ts/dataset-builder";
import * as sharedTrainingCapture from "../shared/ts/training-capture";
import * as extensionVault from "../chrome-extension/src/storage/training-vault";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const DELETED_COPIES = [
  // app copies superseded by shared/ts/ (or, for auto-updater/updater.types,
  // byte-identical to the extension survivor that stays put)
  "src/storage/training-vault.ts",
  "src/engine/dataset-builder.ts",
  "src/content/training-capture.ts",
  "src/background/auto-updater.ts",
  "src/types/updater.types.ts",
  // extension copies moved into shared/ts/
  "chrome-extension/src/engine/dataset-builder.ts",
  "chrome-extension/src/content/training-capture.ts",
];

/** Every import specifier in the product + test trees, resolved to a repo path. */
function collectImportSpecifiers(): Array<{ file: string; spec: string }> {
  const out: Array<{ file: string; spec: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        const text = readFileSync(full, "utf8");
        const re = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          out.push({ file: full, spec: m[1] });
        }
      }
    }
  };
  walk(join(ROOT, "tests"));
  walk(join(ROOT, "src"));
  walk(join(ROOT, "chrome-extension", "src"));
  return out;
}

function resolveSpecifier(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = join(ROOT, "src", spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = resolve(fromFile, "..", spec);
  } else {
    return null; // node module
  }
  for (const suffix of ["", ".ts", ".tsx", join("", "index.ts"), join("", "index.tsx")]) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

describe("Phase B — shared/ts single source", () => {
  it("the extension vault wrapper re-exports the identical shared functions", () => {
    expect(extensionVault.classifyPageType).toBe(sharedVault.classifyPageType);
    expect(extensionVault.derivePack).toBe(sharedVault.derivePack);
    expect(extensionVault.stripTrainingPii).toBe(sharedVault.stripTrainingPii);
    expect(extensionVault.migrateRecordToV3).toBe(sharedVault.migrateRecordToV3);
    expect(extensionVault.saveTrainingPair).toBe(sharedVault.saveTrainingPair);
    expect(extensionVault.getAllTrainingPairs).toBe(sharedVault.getAllTrainingPairs);
    // the wrapper's own job still exists: it registers the persistence gate
    expect(typeof extensionVault.setTrainingPersistGate).toBe("function");
    expect(extensionVault.setTrainingPersistGate).toBe(sharedVault.setTrainingPersistGate);
  });

  it("shared modules exist exactly once and export their public surface", () => {
    expect(existsSync(join(ROOT, "shared/ts/training-vault.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "shared/ts/dataset-builder.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "shared/ts/training-capture.ts"))).toBe(true);
    expect(typeof sharedDatasetBuilder.recordToChatMl).toBe("function");
    expect(typeof sharedTrainingCapture.extractCapturedWebSample).toBe("function");
  });

  it("product importers point at shared/ts/ (source guard)", () => {
    expect(read("chrome-extension/src/content/index.ts")).toContain(
      'from "../../../shared/ts/training-capture"',
    );
    expect(read("chrome-extension/src/components/ExportDatasetModal.tsx")).toContain(
      'from "../../../shared/ts/dataset-builder"',
    );
    expect(read("chrome-extension/src/components/DatasetVaultManager.tsx")).toContain(
      'from "../../../shared/ts/dataset-builder"',
    );
    expect(read("chrome-extension/src/storage/training-vault.ts")).toContain(
      'from "../../../shared/ts/training-vault"',
    );
    expect(read("src/core/training/dataset.ts")).toContain(
      'from "../../../shared/ts/training-vault.ts"',
    );
  });

  it("the seven deleted per-tree copies are gone", () => {
    for (const relative of DELETED_COPIES) {
      expect(existsSync(join(ROOT, relative)), `${relative} should be deleted`).toBe(false);
    }
    // survivors the PR names instead
    expect(existsSync(join(ROOT, "chrome-extension/src/background/auto-updater.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "chrome-extension/src/types/updater.types.ts"))).toBe(true);
  });

  it("nothing in the product or test trees imports a deleted copy", () => {
    const deleted = DELETED_COPIES.map((relative) => resolve(join(ROOT, relative)));
    const offenders: string[] = [];
    for (const { file, spec } of collectImportSpecifiers()) {
      const resolved = resolveSpecifier(file, spec);
      if (resolved && deleted.includes(resolve(resolved))) {
        offenders.push(`${file} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
