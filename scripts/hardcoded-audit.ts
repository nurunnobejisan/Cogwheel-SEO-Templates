import * as fs from 'node:fs';
import * as path from 'node:path';

const PATTERNS = [
  /\b(LodgingBusiness|HotelRoom|checkInTime|checkOutTime|starRating|amenityFeature)\b/g,
  /\b(synxis|travelclick|cloudbeds|ihotelier)\b/gi,
  /https?:\/\/(?!schema\.org|www\.w3\.org|example\.com)[a-zA-Z0-9.-]+\.[a-z]{2,}/g,
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|py|json|md)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const findings: string[] = ['# Hardcoded & Hospitality Dependency Audit\n'];
for (const file of walk(process.cwd())) {
  const content = fs.readFileSync(file, 'utf8');
  content.split('\n').forEach((line, idx) => {
    for (const regex of PATTERNS) {
      if (regex.test(line)) {
        findings.push(`- \`${path.relative(process.cwd(), file)}:${idx + 1}\` — \`${line.trim().slice(0, 100)}\``);
      }
      regex.lastIndex = 0;
    }
  });
}

fs.writeFileSync('AUDIT_SUMMARY.md', findings.join('\n'), 'utf8');
console.log(`Wrote AUDIT_SUMMARY.md with ${findings.length - 1} matches.`);
