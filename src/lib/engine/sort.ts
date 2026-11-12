import type { KeywordRecord } from "@/lib/types";

/** Canonical deterministic ordering: Volume DESC → KD ASC (null last) → keyword ASC. */
export function compareByVolume(
  a: Pick<KeywordRecord, "volume" | "kd" | "keyword">,
  b: Pick<KeywordRecord, "volume" | "kd" | "keyword">,
): number {
  if (b.volume !== a.volume) return b.volume - a.volume;
  const ak = a.kd ?? Number.POSITIVE_INFINITY;
  const bk = b.kd ?? Number.POSITIVE_INFINITY;
  if (ak !== bk) return ak - bk;
  return a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0;
}

