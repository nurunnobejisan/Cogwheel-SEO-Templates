#!/usr/bin/env tsx
/**
 * Verify the frozen golden evaluation set.
 *
 * Checks, in order:
 *   1. ml/eval/golden/cases.jsonl exists and is non-empty
 *   2. its sha256 matches the hash frozen in docs/ml/DATA_CARD.md
 *   3. every row satisfies schemas/ml-golden-case.schema.json
 *   4. every row's `source` is declared in ml/sources.yaml with a trainable
 *      `use`, and its licence agrees with the registry
 *   5. at least 50 cases and every one of the five jobs is represented
 *
 * Usage: npm run ml:golden:check
 * Exit 0 = frozen and valid. Exit 1 = drift, missing coverage, or bad rows.
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import { MlGoldenCaseSchema, type MlTask } from "../schemas/ml-example.ts";

const ROOT = process.cwd();
const CASES = path.join(ROOT, "ml/eval/golden/cases.jsonl");
const DATA_CARD = path.join(ROOT, "docs/ml/DATA_CARD.md");
const SOURCES_YAML = fileURLToPath(new URL("../ml/sources.yaml", import.meta.url));

const MIN_CASES = 50;
const ALL_TASKS: MlTask[] = [
  "schema_generation",
  "metadata_generation",
  "rag_synthesis",
  "page_classification",
  "entity_gap_analysis",
];
const TRAINABLE_USES = new Set(["train", "train_attribution"]);

async function main(): Promise<void> {
  const errors: string[] = [];

  /* ---------------------------------------------------------- 1. exists -- */
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(CASES);
  } catch {
    console.error(`❌ golden set missing: ${path.relative(ROOT, CASES)}`);
    process.exit(1);
  }
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");

  /* ------------------------------------------------------- 2. hash match -- */
  let card: string;
  try {
    card = await fs.readFile(DATA_CARD, "utf8");
  } catch {
    console.error(`❌ ${path.relative(ROOT, DATA_CARD)} missing`);
    process.exit(1);
  }
  const frozen = card.match(/\*\*Frozen sha256:\*\* `([0-9a-f]{64})`/)?.[1];
  if (!frozen) {
    errors.push("docs/ml/DATA_CARD.md has no `**Frozen sha256:**` line");
  } else if (frozen !== digest) {
    errors.push(
      `golden set hash drift: file is ${digest}, DATA_CARD freezes ${frozen}\n` +
        `    -> either restore the file or re-freeze deliberately (see DATA_CARD "Changing this set")`,
    );
  }

  /* ---------------------------------------------------------- 3. rows ----- */
  const lines = bytes.toString("utf8").split("\n").filter((l) => l.trim());
  const registry = yaml.load(await fs.readFile(SOURCES_YAML, "utf8")) as {
    sources?: Array<{ id: string; use: string; licence?: string }>;
  };
  const byId = new Map(
    (registry.sources ?? []).map((s) => [s.id, s] as const),
  );

  const seenIds = new Set<string>();
  const perTask = new Map<string, number>();

  for (const [i, line] of lines.entries()) {
    const where = `${path.relative(ROOT, CASES)}:${i + 1}`;
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      errors.push(`${where}: invalid JSON`);
      continue;
    }

    const parsed = MlGoldenCaseSchema.safeParse(row);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push(
        `${where}: schema -> ${first ? `${first.path.join(".")} ${first.message}` : "invalid"}`,
      );
      continue;
    }
    const c = parsed.data;

    if (seenIds.has(c.id)) errors.push(`${where}: duplicate id ${c.id}`);
    seenIds.add(c.id);

    perTask.set(c.task, (perTask.get(c.task) ?? 0) + 1);

    const entry = byId.get(c.source);
    if (!entry) {
      errors.push(`${where}: source "${c.source}" not in ml/sources.yaml`);
      continue;
    }
    if (!TRAINABLE_USES.has(entry.use)) {
      errors.push(`${where}: source "${c.source}" has use=${entry.use}`);
    }
    if (entry.licence && c.licence.trim() !== String(entry.licence).trim()) {
      errors.push(`${where}: licence disagrees with ml/sources.yaml`);
    }
    if (c.split !== "eval") errors.push(`${where}: golden case must be split=eval`);
    if (c.synthetic && c.provenance === "measured") {
      errors.push(`${where}: synthetic row claims provenance=measured`);
    }
  }

  /* ------------------------------------------------------- 5. coverage ---- */
  if (lines.length < MIN_CASES) {
    errors.push(`only ${lines.length} cases; need at least ${MIN_CASES}`);
  }
  for (const task of ALL_TASKS) {
    if (!perTask.get(task)) errors.push(`no cases for task "${task}"`);
  }

  /* ----------------------------------------------------------- report ----- */
  console.log(`golden set: ${path.relative(ROOT, CASES)}`);
  console.log(`  sha256 : ${digest}`);
  console.log(`  frozen : ${frozen ?? "(none)"}`);
  console.log(`  rows   : ${lines.length}`);
  for (const task of ALL_TASKS) {
    console.log(`    ${task.padEnd(24)} ${perTask.get(task) ?? 0}`);
  }

  if (errors.length) {
    console.error(`\n❌ golden set check FAILED (${errors.length} issue(s)):`);
    for (const e of errors) console.error(`   - ${e}`);
    process.exit(1);
  }
  console.log("\n✅ golden set matches its frozen hash and passes the schema.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
