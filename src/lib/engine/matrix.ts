import { DEFAULT_RULES } from "@/config/rules";
import type { Allocation, KeywordFlag, MatrixRow, PoolEntry } from "@/lib/types";
import { FALLBACK_BUCKET_ID } from "./bucket";
import { kdFlags, toRef } from "./select";
import { compareByVolume } from "./sort";

/**
 * Pure state transitions for the editable Approval Matrix checkpoint.
 * Invariant: the pool stays at `quota` entries whenever a swap is possible.
 */
export interface MatrixState {
  matrix: MatrixRow[];
  allocation: Allocation;
}

const KD_FLAGS: KeywordFlag[] = ["kd-unknown", "kd-exception", "high-sv-exception-available", "no-candidates"];

function lowestFillIndex(pool: PoolEntry[]): number {
  let idx = -1;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].role !== "fill") continue;
    if (idx === -1 || compareByVolume(pool[i], pool[idx]) > 0) idx = i;
  }
  return idx;
}

/** Assign `keywordId` as the primary/secondary of `pageId`. */
export function assignKeyword(
  state: MatrixState,
  pageId: string,
  slot: "primary" | "secondary",
  keywordId: string | null,
  kdMax = DEFAULT_RULES.kdPreferredMax,
): MatrixState {
  let pool = [...state.allocation.pool];
  let reserve = [...state.allocation.reserve];
  const matrix = state.matrix.map((r) => ({ ...r, flags: [...r.flags] }));
  const row = matrix.find((r) => r.pageId === pageId);
  if (!row) throw new Error(`Unknown page ${pageId}`);

  if (keywordId) {
    const taken = matrix.find(
      (r) => (r.primary?.id === keywordId || r.secondary?.id === keywordId) && !(r.pageId === pageId && r[slot]?.id === keywordId),
    );
    if (taken) throw new Error(`"${keywordId.replace(/^kw:/, "")}" is already assigned to ${taken.title}`);
  }

  // Demote the previous keyword in this slot to a regular fill keyword (stays in pool).
  const prevId = row[slot]?.id;
  if (prevId) {
    pool = pool.map((p) => (p.id === prevId ? { ...p, role: "fill", pageId: undefined } : p));
  }

  if (keywordId) {
    let entry = pool.find((p) => p.id === keywordId);
    if (!entry) {
      const rIdx = reserve.findIndex((p) => p.id === keywordId);
      if (rIdx === -1) throw new Error(`Keyword not found: ${keywordId}`);
      entry = reserve[rIdx];
      reserve.splice(rIdx, 1);
      pool.push({ ...entry, role: slot, pageId });
      // Keep pool at quota by evicting the lowest-volume fill keyword.
      if (pool.length > state.allocation.quota) {
        const ev = lowestFillIndex(pool);
        if (ev !== -1) {
          const [evicted] = pool.splice(ev, 1);
          reserve.push({ ...evicted, role: "reserve", pageId: undefined });
          reserve = reserve.sort(compareByVolume);
        }
      }
    } else {
      pool = pool.map((p) => (p.id === keywordId ? { ...p, role: slot, pageId } : p));
    }
    const kw = pool.find((p) => p.id === keywordId)!;
    row[slot] = toRef(kw);
  } else {
    row[slot] = null;
  }

  if (slot === "primary") {
    row.flags = row.flags.filter((f) => !KD_FLAGS.includes(f));
    if (row.primary) row.flags.push(...kdFlags(row.primary.kd, kdMax));
    else row.flags.push("no-candidates");
    row.exceptionCandidate = null;
  }
  if (!row.flags.includes("manual-override")) row.flags.push("manual-override");
  row.status = "edited";

  return { matrix, allocation: { ...state.allocation, pool, reserve, filled: pool.length } };
}

/** Remove a fill keyword from the pool and back-fill with the best eligible reserve keyword. */
export function removeFromPool(state: MatrixState, keywordId: string): MatrixState {
  const entry = state.allocation.pool.find((p) => p.id === keywordId);
  if (!entry) return state;
  if (entry.role !== "fill") throw new Error("Primary/secondary keywords must be reassigned in the matrix first");
  const pool = state.allocation.pool.filter((p) => p.id !== keywordId);
  let reserve = [...state.allocation.reserve, { ...entry, role: "reserve" as const }].sort(compareByVolume);
  const promoteIdx = reserve.findIndex((p) => p.id !== keywordId && (p.bucketId ?? FALLBACK_BUCKET_ID) !== FALLBACK_BUCKET_ID);
  if (promoteIdx !== -1 && pool.length < state.allocation.quota) {
    const [promoted] = reserve.splice(promoteIdx, 1);
    pool.push({ ...promoted, role: "fill" });
  }
  reserve = reserve.sort(compareByVolume);
  return { ...state, allocation: { ...state.allocation, pool, reserve, filled: pool.length } };
}

