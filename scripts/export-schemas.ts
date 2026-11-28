/**
 * SEO Studio Templates — Shared JSON Schema Exporter
 *
 * `schemas/` is the single source of truth for every schema contract (see
 * docs/PROJECT_STRUCTURE.md, rule 6 + "No duplicates"). The Python engine reads
 * the same five contracts from `shared/schemas/`, so this script *mirrors* the
 * canonical files there instead of redefining them by hand — which previously
 * duplicated the definitions and let the two copies drift apart.
 *
 * Run: `npm run export:schemas`
 */

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.resolve(rootDir, "schemas");
const targetDir = path.resolve(rootDir, "shared/schemas");

/** Canonical contracts under `schemas/` that Python consumes from `shared/schemas/`. */
const SHARED_SCHEMAS = [
  "destination-guide.schema.json",
  "room-showcase.schema.json",
  "hotel-faq.schema.json",
  "page-metadata.schema.json",
  "site-manifest.schema.json",
] as const;

fs.mkdirSync(targetDir, { recursive: true });

console.log("Mirroring shared JSON Schema contracts from schemas/ → shared/schemas/ ...");

for (const fileName of SHARED_SCHEMAS) {
  const sourcePath = path.join(sourceDir, fileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Missing canonical schema: schemas/${fileName}. ` +
        `schemas/ is the source of truth — restore the file before exporting.`,
    );
  }

  // Re-serialise through JSON so the mirror is always valid, normalised JSON.
  const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as unknown;
  fs.writeFileSync(path.join(targetDir, fileName), JSON.stringify(parsed, null, 2) + "\n", "utf8");
  console.log(`   • shared/schemas/${fileName}`);
}

console.log(`✔ Successfully mirrored ${SHARED_SCHEMAS.length} JSON Schema contracts to /shared/schemas/`);
