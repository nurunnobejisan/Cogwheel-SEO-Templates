/** Text normalization + phrase matching helpers shared by the engine. */

export function normalizeKeyword(input: string): string {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s"'.,;:!?]+|[\s"'.,;:!?]+$/g, "");
}

/** Tokenize into lowercase alphanumeric words ("dog-friendly" → ["dog","friendly"], "st. louis" → ["st","louis"]). */
export function tokenize(input: string): string[] {
  return normalizeKeyword(input)
    .replace(/[^a-z0-9&]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Index of the first occurrence of `phrase` tokens inside `tokens`, or -1. */
export function findPhrase(tokens: string[], phrase: string[], from = 0): number {
  if (phrase.length === 0) return -1;
  outer: for (let i = from; i <= tokens.length - phrase.length; i++) {
    for (let j = 0; j < phrase.length; j++) {
      if (tokens[i + j] !== phrase[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function containsPhrase(text: string | string[], phrase: string): boolean {
  const tokens = Array.isArray(text) ? text : tokenize(text);
  return findPhrase(tokens, tokenize(phrase)) !== -1;
}

/** Parse "1,300" / "1.3K" / 1300 → number (NaN-safe → 0). */
export function parseVolume(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const s = String(value ?? "").trim().toLowerCase().replace(/,/g, "");
  if (!s) return 0;
  const m = s.match(/^([\d.]+)\s*([km])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

const KD_NA = new Set(["", "n/a", "na", "-", "—", "–", "null", "none", "nan", "n.a."]);

/** Parse KD; returns null for N/A-style values. */
export function parseKd(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value ?? "").trim().toLowerCase().replace(/%$/, "").trim();
  if (KD_NA.has(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value ?? "").replace(/[$,]/g, "").trim();
  if (!s || KD_NA.has(s.toLowerCase())) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Derive a bucket-ish group name from a Semrush export filename. */
export function groupFromFilename(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base
    .replace(/\.(csv|xlsx|xls|tsv)$/i, "")
    .replace(/[_-](broad|phrase|exact|related)[-_]match.*$/i, "")
    .replace(/[_-](us|uk|ca|au)[_-]\d{4}-\d{2}-\d{2}.*$/i, "")
    .replace(/[_-]\d{4}-\d{2}-\d{2}.*$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable, collision-free keyword id (the normalized keyword is the dedupe key). */
export function keywordId(normalized: string): string {
  return `kw:${normalized}`;
}
