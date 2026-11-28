/**
 * Six-hour GSC panel cache.
 *
 * Supabase is used when configured; otherwise the cache is process-local.
 * Neither path stores credentials, and a cache failure never blocks a live
 * request — it simply degrades to an uncached read.
 */

import { createHash } from "node:crypto";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase.ts";

export const GSC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CacheBackend = "supabase" | "memory" | "miss";

interface MemoryEntry {
  value: unknown;
  storedAt: number;
}

const memory = new Map<string, MemoryEntry>();

export function gscCacheKey(siteUrl: string, action: string, range: string): string {
  return createHash("sha256")
    .update(`${siteUrl}|${action}|${range}`)
    .digest("hex")
    .slice(0, 32);
}

function fresh(entry: { storedAt?: number; updated_at?: string } | undefined): boolean {
  if (!entry) return false;
  const storedAt = entry.storedAt ?? (entry.updated_at ? Date.parse(entry.updated_at) : 0);
  return Number.isFinite(storedAt) && Date.now() - storedAt < GSC_CACHE_TTL_MS;
}

async function readSupabase<T>(key: string): Promise<{ value: T; storedAt: number } | null> {
  try {
    const { data, error } = await getSupabase()
      .from("gsc_cache")
      .select("payload, updated_at")
      .eq("key", key)
      .maybeSingle();
    if (error || !data?.payload || !fresh({ updated_at: data.updated_at as string })) return null;
    return { value: JSON.parse(String(data.payload)) as T, storedAt: Date.parse(String(data.updated_at)) };
  } catch {
    return null;
  }
}

async function writeSupabase(key: string, value: unknown): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await getSupabase().from("gsc_cache").upsert(
      { key, payload: JSON.stringify(value), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    return !error;
  } catch {
    return false;
  }
}

export interface CachedGscResult<T> {
  value: T;
  cache: CacheBackend;
  cachedAt: string | null;
}

export async function getCachedGscPanel<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs = GSC_CACHE_TTL_MS
): Promise<CachedGscResult<T>> {
  const remote = isSupabaseConfigured() ? await readSupabase<T>(key) : null;
  if (remote) return { value: remote.value, cache: "supabase", cachedAt: new Date(remote.storedAt).toISOString() };

  const local = memory.get(key);
  if (local && Date.now() - local.storedAt < ttlMs) {
    return { value: local.value as T, cache: "memory", cachedAt: new Date(local.storedAt).toISOString() };
  }

  const value = await load();
  const storedAt = Date.now();
  memory.set(key, { value, storedAt });
  const wroteRemote = await writeSupabase(key, value);
  return { value, cache: wroteRemote ? "supabase" : "memory", cachedAt: new Date(storedAt).toISOString() };
}
