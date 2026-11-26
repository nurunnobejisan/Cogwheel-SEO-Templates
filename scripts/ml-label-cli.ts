#!/usr/bin/env tsx
/**
 * ml-label-cli — run the SEO Studio rules engine on an HTML file and emit
 * findings as JSON.
 *
 * This is the bridge the Python build pipeline calls, so labelling is always
 * done by THE RULES ENGINE (rule 2: models never produce or override audit
 * scores). Never re-implement a rule in Python.
 *
 * Usage:
 *   npx tsx scripts/ml-label-cli.ts <page.html> [options]
 *   cat page.html | npx tsx scripts/ml-label-cli.ts - --url https://example.com/
 *
 * Options:
 *   --url <url>          Page URL (default https://example.com/)
 *   --mode <hotel|univ>  Force a mode instead of auto-detection
 *   --compact            Single-line JSON (for piping into Python)
 *   --help               This text
 *
 * Output (stdout): one JSON object
 *   {
 *     "url", "domain", "mode", "auditId", "timestamp",
 *     "summary": { ... },
 *     "findings": [ AuditIssue, ... ],
 *     "findingsCount": <n>,
 *     "provenance": "measured"
 *   }
 *
 * Diagnostics go to stderr so stdout stays pipeable. Exit code 0 on success,
 * 1 on any error, 2 on bad usage.
 */

import fs from "node:fs";
import { buildSnapshotFromHtml } from "../rules/html-snapshot.ts";
import { runAudit } from "../rules/index.ts";
import type { AuditMode, ModeOverrideStoreLike } from "../rules/types.ts";

const USAGE = `ml-label-cli — label an HTML page with the SEO Studio rules engine

  npx tsx scripts/ml-label-cli.ts <page.html|--url ...> [options]

Options:
  --url <url>          Page URL (default https://example.com/)
  --mode <hotel|univ>  Force a mode instead of auto-detection
  --compact            Emit single-line JSON
  --help               Show this help
`;

interface CliOptions {
  file: string | null;
  url: string;
  mode: AuditMode | null;
  compact: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    file: null,
    url: "https://example.com/",
    mode: null,
    compact: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--compact") {
      opts.compact = true;
    } else if (arg === "--url") {
      const value = argv[++i];
      if (!value) throw new Error("--url requires a value");
      opts.url = value;
    } else if (arg === "--mode") {
      const value = argv[++i];
      if (value === "hotel" || value === "univ" || value === "universal") {
        opts.mode = value === "hotel" ? "hotel" : "universal";
      } else {
        throw new Error(`--mode must be hotel or univ (got "${value ?? ""}")`);
      }
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option ${arg}`);
    } else if (opts.file === null) {
      opts.file = arg;
    } else {
      throw new Error(`unexpected extra argument "${arg}"`);
    }
  }
  return opts;
}

function readInput(file: string | null): string {
  if (file === null || file === "-") {
    return fs.readFileSync(0, "utf8");
  }
  return fs.readFileSync(file, "utf8");
}

function forcedModeStore(mode: AuditMode): ModeOverrideStoreLike {
  return {
    get: () => mode,
    set: () => {
      /* no-op: the CLI is stateless */
    },
  };
}

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }

  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  if (opts.file === null && process.stdin.isTTY) {
    process.stderr.write(`No input file given.\n\n${USAGE}`);
    return 2;
  }

  let html: string;
  try {
    html = readInput(opts.file);
  } catch (err) {
    process.stderr.write(`cannot read input: ${(err as Error).message}\n`);
    return 1;
  }

  if (!html.trim()) {
    process.stderr.write("input is empty\n");
    return 1;
  }

  try {
    const snapshot = buildSnapshotFromHtml(html, opts.url);
    const report = runAudit(snapshot, {
      ...(opts.mode ? { overrideStore: forcedModeStore(opts.mode) } : {}),
    });

    const payload = {
      url: report.pageUrl,
      domain: report.domain,
      mode: report.mode,
      auditId: report.auditId,
      timestamp: report.timestamp,
      summary: report.summary,
      findings: report.issues,
      findingsCount: report.issues.length,
      // Every finding is derived from the supplied HTML — nothing simulated.
      provenance: "measured",
    };

    process.stdout.write(`${JSON.stringify(payload, null, opts.compact ? 0 : 2)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`audit failed: ${(err as Error).message}\n`);
    return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  },
);
