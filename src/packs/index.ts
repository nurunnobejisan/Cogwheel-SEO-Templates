/**
 * Vertical pack registry (docs/TASKS.md Task 2.1).
 *
 * Validates and stores Pack objects. Registration fails loudly rather than
 * letting a malformed pack reach scoring: weights must sum to 1, ids must be
 * unique slugs, and every page type must be one the classifier can emit.
 *
 * Packs register themselves from `src/packs/<id>/index.ts`; the hotel pack
 * lands in Task 2.2.
 */
import type { Pack, PackPageType } from "./types";

export * from "./types";

/** Page types the classifier may emit — kept in sync with rules/types vocabulary. */
export const KNOWN_PAGE_TYPES: ReadonlySet<PackPageType> = new Set([
  "home",
  "product",
  "category",
  "article",
  "location",
  "booking",
  "contact",
  "other",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WEIGHT_EPSILON = 1e-6;

/**
 * Returns a list of human-readable problems; empty means the pack is valid.
 */
export function validatePack(pack: Pack): string[] {
  const problems: string[] = [];

  if (!SLUG_PATTERN.test(pack.id)) {
    problems.push(`id "${pack.id}" must be a lowercase kebab-case slug`);
  }
  if (!pack.name.trim()) {
    problems.push("name must not be empty");
  }
  if (pack.pageTypes.length === 0) {
    problems.push("pageTypes must list at least one page type");
  }
  for (const pageType of pack.pageTypes) {
    if (!KNOWN_PAGE_TYPES.has(pageType)) {
      problems.push(`unknown pageType "${pageType}"`);
    }
  }

  const { onPage, schema, geoAi } = pack.scoringWeights;
  const total = onPage + schema + geoAi;
  if (Math.abs(total - 1) > WEIGHT_EPSILON) {
    problems.push(`scoringWeights must sum to 1, got ${total}`);
  }

  if (pack.checklist.length === 0) {
    problems.push("checklist must contain at least one item");
  }
  if (pack.keywordMatrix.keywords.length === 0) {
    problems.push("keywordMatrix must contain at least one keyword");
  }
  if (Object.keys(pack.brandGuardrails).length === 0) {
    problems.push("brandGuardrails must define at least one brand");
  }

  const promptIds = new Set<string>();
  for (const prompt of pack.aiPrompts) {
    if (promptIds.has(prompt.id)) {
      problems.push(`duplicate aiPrompt id "${prompt.id}"`);
    }
    promptIds.add(prompt.id);
  }

  return problems;
}

const registry = new Map<string, Pack>();

/**
 * Registers a pack. Throws with the full problem list when invalid, and on
 * duplicate ids so a rename cannot silently shadow an existing pack.
 */
export function registerPack(pack: Pack): void {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`Invalid pack "${pack.id}":\n  - ${problems.join("\n  - ")}`);
  }
  if (registry.has(pack.id)) {
    throw new Error(`Pack "${pack.id}" is already registered`);
  }
  registry.set(pack.id, pack);
}

/** Looks up a pack by id, or undefined when none is registered. */
export function getPack(id: string): Pack | undefined {
  return registry.get(id);
}

/** All registered packs in registration order. */
export function listPacks(): Pack[] {
  return Array.from(registry.values());
}

/** Removes a pack — intended for tests and hot-swap in dev only. */
export function unregisterPack(id: string): boolean {
  return registry.delete(id);
}
