/**
 * Target-page clustering for the strategy matrix (docs/TASKS.md Task 4.3).
 *
 * Groups a pack's 78 keyword rows by `targetPageType` so the operator sees
 * one view per page instead of one view per funnel category: every cluster
 * gets exactly one **primary** keyword and the rest are variants, with
 * variants that would fight the primary for the same SERP flagged as
 * overlapping.
 *
 * Everything here is deterministic over the authored dataset — no metrics are
 * derived, estimated or invented:
 *  - primary selection orders by the pack's own illustrative volume tier
 *    (High → Medium → Low → Long-Tail) and breaks ties by row id;
 *  - a variant "overlaps" the primary when it shares the primary's
 *    `recommendedSchema` or `searchIntent`, i.e. it would ask one page to
 *    carry the same structured data or chase the same intent.
 */
import type { KeywordItem } from "../schemas/validation";

/** Illustrative tier → deterministic ordering rank (authored band, not data). */
const VOLUME_TIER_RANK: Record<KeywordItem["searchVolumeTier"], number> = {
  High: 0,
  Medium: 1,
  Low: 2,
  "Long-Tail / Conversational": 3,
};

function tierRank(kw: KeywordItem): number {
  return VOLUME_TIER_RANK[kw.searchVolumeTier];
}

/** One non-primary keyword inside a cluster. */
export interface ClusterVariant {
  keyword: KeywordItem;
  /**
   * True when the variant shares the primary's recommended schema or search
   * intent — publishing both on one page splits the signal instead of
   * stacking it. A heuristic flag over authored fields, not a measurement.
   */
  overlapsPrimary: boolean;
}

/** All keywords targeting one page type, with exactly one primary pick. */
export interface PageTypeCluster {
  /** The `targetPageType` every row in the cluster is meant to serve. */
  targetPageType: string;
  /** Deterministic cluster head (see module doc for the ordering rule). */
  primary: KeywordItem;
  /** Every other row in the cluster, overlap-flagged against the primary. */
  variants: ClusterVariant[];
}

/**
 * Cluster keywords by target page. Cluster order follows first appearance in
 * the dataset, so the same matrix always produces the same view.
 */
export function clusterByTargetPageType(
  keywords: readonly KeywordItem[]
): PageTypeCluster[] {
  const byPage = new Map<string, KeywordItem[]>();
  for (const kw of keywords) {
    const existing = byPage.get(kw.targetPageType);
    if (existing) existing.push(kw);
    else byPage.set(kw.targetPageType, [kw]);
  }

  const clusters: PageTypeCluster[] = [];
  for (const [targetPageType, rows] of byPage) {
    const sorted = [...rows].sort(
      (a, b) => tierRank(a) - tierRank(b) || a.id.localeCompare(b.id)
    );
    const primary = sorted[0];
    if (!primary) continue; // rows are non-empty by schema; guards strict TS
    clusters.push({
      targetPageType,
      primary,
      variants: sorted.slice(1).map((keyword) => ({
        keyword,
        overlapsPrimary:
          keyword.recommendedSchema === primary.recommendedSchema ||
          keyword.searchIntent === primary.searchIntent,
      })),
    });
  }
  return clusters;
}
