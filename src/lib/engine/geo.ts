import { AMBIGUOUS_STATE_CODES, MAJOR_CITIES, US_STATES } from "@/config/geo";
import type { Property } from "@/lib/types";
import { tokenize } from "./normalize";

type GeoKind = "allowed" | "excluded" | "state" | "state-code" | "city";

interface GeoTerm {
  tokens: string[];
  kind: GeoKind;
  label: string;
}

export type GeoVerdict = { ok: true } | { ok: false; term: string; kind: Exclude<GeoKind, "allowed"> };

/** Tie-break when two terms of equal length start at the same token: excluded > allowed > foreign. */
const KIND_RANK: Record<GeoKind, number> = { excluded: 0, allowed: 1, state: 2, "state-code": 2, city: 2 };

/**
 * Build a deterministic wrong-state / wrong-city detector for a property.
 * Scans keyword tokens left-to-right, taking the longest geo term at each position.
 */
export function buildGeoFilter(property: Property): (keyword: string) => GeoVerdict {
  const ownCode = property.state.trim().toUpperCase();
  const ownStateName = US_STATES[ownCode] ?? "";
  const city = property.city.trim().toLowerCase();

  const allowedPhrases = new Set<string>(
    [
      city,
      ownStateName,
      ownCode.toLowerCase(),
      city && ownCode ? `${city} ${ownCode.toLowerCase()}` : "",
      city && ownStateName ? `${city} ${ownStateName}` : "",
      ...property.allowedLocations,
    ]
      .map((s) => tokenize(s).join(" "))
      .filter(Boolean),
  );

  const terms: GeoTerm[] = [];
  const add = (phrase: string, kind: GeoKind, label = phrase) => {
    const tokens = tokenize(phrase);
    if (tokens.length) terms.push({ tokens, kind, label });
  };

  allowedPhrases.forEach((p) => add(p, "allowed"));
  property.excludedLocations.forEach((p) => add(p, "excluded"));

  for (const [code, name] of Object.entries(US_STATES)) {
    if (code === ownCode) continue;
    if (!allowedPhrases.has(name)) add(name, "state");
    const lc = code.toLowerCase();
    if (!AMBIGUOUS_STATE_CODES.has(lc) && !allowedPhrases.has(lc)) add(lc, "state-code", code);
  }
  for (const [name] of MAJOR_CITIES) {
    const key = tokenize(name).join(" ");
    if (!allowedPhrases.has(key)) add(name, "city");
  }

  // Index by first token for O(tokens) scanning.
  const index = new Map<string, GeoTerm[]>();
  for (const t of terms) {
    const list = index.get(t.tokens[0]) ?? [];
    list.push(t);
    index.set(t.tokens[0], list);
  }
  index.forEach((list) =>
    list.sort((a, b) => b.tokens.length - a.tokens.length || KIND_RANK[a.kind] - KIND_RANK[b.kind]),
  );

  return (keyword: string): GeoVerdict => {
    const tokens = tokenize(keyword);
    let i = 0;
    while (i < tokens.length) {
      const candidates = index.get(tokens[i]);
      let matched: GeoTerm | undefined;
      if (candidates) {
        matched = candidates.find((t) => t.tokens.every((tok, j) => tokens[i + j] === tok));
      }
      if (!matched) {
        i++;
        continue;
      }
      if (matched.kind !== "allowed") {
        return { ok: false, term: matched.label, kind: matched.kind };
      }
      i += matched.tokens.length;
    }
    return { ok: true };
  };
}

