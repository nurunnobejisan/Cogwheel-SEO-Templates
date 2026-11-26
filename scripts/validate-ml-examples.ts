#!/usr/bin/env tsx
/**
 * Validate unified ML example records and golden evaluation cases against the
 * Zod single source of truth in `schemas/ml-example.ts`.
 *
 * Why this exists next to scripts/validate-training-data.mjs:
 *   - that script validates the 3-role CHAT form (`row.messages`);
 *   - this one validates the structured MlExample / MlGoldenCase form that
 *     ml/build and ml/eval exchange.
 * Both run from the single `npm run train:validate` gate, and both read the
 * same licence registry (ml/sources.yaml), so there is one set of rules.
 *
 * Usage:
 *   npx tsx scripts/validate-ml-examples.ts [file ...]
 * Default file: ml/eval/golden/cases.jsonl
 *
 * Fails (exit 1) when a row:
 *   - is not valid JSON or does not satisfy the schema
 *   - repeats another row's `id`
 *   - names a `source` absent from ml/sources.yaml
 *   - is split=train while its source's `use` is avoid / eval_only (rule 3)
 *   - carries a `licence` that disagrees with ml/sources.yaml
 *   - is synthetic yet split=train or provenance=measured (rule 6)
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import yaml from "js-yaml";
import { MlExampleSchema, MlGoldenCaseSchema } from "../schemas/ml-example.ts";

const DEFAULT_FILES = ["ml/eval/golden/cases.jsonl"];
const SOURCES_YAML = fileURLToPath(new URL("../ml/sources.yaml", import.meta.url));
const TRAINABLE_USES = new Set(["train", "train_attribution"]);
const MAX_REPORTED = 60;

interface SourceEntry {
  id: string;
  use: string;
  licence?: string;
  attribution_required?: boolean;
}

async function loadRegistry(): Promise<Map<string, SourceEntry>> {
  const doc = yaml.load(await fs.readFile(SOURCES_YAML, "utf8")) as {
    sources?: SourceEntry[];
  };
  const entries = Array.isArray(doc?.sources) ? doc.sources : [];
  if (!entries.length) throw new Error("ml/sources.yaml declares no `sources` entries");
  const byId = new Map<string, SourceEntry>();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || typeof entry.use !== "string") {
      throw new Error("ml/sources.yaml: every entry needs a string `id` and `use`");
    }
    if (byId.has(entry.id)) throw new Error(`ml/sources.yaml: duplicate id ${entry.id}`);
    byId.set(entry.id, entry);
  }
  return byId;
}

const isGoldenPath = (rel: string): boolean =>
  rel.replace(/\\/g, "/").includes("ml/eval/golden");

/** Same rule as the chat validator: a path carrying `train` is a train file. */
const isTrainPath = (rel: string): boolean => /(^|[/\\_.-])train([/\\_.-]|$)/i.test(rel);

function fmtIssues(issues: unknown[]): string {
  return issues
    .map((issue) => {
      if (issue && typeof issue === "object" && "path" in issue) {
        const { path: p, message } = issue as { path: PropertyKey[]; message: string };
        return `${p.length ? p.join(".") : "<root>"}: ${message}`;
      }
      return String(issue);
    })
    .join("; ");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = args.length ? args : DEFAULT_FILES;
  const errors: string[] = [];
  const seenIds = new Map<string, string>();
  let total = 0;

  let registry: Map<string, SourceEntry>;
  try {
    registry = await loadRegistry();
    console.log(`licence registry: ml/sources.yaml (${registry.size} sources)`);
  } catch (err) {
    console.error(`❌ cannot load ml/sources.yaml: ${(err as Error).message}`);
    process.exit(1);
  }

  for (const rel of files) {
    const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    let lines: string[];
    try {
      lines = (await fs.readFile(abs, "utf8")).split("\n").filter((l) => l.trim());
    } catch (err) {
      errors.push(`${rel}: cannot read (${(err as Error).message})`);
      continue;
    }

    const golden = isGoldenPath(rel);
    const trainFile = isTrainPath(rel);
    const schema = golden ? MlGoldenCaseSchema : MlExampleSchema;
    let rows = 0;

    for (const [index, line] of lines.entries()) {
      rows += 1;
      total += 1;
      const where = `${rel}:${index + 1}`;

      let row: unknown;
      try {
        row = JSON.parse(line);
      } catch {
        errors.push(`${where}: invalid JSON`);
        continue;
      }

      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        errors.push(`${where}: schema -> ${fmtIssues(parsed.error.issues.slice(0, 4))}`);
        continue;
      }
      const record = parsed.data as {
        id: string;
        split: string;
        synthetic: boolean;
        provenance: string;
        source: string;
        licence: string;
        task: string;
      };

      if (seenIds.has(record.id)) {
        errors.push(`${where}: duplicate id (also ${seenIds.get(record.id)})`);
      } else {
        seenIds.set(record.id, where);
      }

      const entry = registry.get(record.source);
      if (!entry) {
        errors.push(`${where}: source "${record.source}" is not declared in ml/sources.yaml`);
        continue;
      }

      if (!TRAINABLE_USES.has(entry.use) && record.split === "train") {
        errors.push(
          `${where}: source "${record.source}" has use=${entry.use} and may not enter a train split (rule 3)`,
        );
      }
      if (
        typeof entry.licence === "string" &&
        entry.licence.trim() &&
        record.licence.trim() !== entry.licence.trim()
      ) {
        errors.push(
          `${where}: licence "${record.licence}" disagrees with ml/sources.yaml ("${entry.licence}")`,
        );
      }
      if (record.synthetic && record.split === "train") {
        errors.push(`${where}: synthetic rows may not enter a train split (rule 6)`);
      }
      if (record.synthetic && record.provenance === "measured") {
        errors.push(`${where}: a synthetic row cannot claim provenance=measured (rule 6)`);
      }
      if (golden && trainFile) {
        errors.push(`${where}: golden cases live under ml/eval/golden and are never a train file`);
      }
    }

    console.log(
      `${rel}: ${rows} ${golden ? "golden case" : "example"} rows scanned (${trainFile ? "train" : "non-train"} file)`,
    );
  }

  if (errors.length) {
    console.error(`\n❌ ML example validation FAILED (${errors.length} issue(s)):`);
    for (const e of errors.slice(0, MAX_REPORTED)) console.error(`   - ${e}`);
    if (errors.length > MAX_REPORTED) console.error(`   ...and ${errors.length - MAX_REPORTED} more`);
    process.exit(1);
  }

  console.log(
    `\n✅ ML example validation passed: ${total} rows, schema-valid, licence-clean, unique ids.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
