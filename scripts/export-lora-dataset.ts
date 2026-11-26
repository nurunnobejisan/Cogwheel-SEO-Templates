/**
 * Export reviewed/gold audit → expert-fix triples as LoRA JSONL.
 *
 * Training is NOT started here. The script reports the 2,000-pair gate and can
 * fail a CI job with `--require-ready` when the corpus is too small.
 *
 * Usage:
 *   npm run brain:export-lora -- [--out data/lora-dataset.jsonl] [--require-ready]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  MIN_REVIEWED_PAIRS_FOR_TRAINING,
  buildLoraExample,
  contentHash,
  isTrainingEligible,
  stripPii,
  type TrainingTriple,
} from "../src/core/training/dataset.ts";

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

async function main(): Promise<void> {
  const input = argValue("--in", path.join(process.cwd(), "data", "training-triples.jsonl"));
  const output = argValue("--out", path.join(process.cwd(), "data", "lora-dataset.jsonl"));
  const requireReady = process.argv.includes("--require-ready");
  const dryRun = process.argv.includes("--dry-run");

  let raw = "";
  try {
    raw = await fs.readFile(input, "utf8");
  } catch {
    console.error(`No training triple file at ${input}. Capture and review pairs first.`);
    process.exit(1);
  }

  const triples: TrainingTriple[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      triples.push(JSON.parse(line) as TrainingTriple);
    } catch {
      // Ignore malformed lines rather than exporting invalid rows.
    }
  }

  const reviewed = triples.filter((triple) => triple.quality === "reviewed").length;
  const gold = triples.filter((triple) => triple.quality === "gold").length;
  const eligible = triples.filter((triple) => isTrainingEligible(triple.quality));

  const seen = new Set<string>();
  const rows: string[] = [];
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  for (const triple of eligible) {
    if (triple.audit === null || triple.audit === undefined || triple.expertFix === null || triple.expertFix === undefined) {
      skippedInvalid += 1;
      continue;
    }
    const clean: TrainingTriple = {
      ...triple,
      audit: stripPii(triple.audit),
      expertFix: stripPii(triple.expertFix),
    };
    const hash = triple.contentHash || contentHash(clean.audit, clean.expertFix);
    if (seen.has(hash)) {
      skippedDuplicate += 1;
      continue;
    }
    seen.add(hash);
    rows.push(JSON.stringify(buildLoraExample(clean)));
  }

  const ready = seen.size >= MIN_REVIEWED_PAIRS_FOR_TRAINING;
  console.log(`Training triples: ${triples.length} total (${reviewed} reviewed, ${gold} gold).`);
  console.log(`Eligible after dedupe: ${seen.size}. Skipped: ${skippedDuplicate} duplicate, ${skippedInvalid} invalid.`);
  console.log(`Gate: ${ready ? "READY" : "BLOCKED"} (minimum ${MIN_REVIEWED_PAIRS_FOR_TRAINING} reviewed/gold pairs).`);

  if (rows.length === 0) {
    console.error("No eligible triples; nothing exported.");
    process.exit(1);
  }

  if (!dryRun) {
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, `${rows.join("\n")}\n`, "utf8");
    const manifest = {
      generatedAt: new Date().toISOString(),
      output,
      totalTriples: triples.length,
      reviewed,
      gold,
      exported: seen.size,
      skippedDuplicate,
      skippedInvalid,
      minimumForTraining: MIN_REVIEWED_PAIRS_FOR_TRAINING,
      trainingGate: ready ? "ready" : "blocked",
      trainingStarted: false,
      source: input,
    };
    await fs.writeFile(output.replace(/\.jsonl$/, ".manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Wrote ${seen.size} examples to ${output}`);
    console.log(`Manifest: ${output.replace(/\.jsonl$/, ".manifest.json")}`);
  } else {
    console.log(`Dry run: ${seen.size} examples would be written to ${output}`);
  }

  if (requireReady && !ready) {
    console.error("BLOCKING: reviewed/gold corpus is below the training threshold.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
