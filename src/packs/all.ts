/**
 * Static view of every pack (docs/TASKS.md Task 2.3).
 *
 * Server- and test-side only: importing this module loads all six pack
 * modules (≈360 KB of keyword matrices) and runs their guarded
 * registrations. Product surfaces that run in the extension or the client
 * bundle must use `src/packs/catalog.ts` instead — it carries the same
 * identity/weights/signals without the matrices.
 *
 * Registration note: every pack index guards with `if (!getPack(id))`, so
 * importing this after a pack was already imported (HMR, vitest module
 * reuse) never trips the registry's duplicate-id check.
 */
import { hotelPack } from "./hotel";
import { ecommercePack } from "./ecommerce";
import { localBusinessPack } from "./local-business";
import { saasPack } from "./saas";
import { publisherPack } from "./publisher";
import { financePack } from "./finance";
import type { Pack } from "./types";

/** Every pack, in catalog order. */
export const ALL_PACKS: readonly Pack[] = [
  hotelPack,
  ecommercePack,
  localBusinessPack,
  saasPack,
  publisherPack,
  financePack,
];

/** Looks up one full pack by id; undefined for unknown ids. */
export function findPack(id: string): Pack | undefined {
  return ALL_PACKS.find((pack) => pack.id === id);
}
