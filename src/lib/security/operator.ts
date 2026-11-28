/**
 * Operator Bearer Token Authentication Guard (WP1)
 *
 * Uses Web Crypto (`crypto.subtle`) so the exact same constant-time verification
 * runs in both Next.js Edge Middleware (`src/middleware.ts`) and Node route
 * handlers (`src/app/api/*`).
 */

export const OPERATOR_TOKEN_ENV = "SEO_STUDIO_API_BEARER_TOKEN";

/**
 * Costly / crawl / LLM GET routes enforced in Edge Middleware in addition to
 * every non-GET/HEAD/OPTIONS `/api/*` request.
 *
 * Protected GET routes:
 * - `/api/brain`         -> invokes `runBrain` (website crawl + LLM synthesis)
 * - `/api/full-audit`    -> invokes `runFullWebsiteAudit` (crawl + GEO + checks)
 * - `/api/heading-audit` -> invokes `crawlWebsiteHeadings` (outbound crawl)
 * - `/api/image-audit`   -> invokes `crawlWebsiteImages` (outbound crawl)
 * - `/api/geo/check`     -> invokes `runGeoCheck` (outbound crawl + AI checks)
 */
export const PROTECTED_GET_ROUTE_PREFIXES: readonly string[] = [
  "/api/brain",
  "/api/full-audit",
  "/api/heading-audit",
  "/api/image-audit",
  "/api/geo/check",
];

export type OperatorAuthResult =
  | { ok: true; authenticated: boolean; mode: "token" | "dev_unconfigured" }
  | { ok: false; authenticated: false; status: 401; code: string; message: string };

async function timingSafeStringEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    globalThis.crypto.subtle.digest("SHA-256", enc.encode(a)),
    globalThis.crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = bytesA.length ^ bytesB.length;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return diff === 0;
}

function extractBearerToken(headerValue: string | null): string {
  if (!headerValue) return "";
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

/** Returns true when `pathname` + `method` requires operator bearer authorization in middleware. */
export function requiresOperatorAuth(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  const upper = method.toUpperCase();
  if (upper !== "GET" && upper !== "HEAD" && upper !== "OPTIONS") {
    return true;
  }
  if (upper === "GET") {
    return PROTECTED_GET_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return false;
}

/**
 * Returns true only when `SEO_STUDIO_API_BEARER_TOKEN` is configured AND the
 * request carries a matching Bearer token (constant-time comparison).
 */
export async function hasOperatorToken(req: { headers: Headers }): Promise<boolean> {
  const expected = process.env[OPERATOR_TOKEN_ENV]?.trim() ?? "";
  if (!expected) return false;
  const provided = extractBearerToken(req.headers.get("authorization"));
  if (!provided) return false;
  return timingSafeStringEqual(provided, expected);
}

/**
 * Enforces operator bearer authentication.
 *
 * - When `SEO_STUDIO_API_BEARER_TOKEN` is configured: constant-time compare
 *   against `Authorization: Bearer <token>`. Invalid/missing -> `401`.
 * - When unset in `NODE_ENV === "development"`: allows with a one-line warning.
 * - When unset in production (or test / any non-development env): fails closed with `401`.
 */
export async function requireOperator(req: { headers: Headers }): Promise<OperatorAuthResult> {
  const expected = process.env[OPERATOR_TOKEN_ENV]?.trim() ?? "";
  if (!expected) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[security] SEO_STUDIO_API_BEARER_TOKEN is unset; allowing request in development mode.");
      return { ok: true, authenticated: false, mode: "dev_unconfigured" };
    }
    return {
      ok: false,
      authenticated: false,
      status: 401,
      code: "operator_auth_unconfigured",
      message: "Unauthorized: Server operator bearer token is not configured.",
    };
  }

  const provided = extractBearerToken(req.headers.get("authorization"));
  if (!provided || !(await timingSafeStringEqual(provided, expected))) {
    return {
      ok: false,
      authenticated: false,
      status: 401,
      code: "unauthorized",
      message: "Unauthorized: Invalid or missing Bearer token.",
    };
  }

  return { ok: true, authenticated: true, mode: "token" };
}
