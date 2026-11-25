/**
 * Rate Limiting, Backoff & Serialization (Phase 5)
 *
 * Protects the CMS APIs from exceeding their quotas (e.g. Shopify's 40 points/s
 * GraphQL budget, WordPress REST throttling):
 *
 *   - `createTokenBucket` / `createRateLimiter` — burst + sustained rate control.
 *   - `withRetry` — exponential backoff with jitter for transient 429/5xx.
 *   - `createSerialQueue` — never run two writes against the same target at once.
 */

import type { BucketConfig, RateLimitDecision } from "./types.ts";

/* ----------------------------------------------------------- token bucket --- */

export interface TokenBucket {
  tryAcquire(cost?: number): RateLimitDecision;
  tokens(): number;
}

export function createTokenBucket(
  config: BucketConfig,
  now: () => number = Date.now
): TokenBucket {
  let tokens = config.capacity;
  let last = now();

  function refill(): void {
    const at = now();
    const elapsedSeconds = Math.max(0, at - last) / 1000;
    if (elapsedSeconds > 0) {
      tokens = Math.min(config.capacity, tokens + elapsedSeconds * config.refillPerSecond);
      last = at;
    }
  }

  return {
    tryAcquire(cost = 1) {
      refill();
      if (tokens >= cost) {
        tokens -= cost;
        return { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 };
      }
      const deficit = cost - tokens;
      const retryAfterMs = Math.ceil((deficit / config.refillPerSecond) * 1000);
      return { allowed: false, remaining: Math.floor(tokens), retryAfterMs };
    },
    tokens() {
      refill();
      return tokens;
    },
  };
}

/* --------------------------------------------------------------- limiter --- */

export interface RateLimiterOptions {
  defaultConfig?: BucketConfig;
  configs?: Record<string, BucketConfig>;
  now?: () => number;
}

export interface RateLimiter {
  tryAcquire(key: string, cost?: number): RateLimitDecision;
  tokens(key: string): number;
  reset(key?: string): void;
  keys(): string[];
}

const DEFAULT_BUCKET: BucketConfig = { capacity: 30, refillPerSecond: 1 };

/**
 * A per-key limiter. Keys are logical, e.g. `principal:u1`, `cms:shopify` or
 * `<principal>:<targetUrl>`; each gets its own independent bucket.
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const now = options.now ?? Date.now;
  const defaultConfig = options.defaultConfig ?? DEFAULT_BUCKET;
  const configs = options.configs ?? {};
  const buckets = new Map<string, TokenBucket>();

  function bucketFor(key: string): TokenBucket {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = createTokenBucket(configs[key] ?? defaultConfig, now);
      buckets.set(key, bucket);
    }
    return bucket;
  }

  return {
    tryAcquire(key, cost = 1) {
      return bucketFor(key).tryAcquire(cost);
    },
    tokens(key) {
      return bucketFor(key).tokens();
    },
    reset(key) {
      if (key === undefined) {
        buckets.clear();
      } else {
        buckets.delete(key);
      }
    },
    keys() {
      return [...buckets.keys()];
    },
  };
}

/* ----------------------------------------------------------------- retry --- */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** 0..1 multiplier applied to each delay; 0 disables jitter. */
  jitter?: number;
  /** Deterministic RNG for tests; defaults to Math.random. */
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with optional jitter. */
export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter = 0,
  random: () => number = Math.random
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const factor = 1 + jitter * random();
  return Math.min(maxDelayMs, Math.round(exponential * factor));
}

export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const jitter = options.jitter ?? 0;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const isRetryable = options.isRetryable ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryable(error)) {
        break;
      }
      const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs, jitter, random);
      options.onRetry?.(attempt, error, delay);
      await sleep(delay);
    }
  }
  throw lastError;
}

/* -------------------------------------------------------- serial queue ----- */

export interface SerialQueue {
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
  size(): number;
}

/** Serializes tasks per key so two writes never hit the same target at once. */
export function createSerialQueue(): SerialQueue {
  const tails = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      const next = previous.then(
        () => task(),
        () => task()
      );
      // Swallow rejections in the chain so one failure doesn't poison the key.
      tails.set(
        key,
        next.then(
          () => undefined,
          () => undefined
        )
      );
      return next;
    },
    size() {
      return tails.size;
    },
  };
}