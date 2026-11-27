/**
 * Active-pack resolution for the extension (docs/TASKS.md Tasks 2.4 / 3.2).
 *
 * The selected pack lives in `ExtensionOptions.activePack`; its scoring
 * weights live in the pack catalog (`src/packs/catalog.ts`), which is the
 * single source for every `{ onPage, schema, geoAi }` triple. The extension
 * never hardcodes a composite — it always asks the catalog.
 *
 * Importable from any extension context (background service worker, popup,
 * sidepanel). No module-level mutable state: every call reads storage.
 */
import { DEFAULT_PACK_ID, getPackMeta } from "../../../src/packs/catalog";
import type { ScoringWeights } from "../../../src/schemas/validation";
import { loadExtensionOptions } from "./extensionOptions";

/**
 * Weights for `packId`; unknown ids fall back to the default pack so a
 * stale/corrupt stored value can never score with fabricated numbers.
 */
export function resolveScoringWeights(packId: string): ScoringWeights {
  const meta = getPackMeta(packId) ?? getPackMeta(DEFAULT_PACK_ID);
  if (!meta) {
    // catalog.ts always defines the default pack (asserted by tests); fail
    // loudly rather than silently inventing weights.
    throw new Error(`Pack catalog is missing its default pack "${DEFAULT_PACK_ID}"`);
  }
  return meta.scoringWeights;
}

/** Stored pack id, validated against the catalog (falls back to default). */
export async function getActivePackId(): Promise<string> {
  const options = await loadExtensionOptions();
  return getPackMeta(options.activePack) ? options.activePack : DEFAULT_PACK_ID;
}

/** Scoring weights of the stored active pack. */
export async function getActiveScoringWeights(): Promise<ScoringWeights> {
  return resolveScoringWeights(await getActivePackId());
}
