/**
 * Storage descriptors: one honest answer to "will this data still be here
 * after a deploy?".
 *
 * Every in-memory store in the app (property profiles, crawl caches, crawl
 * runs) is per-instance: it disappears on every restart or redeploy. UI and
 * API surfaces must label that as ephemeral rather than implying durability.
 */

export interface StorageDescriptor {
  /** True only when records survive a deploy/restart of this server. */
  persistent: boolean;
  /** Human-readable label for the UI. */
  label: string;
}

export const EPHEMERAL_STORAGE: StorageDescriptor = {
  persistent: false,
  label: "in-memory (ephemeral — this server instance only)",
};

export const DURABLE_STORAGE: StorageDescriptor = {
  persistent: true,
  label: "Supabase (durable)",
};

/** Pick the descriptor for a store backed by Supabase only when configured. */
export function storageDescriptor(isDurable: boolean): StorageDescriptor {
  return isDurable ? DURABLE_STORAGE : EPHEMERAL_STORAGE;
}
