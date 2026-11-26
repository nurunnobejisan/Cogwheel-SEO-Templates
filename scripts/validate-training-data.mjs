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
 * Usage: node scripts/validate-training-data.mjs [file ...]
 * Default files: data/training/unified_seo_train.jsonl, data/training/unified_seo_eval.jsonl
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_FILES = [
  "data/training/unified_seo_train.jsonl",
  "data/training/unified_seo_eval.jsonl",
];

const ALLOWED_CATEGORIES = new Set([
  "Google Algorithm Updates",
  "20 Claude-SEO Agents",
  "78-Keyword Strategy & Intent",
  "Search Console Cannibalization & GEO",
]);

const ALLOWED_PROVENANCE = new Set(["measured", "estimated", "unavailable"]);

// Fabricated-metric signatures. Kept precise to avoid flagging guardrail prose
// such as "never invent search volume".
const FABRICATION_PATTERNS = [
  { id: "placeholder", re: /\{\{[A-Za-z0-9_]+\}\}/g },
  { id: "benchmark-cpc", re: /Benchmark CPC/gi },
  { id: "volume-tier", re: /Search Volume Tier/gi },
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
  for (const { id, re } of FABRICATION_PATTERNS) {
    const matches = text.match(re);
    if (matches) hits.push(`${id}: ${[...new Set(matches)].slice(0, 3).join(", ")}`);
  }
  return hits;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = args.length ? args : DEFAULT_FILES;
  const errors = [];
  const seenKeys = new Map();
  let total = 0;

  for (const rel of files) {
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

      const meta = row.meta ?? {};
      if (!ALLOWED_CATEGORIES.has(meta.category)) {
        errors.push(`${where}: meta.category missing or unrecognised (${meta.category ?? "none"})`);
      }
      if (!ALLOWED_PROVENANCE.has(meta.provenance)) {
        errors.push(`${where}: meta.provenance missing or unrecognised (${meta.provenance ?? "none"})`);
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
