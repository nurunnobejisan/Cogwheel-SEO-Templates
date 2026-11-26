/**
 * CI-friendly GEO drift check.
 *
 * Usage:
 *   npm run geo:drift -- baseline.json current.json [--threshold 5]
 *
 * Each file may be a GeoSnapshot or an object containing `.snapshot`
 * (for example a saved /api/geo/check response). Exits non-zero when drift
 * fails the threshold, so a scheduled job can gate a deploy.
 */

import { promises as fs } from "node:fs";
import { diffGeoSnapshots } from "../rules/geo/drift.ts";
import type { GeoSnapshot } from "../rules/geo/types.ts";

function readThreshold(args: string[]): number {
  const index = args.indexOf("--threshold");
  if (index === -1) return 5;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value >= 0 ? value : 5;
}

async function load(file: string): Promise<GeoSnapshot> {
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  const snapshot = parsed?.snapshot ?? parsed;
  if (!snapshot || typeof snapshot.citabilityScore !== "number" || typeof snapshot.capturedAt !== "string") {
    throw new Error(`${file} is not a GEO snapshot`);
  }
  return snapshot as GeoSnapshot;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--threshold"));
  const threshold = readThreshold(process.argv.slice(2));
  if (args.length < 2) {
    console.error("Usage: npm run geo:drift -- baseline.json current.json [--threshold 5]");
    process.exit(2);
  }
  const baseline = await load(args[0]!);
  const current = await load(args[1]!);
  const drift = diffGeoSnapshots(baseline, current, { failThreshold: threshold });

  console.log(`GEO drift: ${drift.status.toUpperCase()} (threshold ${drift.failThreshold})`);
  console.log(`Citability: ${baseline.citabilityScore} → ${current.citabilityScore} (${drift.scoreDelta! >= 0 ? "+" : ""}${drift.scoreDelta})`);
  for (const delta of drift.deltas) {
    console.log(`  ${delta.metric}: ${delta.before} → ${delta.after}`);
  }
  if (drift.regressions.length > 0) {
    console.error("Regressions:");
    for (const regression of drift.regressions) console.error(`  - ${regression}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
