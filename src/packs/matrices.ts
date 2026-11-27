/**
 * Every pack's keyword matrix, server-side (docs/TASKS.md Tasks 4.2 / 2.3).
 *
 * The `/strategy-matrix` route renders from `?pack=` and needs the JSON for
 * whichever pack was requested, so this module statically imports all six
 * matrices and validates each through `validateKeywordMatrix` at module
 * load — a malformed pack fails the server (and CI) loudly instead of
 * rendering half a dataset.
 *
 * Server/test only: the extension must never import this (≈360 KB of JSON);
 * its light view of the packs is `src/packs/catalog.ts`.
 */
import {
  validateKeywordMatrix,
  type KeywordStrategyMatrix,
} from "../schemas/validation";
import { DEFAULT_PACK_ID, getPackMeta } from "./catalog";
import hotelJson from "./hotel/keywords.json";
import ecommerceJson from "./ecommerce/keywords.json";
import localBusinessJson from "./local-business/keywords.json";
import saasJson from "./saas/keywords.json";
import publisherJson from "./publisher/keywords.json";
import financeJson from "./finance/keywords.json";

const MATRIX_JSON: Record<string, unknown> = {
  hotel: hotelJson,
  ecommerce: ecommerceJson,
  "local-business": localBusinessJson,
  saas: saasJson,
  publisher: publisherJson,
  finance: financeJson,
};

/** pack id → validated 78-row matrix, parsed once at module load. */
export const PACK_MATRICES: Readonly<Record<string, KeywordStrategyMatrix>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(MATRIX_JSON).map(([id, json]) => [
        id,
        validateKeywordMatrix(json),
      ])
    )
  );

/**
 * `?pack=` → a catalog id; anything unknown falls back to the default pack so
 * hand-edited URLs render a complete dataset instead of erroring. Lives here
 * rather than in the page module because Next validates page exports.
 */
export function resolveMatrixPackId(raw?: string): string {
  return raw && getPackMeta(raw) ? raw : DEFAULT_PACK_ID;
}

/**
 * Matrix for a pack id; unknown ids fall back to the default pack so a
 * hand-edited URL still renders a complete, valid dataset.
 */
export function getPackMatrix(packId: string): KeywordStrategyMatrix {
  return PACK_MATRICES[packId] ?? PACK_MATRICES[DEFAULT_PACK_ID];
}
