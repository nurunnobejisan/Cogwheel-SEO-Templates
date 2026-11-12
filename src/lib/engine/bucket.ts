import bucketConfig from "@/config/buckets.json";
import type { BucketSummary, KeywordRecord } from "@/lib/types";
import { findPhrase, tokenize } from "./normalize";

export interface BucketDef {
  id: string;
  name: string;
  priority: number;
  terms: string[];
}

interface CompiledBucket extends BucketDef {
  compiled: string[][];
}

export const FALLBACK_BUCKET_ID = "unassigned";
export const FALLBACK_BUCKET_NAME: string = bucketConfig.fallbackBucket;

export const BUCKETS: BucketDef[] = [...(bucketConfig.buckets as BucketDef[])].sort(
  (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
);

const COMPILED: CompiledBucket[] = BUCKETS.map((b) => ({
  ...b,
  compiled: b.terms.map(tokenize).filter((t) => t.length > 0),
}));

export const BUCKET_BY_ID = new Map(BUCKETS.map((b) => [b.id, b]));

/** First bucket (by priority) with a whole-word/phrase term match, or null. */
export function classifyText(text: string): BucketDef | null {
  const tokens = tokenize(text);
  if (!tokens.length) return null;
  for (const b of COMPILED) {
    if (b.compiled.some((phrase) => findPhrase(tokens, phrase) !== -1)) return b;
  }
  return null;
}

export function slugify(s: string): string {
  return tokenize(s).join("-");
}

export interface Classification {
  bucketId: string;
  bucketName: string;
  bucketSource: NonNullable<KeywordRecord["bucketSource"]>;
}

/**
 * Classification chain (first hit wins):
 * 1. keyword term match  2. source-group term match  3. source group as custom bucket  4. fallback
 */
export function classifyKeyword(keyword: string, sourceGroup: string): Classification {
  const byKeyword = classifyText(keyword);
  if (byKeyword) return { bucketId: byKeyword.id, bucketName: byKeyword.name, bucketSource: "keyword" };

  const byGroup = sourceGroup ? classifyText(sourceGroup) : null;
  if (byGroup) return { bucketId: byGroup.id, bucketName: byGroup.name, bucketSource: "group" };

  const slug = slugify(sourceGroup);
  if (slug) {
    const name = sourceGroup.trim().replace(/\b\w/g, (c) => c.toUpperCase());
    return { bucketId: `custom:${slug}`, bucketName: name, bucketSource: "custom" };
  }
  return { bucketId: FALLBACK_BUCKET_ID, bucketName: FALLBACK_BUCKET_NAME, bucketSource: "fallback" };
}

/** Bucket id used only for the low-SV "local venue demand generator" check (no custom buckets). */
export function knownBucketFor(keyword: string, sourceGroup: string): string | null {
  return classifyText(keyword)?.id ?? (sourceGroup ? classifyText(sourceGroup)?.id ?? null : null);
}

export function bucketKeywords(keywords: KeywordRecord[]): KeywordRecord[] {
  return keywords.map((k) => ({ ...k, ...classifyKeyword(k.keyword, k.sourceGroup) }));
}

export function summarizeBuckets(keywords: KeywordRecord[]): BucketSummary[] {
  const map = new Map<string, BucketSummary>();
  for (const k of keywords) {
    const id = k.bucketId ?? FALLBACK_BUCKET_ID;
    const s = map.get(id) ?? { bucketId: id, bucketName: k.bucketName ?? FALLBACK_BUCKET_NAME, count: 0, totalVolume: 0 };
    s.count++;
    s.totalVolume += k.volume;
    map.set(id, s);
  }
  const order = (id: string) => BUCKET_BY_ID.get(id)?.priority ?? (id === FALLBACK_BUCKET_ID ? 10_000 : 5_000);
  return [...map.values()].sort((a, b) => order(a.bucketId) - order(b.bucketId) || a.bucketName.localeCompare(b.bucketName));
}

