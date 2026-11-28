/**
 * Brand hygiene gate.
 *
 * Blocks private client / employer identifiers from the public repository.
 * Generic hotel-chain names (Hilton, Marriott, SpringHill, ...) are valid
 * vocabulary for a hospitality SEO tool and are deliberately NOT blocked —
 * they appear in schemas, tests and documentation as public examples.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Rule = { label: string; pattern: RegExp };

export type BrandViolation = {
  file: string;
  line: number;
  label: string;
  snippet: string;
};

const FORBIDDEN: Rule[] = [
  { label: "private client brand 'Razib'", pattern: /razib/i },
  { label: "private client brand 'Cogwheel'", pattern: /cogwheel/i },
  { label: "legacy product name 'Hilton SEO/GEO Studio'", pattern: /hilton\s+seo\s*\/?\s*geo\s+studio/i },
];

const BINARY_EXTENSIONS = new Set([
  ".bin",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".pdf",
  ".pyc",
  ".tsbuildinfo",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const SKIP_FILES = new Set(["package-lock.json", "tsconfig.tsbuildinfo"]);

export function isScannable(file: string): boolean {
  if (SKIP_FILES.has(path.basename(file))) return false;
  return !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase());
}

/** Scan one text blob. Exported for the unit tests in tests/ts/. */
export function scanBrandText(file: string, text: string): BrandViolation[] {
  const violations: BrandViolation[] = [];

  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(file)) {
      violations.push({ file, line: 0, label: rule.label, snippet: file });
    }
  }

  text.split(/\r?\n/).forEach((line, index) => {
    for (const rule of FORBIDDEN) {
      if (!rule.pattern.test(line)) continue;
      violations.push({
        file,
        line: index + 1,
        label: rule.label,
        snippet: line.trim().slice(0, 160),
      });
    }
  });

  return violations;
}

/** Scan every tracked file in the repository. */
export function scanTrackedFiles(root: string = process.cwd()): BrandViolation[] {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const files = output.split("\0").filter(Boolean);
  const violations: BrandViolation[] = [];

  for (const file of files) {
    violations.push(...scanBrandText(file, ""));
    if (!isScannable(file)) continue;
    const absolute = path.join(root, file);
    let text: string;
    try {
      text = readFileSync(absolute, "utf8");
    } catch {
      continue; // broken symlink or file removed since ls-files
    }
    violations.push(...scanBrandText(file, text));
  }

  return violations;
}

function main(): void {
  const violations = scanTrackedFiles();
  if (violations.length === 0) {
    console.log("Brand hygiene: no private client identifiers found.");
    return;
  }

  console.error(`Brand hygiene: ${violations.length} forbidden identifier(s) found:`);
  for (const violation of violations) {
    const where = violation.line > 0 ? `${violation.file}:${violation.line}` : violation.file;
    console.error(`  ${where} — ${violation.label}: ${violation.snippet}`);
  }
  console.error("Remove the identifier or replace it with a neutral, public example.");
  process.exitCode = 1;
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main();
}
