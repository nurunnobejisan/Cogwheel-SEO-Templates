#!/usr/bin/env tsx
/**
 * Generate `ml/sources.json` from `ml/sources.yaml`.
 *
 * Why a mirror exists (see docs/ml/DECISIONS.md D-014):
 *   - `ml/sources.yaml` stays the single authored source of truth;
 *   - the CI Python job installs only the root `requirements.txt`, which has
 *     no PyYAML, so `ml/registry.py` must be able to read the registry with
 *     the standard library alone;
 *   - `js-yaml` is already a devDependency for the Node validator.
 *
 * Usage:
 *   npx tsx scripts/export-ml-sources.ts          # write ml/sources.json
 *   npx tsx scripts/export-ml-sources.ts --check  # fail if out of date
 *
 * `--check` is chained onto `npm run train:validate`, so a hand-edit of either
 * file without regenerating the other fails CI.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const YAML_PATH = path.join(ROOT, "ml/sources.yaml");
const JSON_PATH = path.join(ROOT, "ml/sources.json");

const USE_VALUES = new Set(["train", "train_attribution", "eval_only", "avoid"]);

interface SourceEntry {
  id: string;
  name: string;
  url?: string;
  licence: string;
  use: string;
  feeds?: string[];
  attribution_required?: boolean;
  notes?: string;
}

interface Registry {
  version: number;
  updated: string;
  sources: SourceEntry[];
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

/** Validate the registry shape so a malformed edit cannot ship. */
function validate(registry: Registry): void {
  if (typeof registry.version !== "number") fail("sources.yaml: `version` must be a number");
  if (typeof registry.updated !== "string") fail("sources.yaml: `updated` must be a string");
  if (!Array.isArray(registry.sources) || registry.sources.length === 0) {
    fail("sources.yaml: `sources` must be a non-empty list");
  }

  const seen = new Set<string>();
  for (const entry of registry.sources) {
    if (!entry || typeof entry.id !== "string" || !entry.id.trim()) {
      fail("sources.yaml: every entry needs a non-empty string `id`");
    }
    if (seen.has(entry.id)) fail(`sources.yaml: duplicate id "${entry.id}"`);
    seen.add(entry.id);

    if (typeof entry.licence !== "string" || !entry.licence.trim()) {
      fail(`sources.yaml: "${entry.id}" needs a \`licence\``);
    }
    if (typeof entry.use !== "string" || !USE_VALUES.has(entry.use)) {
      fail(
        `sources.yaml: "${entry.id}" has use="${entry.use}" — expected one of ${[...USE_VALUES].join(", ")}`,
      );
    }
    if (!Array.isArray(entry.feeds)) {
      fail(`sources.yaml: "${entry.id}" needs a \`feeds\` list (may be empty)`);
    }
    if (typeof entry.attribution_required !== "boolean") {
      fail(`sources.yaml: "${entry.id}" needs boolean \`attribution_required\``);
    }
    if (entry.use === "train_attribution" && !entry.attribution_required) {
      fail(
        `sources.yaml: "${entry.id}" is train_attribution but attribution_required is false`,
      );
    }
    if (entry.use === "avoid" && entry.feeds.length > 0) {
      fail(`sources.yaml: "${entry.id}" is avoid but declares feeds`);
    }
  }
}

/** Stable, diff-friendly serialisation. */
function render(registry: Registry): string {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

function main(): void {
  if (!fs.existsSync(YAML_PATH)) fail(`missing ${path.relative(ROOT, YAML_PATH)}`);

  const registry = yaml.load(fs.readFileSync(YAML_PATH, "utf8")) as Registry;
  validate(registry);

  const rendered = render(registry);
  const check = process.argv.includes("--check");

  if (check) {
    if (!fs.existsSync(JSON_PATH)) {
      fail("ml/sources.json is missing — run `npm run ml:sources:export`");
    }
    const onDisk = fs.readFileSync(JSON_PATH, "utf8");
    if (onDisk !== rendered) {
      fail("ml/sources.json is out of date with ml/sources.yaml — run `npm run ml:sources:export`");
    }
    console.log(
      `✅ ml/sources.json in sync (${registry.sources.length} sources, version ${registry.version})`,
    );
    return;
  }

  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(JSON_PATH, rendered);
  console.log(
    `Exported: ${path.relative(ROOT, JSON_PATH)} (${registry.sources.length} sources, version ${registry.version})`,
  );
}

main();
