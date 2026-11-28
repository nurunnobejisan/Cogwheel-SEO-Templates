import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

const TOKEN_STRICT_DIRS = [
  "src/components/ui",
  "src/components/data",
  "src/components/shell",
  "src/components/motion",
  "src/components/pages",
  "src/app/dev",
  "src/app/(app)",
  "src/app/(public)",
];

const BANNED_PALETTE = /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const DARK_PREFIX = /\bdark:/;
const BANNED_RADII = /\brounded-(?:2xl|3xl)\b/;

function collectFiles(relDir: string): string[] {
  const full = path.join(ROOT, relDir);
  try {
    if (!statSync(full).isDirectory()) return [];
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of readdirSync(full)) {
    const child = path.join(full, entry);
    if (statSync(child).isDirectory()) {
      out.push(...collectFiles(path.join(relDir, entry)));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(child);
    }
  }
  return out;
}

describe("Design token discipline across migrated UI directories", () => {
  it("contains zero raw hex, non-token Tailwind palettes, dark: prefixes, or rounded-2xl/3xl", () => {
    const violations: string[] = [];
    for (const dir of TOKEN_STRICT_DIRS) {
      for (const file of collectFiles(dir)) {
        const rel = path.relative(ROOT, file);
        const content = readFileSync(file, "utf8");
        if (RAW_HEX.test(content)) violations.push(`${rel}: raw hex color`);
        if (BANNED_PALETTE.test(content)) violations.push(`${rel}: non-token palette class`);
        if (DARK_PREFIX.test(content)) violations.push(`${rel}: manual dark: class`);
        if (BANNED_RADII.test(content)) violations.push(`${rel}: banned rounded-2xl/3xl`);
      }
    }
    expect(violations).toEqual([]);
  });
});
