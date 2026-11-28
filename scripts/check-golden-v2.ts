#!/usr/bin/env tsx
/**
 * Validate ml/eval/golden_v2/cases.jsonl without modifying the frozen 52-case set.
 *
 * Checks:
 *   - Every row matches MlGoldenCaseSchema and declares humanReviewed === true
 *   - Source is present in ml/sources.yaml with matching licence (eval-eligible)
 *   - Zero host / domainHash overlap with training hosts (--train-file)
 *   - Coverage targets: >= 75 schema_generation and >= 75 metadata_generation
 *     (enforced strictly by default / `--strict`; use `--allow-partial` during collection)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { MlGoldenCaseSchema } from "../schemas/ml-example.ts";

export const GOLDEN_V2_TARGET_PER_TASK = 75;
export const GOLDEN_V2_TASKS = ["schema_generation", "metadata_generation"] as const;

const ROOT = process.cwd();
const DEFAULT_V2_PATH = path.join(ROOT, "ml/eval/golden_v2/cases.jsonl");
const DEFAULT_TRAIN_PATH = path.join(ROOT, "data/build/sft-v2.jsonl");
const SOURCES_YAML = fileURLToPath(new URL("../ml/sources.yaml", import.meta.url));

export interface GoldenV2CheckOptions {
  casesPath?: string;
  trainFilePath?: string;
  allowPartial?: boolean;
  targetPerTask?: number;
}

export interface GoldenV2CheckResult {
  ok: boolean;
  totalRows: number;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
}

export function extractHostKey(urlOrHost: string | undefined): string {
  const raw = (urlOrHost ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    let host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (host.startsWith("www.")) host = host.slice(4);
    const parts = host.split(".").filter(Boolean);
    if (parts.length <= 2) return parts.join(".");
    return parts.slice(-2).join(".");
  } catch {
    return "";
  }
}

async function loadTrainExclusionKeys(trainFilePath?: string): Promise<{
  hosts: Set<string>;
  domainHashes: Set<string>;
}> {
  const hosts = new Set<string>();
  const domainHashes = new Set<string>();
  if (!trainFilePath) return { hosts, domainHashes };

  let raw = "";
  try {
    raw = await fs.readFile(trainFilePath, "utf8");
  } catch {
    return { hosts, domainHashes };
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as {
        split?: string;
        meta?: { split?: string; hostHash?: string; domainHash?: string };
        input?: { url?: string; domainHash?: string };
      };
      const split = obj.meta?.split ?? obj.split;
      if (split && split !== "train") continue;
      if (obj.meta?.hostHash) domainHashes.add(obj.meta.hostHash.toLowerCase());
      if (obj.meta?.domainHash) domainHashes.add(obj.meta.domainHash.toLowerCase());
      if (obj.input?.domainHash) domainHashes.add(obj.input.domainHash.toLowerCase());
      const host = extractHostKey(obj.input?.url);
      if (host) hosts.add(host);
    } catch {
      // Ignore malformed train lines cleanly; handled by train:validate.
    }
  }
  return { hosts, domainHashes };
}

export async function evaluateGoldenV2(
  opts: GoldenV2CheckOptions = {},
): Promise<GoldenV2CheckResult> {
  const casesPath = opts.casesPath ?? DEFAULT_V2_PATH;
  const allowPartial = opts.allowPartial ?? false;
  const targetPerTask = opts.targetPerTask ?? GOLDEN_V2_TARGET_PER_TASK;
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {
    schema_generation: 0,
    metadata_generation: 0,
  };

  let raw = "";
  try {
    raw = await fs.readFile(casesPath, "utf8");
  } catch (err) {
    return {
      ok: false,
      totalRows: 0,
      counts,
      errors: [`cannot read ${casesPath}: ${(err as Error).message}`],
      warnings,
    };
  }

  const registryDoc = yaml.load(await fs.readFile(SOURCES_YAML, "utf8")) as {
    sources?: Array<{ id: string; use: string; licence?: string }>;
  };
  const registry = new Map((registryDoc.sources ?? []).map((s) => [s.id, s] as const));
  const { hosts: trainHosts, domainHashes: trainHashes } = await loadTrainExclusionKeys(
    opts.trainFilePath ?? DEFAULT_TRAIN_PATH,
  );

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const seenIds = new Set<string>();

  for (const [index, line] of lines.entries()) {
    const where = `${path.basename(casesPath)}:${index + 1}`;
    let parsedJson: Record<string, unknown>;
    try {
      parsedJson = JSON.parse(line) as Record<string, unknown>;
    } catch {
      errors.push(`${where}: invalid JSON`);
      continue;
    }

    const parsed = MlGoldenCaseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push(
        `${where}: schema -> ${issue ? `${issue.path.join(".")}: ${issue.message}` : "invalid"}`,
      );
      continue;
    }

    const c = parsed.data;
    if (seenIds.has(c.id)) errors.push(`${where}: duplicate id ${c.id}`);
    seenIds.add(c.id);

    if (parsedJson.humanReviewed !== true) {
      errors.push(`${where}: golden v2 requires humanReviewed: true before promotion (D-026)`);
    }

    const entry = registry.get(c.source);
    if (!entry) {
      errors.push(`${where}: unknown source ${c.source}`);
    } else if (entry.use === "avoid") {
      errors.push(`${where}: source ${c.source} has use=avoid`);
    } else if (entry.licence && c.licence.trim() !== entry.licence.trim()) {
      errors.push(`${where}: licence disagrees with ml/sources.yaml`);
    }

    if (c.synthetic && c.provenance === "measured") {
      errors.push(`${where}: synthetic row cannot claim provenance=measured`);
    }

    const host = extractHostKey(c.input.url);
    const dHash = c.input.domainHash.toLowerCase();
    if (host && trainHosts.has(host)) {
      errors.push(`${where}: host ${host} overlaps with training split`);
    }
    if (trainHashes.has(dHash)) {
      errors.push(`${where}: domainHash ${dHash} overlaps with training split`);
    }

    if (c.task === "schema_generation" || c.task === "metadata_generation") {
      counts[c.task] = (counts[c.task] ?? 0) + 1;
    }
  }

  for (const task of GOLDEN_V2_TASKS) {
    const n = counts[task] ?? 0;
    if (n < targetPerTask) {
      const msg = `${task}: ${n}/${targetPerTask} human-reviewed cases`;
      if (allowPartial) warnings.push(`${msg} (allow-partial)`);
      else errors.push(`insufficient coverage for ${msg}`);
    }
  }

  return {
    ok: errors.length === 0,
    totalRows: lines.length,
    counts,
    errors,
    warnings,
  };
}

async function runCli(): Promise<void> {
  const argv = process.argv.slice(2);
  const allowPartial = argv.includes("--allow-partial") && !argv.includes("--strict");
  let casesPath = DEFAULT_V2_PATH;
  let trainFilePath = DEFAULT_TRAIN_PATH;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--cases" && argv[i + 1]) casesPath = path.resolve(argv[++i]!);
    if (argv[i] === "--train-file" && argv[i + 1]) trainFilePath = path.resolve(argv[++i]!);
  }

  const res = await evaluateGoldenV2({ casesPath, trainFilePath, allowPartial });
  console.log(`golden v2 (${path.relative(ROOT, casesPath)}): ${res.totalRows} row(s)`);
  for (const task of GOLDEN_V2_TASKS) {
    console.log(`  ${task.padEnd(22)} ${res.counts[task] ?? 0}/${GOLDEN_V2_TARGET_PER_TASK}`);
  }
  for (const w of res.warnings) console.warn(`  ⚠ ${w}`);
  if (!res.ok) {
    console.error(`\n❌ golden v2 check FAILED (${res.errors.length} issue(s)):`);
    for (const e of res.errors.slice(0, 40)) console.error(`   - ${e}`);
    process.exit(1);
  }
  console.log("\n✅ golden v2 check passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
