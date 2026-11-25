/**
 * Patch Store (Phase 5)
 *
 * Keeps the synthesized `FixPatch` behind each approval request so an operator
 * approval can deploy the exact patch that was reviewed (and not a re-synthesis
 * that might differ).
 */

import type { FixPatch } from "../ai/types.ts";

export interface PatchStore {
  put(patch: FixPatch): FixPatch;
  get(patchId: string): FixPatch | null;
  has(patchId: string): boolean;
  size(): number;
  clear(): void;
}

export function createPatchStore(): PatchStore {
  const patches = new Map<string, FixPatch>();
  return {
    put(patch) {
      patches.set(patch.patchId, patch);
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