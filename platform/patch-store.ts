/**
 * Patch Store (Phase 5)
 *
 * Keeps the synthesized `FixPatch` behind each approval request so an operator
 * approval can deploy the exact patch that was reviewed (and not a re-synthesis
 * that might differ).
 */

import type { FixPatch } from "../ai/types.ts";

export interface PatchStoreHooks {
  onPut?: (patch: FixPatch) => void;
}

export interface PatchStore {
  put(patch: FixPatch): FixPatch;
  get(patchId: string): FixPatch | null;
  has(patchId: string): boolean;
  size(): number;
  clear(): void;
}

export function createPatchStore(
  initial: FixPatch[] = [],
  hooks: PatchStoreHooks = {}
): PatchStore {
  const patches = new Map<string, FixPatch>();
  for (const patch of initial) {
    patches.set(patch.patchId, patch);
  }

  return {
    put(patch) {
      patches.set(patch.patchId, patch);
      hooks.onPut?.(patch);
      return patch;
    },
    get(patchId) {
      return patches.get(patchId) ?? null;
    },
    has(patchId) {
      return patches.has(patchId);
    },
    size() {
      return patches.size;
    },
    clear() {
      patches.clear();
    },
  };
}