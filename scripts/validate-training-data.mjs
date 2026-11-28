#!/usr/bin/env node
/**
 * Validate the unified SEO SFT datasets (train + eval).
 *
 * This is the CI gate for the data-governance rule: never train on fabricated
 * or unresolved data. It fails (exit 1) if any row:
 *   - is not valid JSON, or is not a 3-role system/user/assistant record
 *   - contains an unresolved `{{placeholder}}`
 *   - asserts an invented metric (currency, %, CPC, volume, authority, rank,
 *     searches/backlinks/impressions/clicks counts)
 *   - lacks a recognised `meta.category` or `meta.provenance`
 *   - duplicates another row's content (user + assistant) within or across files
 *
 * Phase 0 additions (licence / synthetic governance):
 *   - references a `meta.source` that is not in ml/sources.yaml
 *   - is an ML-task row (see ML_TASK_CATEGORIES) without `meta.source`,
 *     `meta.licence` and `meta.synthetic`
 *   - sits in a TRAIN file while its source's `use` is `avoid` or `eval_only`
 *   - carries a `meta.licence` that disagrees with ml/sources.yaml
 *   - is `synthetic: true` inside a TRAIN file, or is synthetic yet marked
 *     `provenance: "measured"` (rule 6)
 *
 * Usage: node scripts/validate-training-data.mjs [file ...]
 * Default files: data/training/unified_seo_train.jsonl, data/training/unified_seo_eval.jsonl
 *
 * Golden evaluation cases live in a different shape; they are validated against
 * the Zod single source of truth by scripts/validate-ml-examples.ts, which is
 * chained onto `npm run train:validate`.
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";

const DEFAULT_FILES = [
  "data/training/unified_seo_train.jsonl",
  "data/training/unified_seo_eval.jsonl",
];

const ML_TASK_CATEGORIES = new Set([
  "schema_generation",
  "metadata_generation",
  "rag_synthesis",
  "page_classification",
  "entity_gap_analysis",
]);

const ALLOWED_CATEGORIES = new Set([
  "Google Algorithm Updates",
  "20 Claude-SEO Agents",
  "78-Keyword Strategy & Intent",
  "Search Console Cannibalization & GEO",
  ...ML_TASK_CATEGORIES,
]);

const ALLOWED_PROVENANCE = new Set(["measured", "estimated", "unavailable"]);

/** `use` values that may enter a train split. */
const TRAINABLE_USES = new Set(["train", "train_attribution"]);

/** Resolved from this file's location so the registry is found from any cwd. */
const SOURCES_YAML = fileURLToPath(new URL("../ml/sources.yaml", import.meta.url));

/** id -> { use, licence, attribution_required, feeds } */
async function loadSourceRegistry() {
  const raw = await fs.readFile(SOURCES_YAML, "utf8");
  const doc = yaml.load(raw);
  const entries = Array.isArray(doc?.sources) ? doc.sources : [];
  if (!entries.length) {
    throw new Error(`ml/sources.yaml declares no \`sources\` entries`);
  }
  const byId = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || typeof entry.use !== "string") {
      throw new Error("ml/sources.yaml: every entry needs a string `id` and `use`");
    }
    if (byId.has(entry.id)) throw new Error(`ml/sources.yaml: duplicate id ${entry.id}`);
    byId.set(entry.id, entry);
  }
  return byId;
}

/**
 * A file is a train file when its name carries `train` (unified_seo_train.jsonl,
 * .../train/*.jsonl). Eval/test files never are.
 */
function isTrainFile(rel) {
  return /(^|[/\\_.-])train([/\\_.-]|$)/i.test(rel);
}

// Unambiguously bad regardless of who wrote them, anywhere in the row.
const HARD_PATTERNS = [
  { id: "placeholder", re: /\{\{[A-Za-z0-9_]+\}\}/g },
  { id: "benchmark-cpc", re: /Benchmark CPC/gi },
  { id: "volume-tier", re: /Search Volume Tier/gi },
  // De-brand guard: the retired product name must never re-enter training
  // data — a model trained on it would reintroduce the old brand in output.
  { id: "legacy-brand", re: new RegExp("\\b" + ["Cog", "wheel"].join("") + "\\b", "gi") },
];

