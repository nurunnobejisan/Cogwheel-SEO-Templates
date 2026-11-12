import { resolveRules, type RulesOverride } from "@/config/rules";
import type {
  Allocation,
  KeywordFlag,
  KeywordRecord,
  KeywordRef,
  MatrixRow,
  PoolEntry,
  SitemapPage,
  TemplateId,
} from "@/lib/types";
import { FALLBACK_BUCKET_ID } from "./bucket";
import { compareByVolume } from "./sort";

export function toRef(k: KeywordRecord): KeywordRef {
  return { id: k.id, keyword: k.keyword, volume: k.volume, kd: k.kd, bucketId: k.bucketId };
}

/** 0 = KD < max (preferred), 1 = KD unknown, 2 = KD ≥ max (exception). */
export function kdTier(kd: number | null, kdMax: number): 0 | 1 | 2 {
  if (kd === null) return 1;
  return kd < kdMax ? 0 : 2;
}

export function kdFlags(kd: number | null, kdMax: number): KeywordFlag[] {
  const t = kdTier(kd, kdMax);
  return t === 1 ? ["kd-unknown"] : t === 2 ? ["kd-exception"] : [];
}

function rankCandidates(cands: KeywordRecord[], kdMax: number): KeywordRecord[] {
  return [...cands].sort((a, b) => kdTier(a.kd, kdMax) - kdTier(b.kd, kdMax) || compareByVolume(a, b));
}

/**
 * Page-to-keyword matcher. Pages are processed in sitemap order; each keyword can be the
 * primary (or secondary) of at most one page.
 */
export function matchPages(
  keywords: KeywordRecord[],
  pages: SitemapPage[],
  template: TemplateId,
  rulesOverride?: RulesOverride,
): MatrixRow[] {
  const rules = resolveRules(rulesOverride);
  const kdMax = rules.kdPreferredMax;
  const active = pages.filter((p) => p.active);
  const used = new Set<string>();

  const byBucket = new Map<string, KeywordRecord[]>();
  for (const k of keywords) {
    if (!k.bucketId) continue;
    const list = byBucket.get(k.bucketId) ?? [];
    list.push(k);
    byBucket.set(k.bucketId, list);
  }
  const candidatesFor = (page: SitemapPage) => {
    const seen = new Set<string>();
    const out: KeywordRecord[] = [];
    for (const b of page.buckets) {
      for (const k of byBucket.get(b) ?? []) {
        if (!seen.has(k.id)) {
          seen.add(k.id);
          out.push(k);
        }
      }
    }
    return rankCandidates(out, kdMax);
  };

  // Pass 1: primaries.
  const rows: MatrixRow[] = active.map((page) => {
    const ranked = candidatesFor(page).filter((k) => !used.has(k.id));
    const primary = ranked[0] ?? null;
    const flags: KeywordFlag[] = [];
    let exceptionCandidate: KeywordRef | null = null;

    if (!primary) {
      flags.push("no-candidates");
    } else {
      used.add(primary.id);
      flags.push(...kdFlags(primary.kd, kdMax));
      if (kdTier(primary.kd, kdMax) === 0) {
        const threshold = Math.max(
          rules.highVolumeException.minVolume,
          primary.volume * rules.highVolumeException.multiplier,
        );
        const exc = ranked.find((k) => kdTier(k.kd, kdMax) === 2 && k.volume >= threshold);
        if (exc) {
          exceptionCandidate = toRef(exc);
          flags.push("high-sv-exception-available");
        }
      }
    }
    return {
      pageId: page.id,
      path: page.path,
      title: page.title,
      primary: primary ? toRef(primary) : null,
      secondary: null,
      alternatives: [],
      exceptionCandidate,
      flags,
      status: "pending",
    };
  });

  // Pass 2: secondaries (Format B) — only non-exception KDs, never another page's primary.
  if (template === "B") {
    active.forEach((page, i) => {
      const sec = candidatesFor(page).find((k) => !used.has(k.id) && kdTier(k.kd, kdMax) !== 2);
      if (sec) {
        used.add(sec.id);
        rows[i].secondary = toRef(sec);
      }
    });
  }

  // Pass 3: alternatives (anything not already assigned to a page).
  active.forEach((page, i) => {
    rows[i].alternatives = candidatesFor(page)
      .filter((k) => !used.has(k.id))
      .slice(0, rules.alternativesPerPage)
      .map(toRef);
  });

  return rows;
}

/**
 * 78-keyword quota allocator:
 * primaries → secondaries (Format B) → fill by Volume DESC until quota. Rest = reserve.
 */
export function allocatePool(
  keywords: KeywordRecord[],
  matrix: MatrixRow[],
  rulesOverride?: RulesOverride,
): Allocation {
  const rules = resolveRules(rulesOverride);
  const byId = new Map(keywords.map((k) => [k.id, k]));
  const inPool = new Set<string>();
  const pool: PoolEntry[] = [];
  const bucketCount = new Map<string, number>();

  const push = (k: KeywordRecord, role: PoolEntry["role"], pageId?: string) => {
    inPool.add(k.id);
    pool.push({ ...k, role, pageId });
    const b = k.bucketId ?? FALLBACK_BUCKET_ID;
    bucketCount.set(b, (bucketCount.get(b) ?? 0) + 1);
  };

  for (const row of matrix) {
    const k = row.primary && byId.get(row.primary.id);
    if (k && !inPool.has(k.id)) push(k, "primary", row.pageId);
  }
  for (const row of matrix) {
    const k = row.secondary && byId.get(row.secondary.id);
    if (k && !inPool.has(k.id)) push(k, "secondary", row.pageId);
  }

  const remaining = keywords.filter((k) => !inPool.has(k.id)).sort(compareByVolume);
  const reserve: PoolEntry[] = [];
  for (const k of remaining) {
    const bucket = k.bucketId ?? FALLBACK_BUCKET_ID;
    const eligible =
      (rules.includeUnassignedInPool || bucket !== FALLBACK_BUCKET_ID) &&
      (rules.maxPerBucket === null || (bucketCount.get(bucket) ?? 0) < rules.maxPerBucket);
    if (pool.length < rules.quotaTotal && eligible) push(k, "fill");
    else reserve.push({ ...k, role: "reserve" });
  }

  return { pool, reserve, quota: rules.quotaTotal, filled: pool.length };
}

export function runSelection(
  keywords: KeywordRecord[],
  pages: SitemapPage[],
  template: TemplateId,
  rulesOverride?: RulesOverride,
): { matrix: MatrixRow[]; allocation: Allocation } {
  const matrix = matchPages(keywords, pages, template, rulesOverride);
  const allocation = allocatePool(keywords, matrix, rulesOverride);
  return { matrix, allocation };
}

