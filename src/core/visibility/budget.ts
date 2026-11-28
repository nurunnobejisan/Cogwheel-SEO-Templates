/**
 * Visibility call budget: daily caps plus a per-provider token bucket.
 *
 * A call is reserved before the provider request and charged only on success.
 * When either guard denies the call the adapter returns `unavailable` with the
 * reason; it never falls back to fabricated data.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

interface BucketState {
  tokens: number;
  lastRefillAt: number;
}

interface Usage {
  date: string;
  calls: number;
  estimatedCostUsd: number;
  buckets?: Record<string, BucketState>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function usageFile(): string {
  return path.join(process.env.SEO_STUDIO_DATA_DIR || path.join(os.tmpdir(), "seo-studio-visibility"), "usage.json");
}

const DEFAULT_CALL_CAP = 60;
const DEFAULT_COST_CAP_USD = 3;
const DEFAULT_RPM = 20;

function rpmFor(provider: string): number {
  const envName = `VISIBILITY_RPM_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const value = Number(process.env[envName] ?? process.env.VISIBILITY_RPM_DEFAULT ?? DEFAULT_RPM);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 600) : DEFAULT_RPM;
}

function refill(bucket: BucketState | undefined, rpm: number, now: number): BucketState {
  if (!bucket) return { tokens: rpm, lastRefillAt: now };
  const elapsedMinutes = Math.max(0, now - bucket.lastRefillAt) / 60_000;
  return {
    tokens: Math.min(rpm, bucket.tokens + elapsedMinutes * rpm),
    lastRefillAt: now,
  };
}

// Node routes run in one process. Serialising read-modify-write keeps the
// in-process token bucket honest when several prompts are queried in parallel.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.then(() => undefined, () => undefined);
  return next;
}

async function readUsage(): Promise<Usage> {
  try {
    const parsed = JSON.parse(await fs.readFile(usageFile(), "utf8")) as Usage;
    if (parsed.date !== today()) return { date: today(), calls: 0, estimatedCostUsd: 0, buckets: {} };
    return { ...parsed, buckets: parsed.buckets ?? {} };
  } catch {
    return { date: today(), calls: 0, estimatedCostUsd: 0, buckets: {} };
  }
}

async function writeUsage(usage: Usage): Promise<void> {
  await fs.mkdir(path.dirname(usageFile()), { recursive: true });
  await fs.writeFile(usageFile(), JSON.stringify(usage, null, 2), "utf8");
}

export interface VisibilityBudgetResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  tokensRemaining?: number;
}

export async function canUseVisibilityProvider(
  estimatedCostUsd: number,
  provider = "default"
): Promise<VisibilityBudgetResult> {
  return withLock(async () => {
    const callsCap = Number(process.env.VISIBILITY_DAILY_CALL_CAP ?? DEFAULT_CALL_CAP);
    const costCap = Number(process.env.VISIBILITY_DAILY_COST_CAP_USD ?? DEFAULT_COST_CAP_USD);
    const usage = await readUsage();
    if (usage.calls >= callsCap) {
      return { allowed: false, reason: `daily visibility call cap reached (${usage.calls}/${callsCap})` };
    }
    if (usage.estimatedCostUsd + estimatedCostUsd > costCap) {
      return {
        allowed: false,
        reason: `daily visibility cost cap reached ($${usage.estimatedCostUsd.toFixed(2)}/$${costCap})`,
      };
    }

    const rpm = rpmFor(provider);
    const now = Date.now();
    const bucket = refill(usage.buckets?.[provider], rpm, now);
    if (bucket.tokens < 1) {
      const retryAfterMs = Math.ceil(((1 - bucket.tokens) / rpm) * 60_000);
      usage.buckets = { ...usage.buckets, [provider]: bucket };
      await writeUsage(usage);
      return {
        allowed: false,
        reason: `${provider} rate limit reached (${rpm}/min); retry in ${Math.ceil(retryAfterMs / 1000)}s`,
        retryAfterMs,
      };
    }

    bucket.tokens -= 1;
    usage.buckets = { ...usage.buckets, [provider]: bucket };
    await writeUsage(usage);
    return { allowed: true, tokensRemaining: Number(bucket.tokens.toFixed(2)) };
  });
}

export async function recordVisibilityUsage(estimatedCostUsd: number, provider = "default"): Promise<void> {
  await withLock(async () => {
    const usage = await readUsage();
    usage.calls += 1;
    usage.estimatedCostUsd = Number((usage.estimatedCostUsd + estimatedCostUsd).toFixed(4));
    const rpm = rpmFor(provider);
    const bucket = refill(usage.buckets?.[provider], rpm, Date.now());
    usage.buckets = { ...usage.buckets, [provider]: bucket };
    await writeUsage(usage);
  });
}

/** Return a reserved token when a provider call failed before producing an answer. */
export async function refundVisibilityToken(provider = "default"): Promise<void> {
  await withLock(async () => {
    const usage = await readUsage();
    const rpm = rpmFor(provider);
    const bucket = refill(usage.buckets?.[provider], rpm, Date.now());
    bucket.tokens = Math.min(rpm, bucket.tokens + 1);
    usage.buckets = { ...usage.buckets, [provider]: bucket };
    await writeUsage(usage);
  });
}
