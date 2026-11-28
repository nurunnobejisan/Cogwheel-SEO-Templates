/**
 * Rollout mode and deterministic canary bucketing for the v1 fine-tuned
 * SEO Studio adapter (`AI_ADAPTER_MODE`, `AI_ADAPTER_CANARY_PCT`).
 */

export type AdapterMode = "off" | "shadow" | "canary" | "on";

const VALID_ADAPTER_MODES: ReadonlySet<string> = new Set([
  "off",
  "shadow",
  "canary",
  "on",
]);

/**
 * Resolve `AI_ADAPTER_MODE` from env. Defaults conservatively to `"off"` when
 * unset or unrecognized so production traffic never reaches an unpromoted adapter.
 */
export function getAdapterMode(
  env: Record<string, string | undefined> = process.env,
): AdapterMode {
  const raw = (env.AI_ADAPTER_MODE ?? "").trim().toLowerCase();
  return VALID_ADAPTER_MODES.has(raw) ? (raw as AdapterMode) : "off";
}

/**
 * Parse `AI_ADAPTER_CANARY_PCT` as an integer in `[0, 100]`, defaulting to `0`.
 */
export function getAdapterCanaryPct(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = (env.AI_ADAPTER_CANARY_PCT ?? "").trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  if (parsed >= 100) return 100;
  return Math.floor(parsed);
}

/**
 * Deterministic `0..99` FNV-1a bucket for per-property / per-request canary splits.
 */
export function computeCanaryBucket(seed: string): number {
  const normalized = seed.trim() || "anonymous";
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

/**
 * Return true when a request with `seed` (`propertyId || requestId`) falls
 * inside the configured `canaryPct` slice (`bucket < canaryPct`).
 */
export function shouldRouteCanary(
  seed: string | undefined,
  canaryPct: number,
): boolean {
  if (!Number.isFinite(canaryPct) || canaryPct <= 0) return false;
  if (canaryPct >= 100) return true;
  return computeCanaryBucket(seed ?? "") < Math.floor(canaryPct);
}
