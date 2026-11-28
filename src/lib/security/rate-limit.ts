/**
 * Lightweight fixed-window rate limiter for API routes.
 *
 * State lives in module memory, so limits are enforced per server instance
 * (Vercel may run several). That is sufficient as a cheap abuse brake for an
 * unauthenticated surface; a shared store (Redis/KV) is the upgrade path when a
 * hard global quota is required.
 */

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  /** Seconds until reset, for the `Retry-After` header. */
  retryAfter: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000;

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/** Consumes one token for `key`. */
export function consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  sweep(now);

  let window = buckets.get(key);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, window);
  }

  window.count += 1;
  const allowed = window.count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - window.count),
    resetAt: window.resetAt,
    retryAfter: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

/** Test helper — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client identifier. On Vercel `x-forwarded-for` is set by the
 * platform and cannot be spoofed for the *first* hop, so prefer it.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/** Per-route-class limits. Writes are stricter than reads. */
export const RATE_LIMITS = {
  /** Non-GET requests across `/api/*`. */
  apiWrite: { limit: 30, windowMs: 60_000 },
  /** GET requests across `/api/*`. */
  apiRead: { limit: 240, windowMs: 60_000 },
  /** Costly crawl/audit endpoints (each triggers outbound fetches). */
  crawl: { limit: 10, windowMs: 60_000 },
  /** Paid AI/provider endpoints — bounded per IP to cap anonymous spend. */
  aiGeneration: { limit: 20, windowMs: 3_600_000 },
} satisfies Record<string, RateLimitRule>;

const AI_ROUTES = [
  "/api/ai-training",
  "/api/generate-hc",
  "/api/generate-kr",
  "/api/ingest",
  "/api/select-kw",
  "/api/semrush-pull",
  "/api/visibility-suite",
  "/api/brain",
  "/api/visibility",
  "/api/tasks/",
];

const CRAWL_ROUTES = [
  "/api/crawl-property",
  "/api/full-audit",
  "/api/audit-report",
  "/api/property-autofill",
  "/api/sitemap-audit",
  "/api/seo-visibility-report",
  "/api/geo/check",
  "/api/tasks/site-crawl",
];

export function limitForRequest(pathname: string, method: string): RateLimitRule {
  const isRead = method === "GET" || method === "HEAD";
  if (!isRead && AI_ROUTES.some((route) => pathname.startsWith(route))) {
    return RATE_LIMITS.aiGeneration;
  }
  if (CRAWL_ROUTES.some((route) => pathname.startsWith(route))) {
    return RATE_LIMITS.crawl;
  }
  return isRead ? RATE_LIMITS.apiRead : RATE_LIMITS.apiWrite;
}

/**
 * Shared-store adapter. Upstash/Vercel KV uses the same REST protocol; without
 * credentials the in-memory limiter stays as the per-instance fallback.
 */
export interface RateLimitAdapter {
  consume(key: string, rule: RateLimitRule, now?: number): Promise<RateLimitResult>;
}

function upstashAdapter(url: string, token: string): RateLimitAdapter {
  const endpoint = `${url.replace(/\/$/, "")}/pipeline`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  return {
    async consume(key, rule, now = Date.now()) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify([
          ["INCR", key],
          ["PTTL", key],
        ]),
      });
      if (!response.ok) {
        throw new Error(`Rate-limit store returned ${response.status}`);
      }
      const payload = (await response.json()) as Array<{ result: number | string }>;
      const count = Number(payload[0]?.result);
      const ttlMs = Number(payload[1]?.result);
      if (!Number.isFinite(count) || count < 1) {
        throw new Error("Invalid rate-limit store response");
      }
      let resetAt = now + rule.windowMs;
      if (ttlMs > 0) {
        resetAt = now + ttlMs;
      } else {
        await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify([["PEXPIRE", key, Math.ceil(rule.windowMs / 1000)]]),
        });
      }
      return {
        allowed: count <= rule.limit,
        remaining: Math.max(0, rule.limit - count),
        resetAt,
        retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    },
  };
}

let cached: { id: string; adapter: RateLimitAdapter } | null = null;

export function rateLimitAdapter(): RateLimitAdapter {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return { consume: async (key, rule, now) => consume(key, rule, now) };
  }
  const id = `${url}:${token}`;
  if (cached?.id !== id) {
    cached = { id, adapter: upstashAdapter(url, token) };
  }
  return cached.adapter;
}

/** Middleware entry point: shared store when configured, memory otherwise. */
export async function consumeShared(key: string, rule: RateLimitRule, now = Date.now()): Promise<RateLimitResult> {
  try {
    return await rateLimitAdapter().consume(key, rule, now);
  } catch {
    return consume(key, rule, now);
  }
}