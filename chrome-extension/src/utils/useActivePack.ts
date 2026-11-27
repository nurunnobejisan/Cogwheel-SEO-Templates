/**
 * `useActivePack` — React binding for the active vertical pack
 * (docs/TASKS.md Task 2.4).
 *
 * Loads the stored pack on mount, exposes its catalog scoring weights for
 * Task 3.2's dynamic composite, and persists a selection back into
 * `ExtensionOptions` (sync storage) so popup, sidepanel and the options page
 * all agree. Defaults to the catalog's default pack while loading, so the
 * first render never scores with invented numbers.
 */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PACK_ID } from "../../../src/packs/catalog";
import type { ScoringWeights } from "../../../src/schemas/validation";
import { getActivePackId, resolveScoringWeights } from "./activePack";
import { loadExtensionOptions, saveExtensionOptions } from "./extensionOptions";

export interface ActivePackState {
  /** Stored pack id (catalog-validated). */
  activePack: string;
  /** That pack's `{ onPage, schema, geoAi }` weights. */
  weights: ScoringWeights;
  /** Persist the selection and update local state. */
  setActivePack: (packId: string) => Promise<void>;
}

export function useActivePack(): ActivePackState {
  const [activePack, setActivePackState] = useState<string>(DEFAULT_PACK_ID);
  const [weights, setWeights] = useState<ScoringWeights>(() =>
    resolveScoringWeights(DEFAULT_PACK_ID)
  );

  useEffect(() => {
    let cancelled = false;
    getActivePackId()
      .then((id) => {
        if (cancelled) return;
        setActivePackState(id);
        setWeights(resolveScoringWeights(id));
      })
      .catch(() => {
        // Storage unavailable → keep the default pack weights.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setActivePack = useCallback(async (packId: string) => {
    const options = await loadExtensionOptions();
    await saveExtensionOptions({ ...options, activePack: packId });
    setActivePackState(packId);
    setWeights(resolveScoringWeights(packId));
  }, []);

  return { activePack, weights, setActivePack };
}