// Metric assertions that are only a problem when the ASSISTANT invents them,
// i.e. the value is not traceable to the user/system text it was given.
const ASSISTANT_METRIC_PATTERNS = [
  { id: "currency", re: /\$\s?\d[\d,]*(?:\.\d+)?/g },
  { id: "percent", re: /\b\d+(?:\.\d+)?\s?%/g },
  { id: "search-volume-value", re: /search volume\s*(?:of|is|was|[:=])\s*[\d$]/gi },
  { id: "cpc-value", re: /CPC\s*(?:of|is|was|[:=])\s*\$?\d/gi },
  { id: "authority-value", re: /\b(?:DA|DR|domain authority|domain rating)\s*(?:of|is|was|[:=])\s*\d/gi },
  { id: "rank-value", re: /\brank(?:ed|s|ing)?\s*#?\s*\d{1,3}\b/gi },
  { id: "position-value", re: /\baverage\s+position\s*(?:of|is|was|[:=])\s*\d/gi },
  { id: "count-value", re: /\b[\d,]{2,}\s+(?:monthly\s+)?(?:searches|backlinks|impressions|clicks)\b/gi },
];

function norm(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function contentKey(messages) {
  const payload = `${norm(messages[1].content)}\u241f${norm(messages[2].content)}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function scanText(text) {
  const hits = [];
  for (const { id, re } of HARD_PATTERNS) {
    const matches = text.match(re);
    if (matches) hits.push(`${id}: ${[...new Set(matches)].slice(0, 3).join(", ")}`);
  }
  return hits;
}

/** Metrics the assistant states that are not traceable to the given text. */
function scanAssistantForInventedMetrics(assistant, supplied) {
  const hits = [];
  const suppliedNorm = norm(supplied);
  for (const { id, re } of ASSISTANT_METRIC_PATTERNS) {
    const invented = new Set();
    for (const match of assistant.matchAll(re)) {
      const value = norm(match[0]);
      if (!suppliedNorm.includes(value)) invented.add(match[0].trim());
    }
    if (invented.size) hits.push(`${id}: ${[...invented].slice(0, 3).join(", ")}`);
  }
  return hits;
}

/**
 * Licence / synthetic governance for one row (rules 3 and 6).
 *
 * Legacy rows (the four original categories) predate the licence registry and
 * carry no `meta.source`; they are left alone so this stays backward
 * compatible. ML-task rows must be fully attributed.
 */
function scanMetaGovernance({ meta, trainFile, registry }) {
  const hits = [];
  const isMlTask = ML_TASK_CATEGORIES.has(meta.category);
  const source = typeof meta.source === "string" ? meta.source : null;
  const entry = source ? registry.get(source) : null;

  if (isMlTask) {
    if (!source) hits.push("licence: meta.source is required for ML-task rows");
    if (typeof meta.licence !== "string" || !meta.licence.trim()) {
      hits.push("licence: meta.licence is required for ML-task rows");
    }
    if (typeof meta.synthetic !== "boolean") {
      hits.push("synthetic: meta.synthetic (true/false) is required for ML-task rows");
    }
  }

  if (source && !entry) {
    hits.push(`licence: meta.source "${source}" is not declared in ml/sources.yaml`);
  }

  if (entry) {
    if (!TRAINABLE_USES.has(entry.use) && trainFile) {
      hits.push(
        `licence: source "${source}" has use=${entry.use}, which may not enter a train file`,
      );
    }
    if (
      typeof meta.licence === "string" &&
      meta.licence.trim() &&
      entry.licence &&
      meta.licence.trim() !== String(entry.licence).trim()
    ) {
      hits.push(
        `licence: meta.licence "${meta.licence}" disagrees with ml/sources.yaml ("${entry.licence}")`,
      );
    }
  }

  if (meta.synthetic === true) {
    if (trainFile) hits.push("synthetic: synthetic rows may not enter a train file (rule 6)");
    if (meta.provenance === "measured") {
      hits.push("synthetic: a synthetic row cannot claim provenance=measured (rule 6)");
    }
  }

  return hits;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = args.length ? args : DEFAULT_FILES;
  const errors = [];
  const seenKeys = new Map();
  let total = 0;

  let registry;
  try {
    registry = await loadSourceRegistry();
    console.log(`licence registry: ml/sources.yaml (${registry.size} sources)`);
  } catch (err) {
    console.error(`❌ cannot load ml/sources.yaml: ${err.message}`);
    process.exit(1);
  }

  for (const rel of files) {
    const trainFile = isTrainFile(rel);
    const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    let lines;
    try {
      lines = (await fs.readFile(abs, "utf8")).split("\n").filter((l) => l.trim());
    } catch (err) {
      errors.push(`${rel}: cannot read (${err.message})`);
      continue;
    }

    let rows = 0;
    for (const [index, line] of lines.entries()) {
      rows += 1;
      total += 1;
      const where = `${rel}:${index + 1}`;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        errors.push(`${where}: invalid JSON`);
        continue;
      }

      const msgs = row.messages;
      if (!Array.isArray(msgs) || msgs.length !== 3) {
        errors.push(`${where}: expected 3 messages, got ${Array.isArray(msgs) ? msgs.length : "none"}`);
        continue;
      }
      const roles = msgs.map((m) => m && m.role).join(",");
      if (roles !== "system,user,assistant") {
        errors.push(`${where}: roles must be system,user,assistant (got ${roles})`);
      }
      if (msgs.some((m) => typeof m?.content !== "string" || !m.content.trim())) {
        errors.push(`${where}: empty message content`);
      }

      const joined = msgs.map((m) => m.content ?? "").join("\n");
      for (const hit of scanText(joined)) {
        errors.push(`${where}: fabricated/unresolved content -> ${hit}`);
      }
      const supplied = `${msgs[0].content ?? ""}\n${msgs[1].content ?? ""}`;
      for (const hit of scanAssistantForInventedMetrics(msgs[2].content ?? "", supplied)) {
        errors.push(`${where}: assistant invented metric -> ${hit}`);
      }

      const meta = row.meta ?? {};
      if (!ALLOWED_CATEGORIES.has(meta.category)) {
        errors.push(`${where}: meta.category missing or unrecognised (${meta.category ?? "none"})`);
      }
      if (!ALLOWED_PROVENANCE.has(meta.provenance)) {
        errors.push(`${where}: meta.provenance missing or unrecognised (${meta.provenance ?? "none"})`);
      }
      for (const hit of scanMetaGovernance({ meta, trainFile, registry })) {
        errors.push(`${where}: ${hit}`);
      }

      const key = contentKey(msgs);
      if (seenKeys.has(key)) {
        errors.push(`${where}: duplicate content with ${seenKeys.get(key)}`);
      } else {
        seenKeys.set(key, where);
      }
    }
    console.log(`${rel}: ${rows} rows scanned`);
  }

  if (errors.length) {
    console.error(`\n❌ training-data validation FAILED (${errors.length} issue(s)):`);
    for (const e of errors.slice(0, 60)) console.error(`   - ${e}`);
    if (errors.length > 60) console.error(`   ...and ${errors.length - 60} more`);
    process.exit(1);
  }

  console.log(`\n✅ training-data validation passed: ${total} rows, no placeholders, no invented metrics, no duplicates.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
