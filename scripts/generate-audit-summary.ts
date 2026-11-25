import * as fs from 'fs';
import * as path from 'path';

/**
 * Scan the repository for hard‑coded hospitality strings and generate AUDIT_SUMMARY.md
 *
 * This is a simple heuristic implementation. It walks the directory tree,
 * reads text files, and looks for keywords that are specific to the hotel
 * domain (e.g., "Hotel", "LodgingBusiness", "room", "amenities").
 *
 * The output is written to the project root as `AUDIT_SUMMARY.md`.
 */

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'AUDIT_SUMMARY.md');

const HOTEL_KEYWORDS = [
  'Hotel',
  'LodgingBusiness',
  'Room',
  'Amenity',
  'lodging',
  'hospitality',
  'guest',
];

function isTextFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.py'].includes(ext);
}

function scanFile(filePath: string): string[] {
  const matches: string[] = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const kw of HOTEL_KEYWORDS) {
      if (line.includes(kw)) {
        matches.push(`${filePath}:${idx + 1} – ${kw}`);
        break;
      }
    }
  });
  return matches;
}

function walk(dir: string, results: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, and build output directories
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
      walk(full, results);
    } else if (entry.isFile() && isTextFile(full)) {
      results.push(full);
    }
  }
  return results;
}

function generate(): void {
  const files = walk(ROOT);
  const report: string[] = [];
  report.push('# Hard‑coded Hospitality Strings Audit');
  report.push('');
  report.push('The following lines contain domain‑specific literals that may need to be abstracted for universal mode.');
  report.push('');
  for (const file of files) {
    const hits = scanFile(file);
    if (hits.length) {
      report.push(`## ${path.relative(ROOT, file)}`);
      hits.forEach((h) => report.push(`- ${h}`));
      report.push('');
    }
  }
  fs.writeFileSync(OUTPUT, report.join('\n'), 'utf8');
  console.log(`Audit summary written to ${OUTPUT}`);
}

generate();