/** Add a reserve keyword to the pool, evicting the lowest-volume fill keyword if at quota. */
export function addToPool(state: MatrixState, keywordId: string): MatrixState {
  const idx = state.allocation.reserve.findIndex((p) => p.id === keywordId);
  if (idx === -1) return state;
  let reserve = [...state.allocation.reserve];
  const [entry] = reserve.splice(idx, 1);
  const pool = [...state.allocation.pool];
  if (pool.length >= state.allocation.quota) {
    const ev = lowestFillIndex(pool);
    if (ev === -1) throw new Error("Pool is full of primary/secondary keywords");
    const [evicted] = pool.splice(ev, 1);
    reserve.push({ ...evicted, role: "reserve" });
  }
  pool.push({ ...entry, role: "fill" });
  reserve = reserve.sort(compareByVolume);
  return { ...state, allocation: { ...state.allocation, pool, reserve, filled: pool.length } };
}

export function setRowStatus(state: MatrixState, pageId: string | "all", approved: boolean): MatrixState {
  return {
    ...state,
    matrix: state.matrix.map((r) =>
      pageId === "all" || r.pageId === pageId
        ? { ...r, status: approved ? "approved" : r.flags.includes("manual-override") ? "edited" : "pending" }
        : r,
    ),
  };
}

/** Inline-edit a matrix slot's keyword text, volume, or KD (creates a custom entry if needed). */
export function inlineEditMatrixKeyword(
  state: MatrixState,
  pageId: string,
  slot: "primary" | "secondary",
  patch: { keyword: string; volume?: number; kd?: number | null },
  kdMax = DEFAULT_RULES.kdPreferredMax,
): MatrixState {
  const cleanKw = patch.keyword.trim().toLowerCase();
  if (!cleanKw) throw new Error("Keyword cannot be empty");

  const nextId = `kw:${cleanKw}`;
  const existingInAll =
    state.allocation.pool.find((p) => p.id === nextId) ?? state.allocation.reserve.find((p) => p.id === nextId);

  if (existingInAll) {
    return assignKeyword(state, pageId, slot, existingInAll.id, kdMax);
  }

  let pool = [...state.allocation.pool];
  const matrix = state.matrix.map((r) => ({ ...r, flags: [...r.flags] }));
  const row = matrix.find((r) => r.pageId === pageId);
  if (!row) throw new Error(`Unknown page ${pageId}`);

  const prev = row[slot];
  if (prev) {
    pool = pool.map((p) => (p.id === prev.id ? { ...p, role: "fill", pageId: undefined } : p));
  }

  const vol = patch.volume ?? prev?.volume ?? 0;
  const kd = patch.kd !== undefined ? patch.kd : (prev?.kd ?? null);
  const newEntry: PoolEntry = {
    id: nextId,
    keyword: cleanKw,
    volume: vol,
    kd,
    cpc: null,
    intent: null,
    sourceGroup: "manual",
    sourceFiles: [],
    flags: ["manual-override"],
    bucketId: prev?.bucketId,
    bucketName: prev?.bucketId,
    bucketSource: "custom",
    role: slot,
    pageId,
  };

  pool.push(newEntry);
  let reserve = [...state.allocation.reserve];
  if (pool.length > state.allocation.quota) {
    const ev = lowestFillIndex(pool);
    if (ev !== -1) {
      const [evicted] = pool.splice(ev, 1);
      reserve.push({ ...evicted, role: "reserve", pageId: undefined });
      reserve = reserve.sort(compareByVolume);
    }
  }

  row[slot] = toRef(newEntry);
  if (slot === "primary") {
    row.flags = row.flags.filter((f) => !KD_FLAGS.includes(f));
    row.flags.push(...kdFlags(kd, kdMax));
    row.exceptionCandidate = null;
  }
  if (!row.flags.includes("manual-override")) row.flags.push("manual-override");
  row.status = "edited";

  return { matrix, allocation: { ...state.allocation, pool, reserve, filled: pool.length } };
}

/** Inline-edit a keyword inside the 78-KW pool (syncs matrix references if assigned). */
export function updatePoolKeyword(
  state: MatrixState,
  keywordId: string,
  patch: { keyword?: string; volume?: number; kd?: number | null; bucketId?: string; bucketName?: string },
): MatrixState {
  const pool = state.allocation.pool.map((p) => {
    if (p.id !== keywordId) return p;
    return {
      ...p,
      keyword: patch.keyword !== undefined ? patch.keyword.trim().toLowerCase() : p.keyword,
      volume: patch.volume !== undefined ? patch.volume : p.volume,
      kd: patch.kd !== undefined ? patch.kd : p.kd,
      bucketId: patch.bucketId !== undefined ? patch.bucketId : p.bucketId,
      bucketName: patch.bucketName !== undefined ? patch.bucketName : p.bucketName,
      flags: p.flags.includes("manual-override") ? p.flags : [...p.flags, "manual-override" as const],
    };
  });

  const updated = pool.find((p) => p.id === keywordId);
  const matrix = state.matrix.map((r) => {
    if (!updated) return r;
    const next = { ...r };
    if (next.primary?.id === keywordId) next.primary = toRef(updated);
    if (next.secondary?.id === keywordId) next.secondary = toRef(updated);
    return next;
  });

  return { matrix, allocation: { ...state.allocation, pool } };
}

