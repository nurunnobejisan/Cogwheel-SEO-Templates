/**
 * Global middleware: API operator authentication, CSRF origin checks, rate
 * limiting, and security headers.
 *
 * Operator-protected `/api/*` routes (via `requireOperator` in `lib/security/operator.ts`):
 *   1. All non-GET/HEAD/OPTIONS `/api/*` requests:
 *      `/api/ai-training`, `/api/audit-report`, `/api/brain`, `/api/bucket`,
 *      `/api/client-email`, `/api/content-similarity`, `/api/crawl-property`,
 *      `/api/daily-session`, `/api/daily-session/run`, `/api/drive-sync`,
 *      `/api/full-audit`, `/api/generate-hc`, `/api/generate-kr`,
 *      `/api/geo/check`, `/api/heading-audit`, `/api/image-audit`, `/api/ingest`,
 *      `/api/outcomes`, `/api/platform/*`, `/api/platform/session`,
 *      `/api/property-autofill`, `/api/runs`, `/api/select-kw`,
 *      `/api/semrush-pull`, `/api/seo-visibility-report`, `/api/sitemap-audit`,
 *      `/api/tasks/[taskId]/run`, `/api/tasks/site-crawl/run`,
 *      `/api/templates/inspect`, `/api/training-triples`,
 *      `/api/training-triples/review`, `/api/visibility`,
 *      `/api/visibility/gaps`, `/api/visibility-suite`.
 *   2. Costly / crawl / LLM GET routes (`PROTECTED_GET_ROUTE_PREFIXES`):
 *      `/api/brain`, `/api/full-audit`, `/api/heading-audit`,
 *      `/api/image-audit`, `/api/geo/check`.
 *
 * Rate-limit state is per instance (see `lib/security/rate-limit.ts`); it is an
 * abuse brake, not a billing quota.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireOperator, requiresOperatorAuth } from "./lib/security/operator";
import { clientKey, consume, limitForRequest } from "./lib/security/rate-limit";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const HSTS = "max-age=63072000; includeSubDomains; preload";

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", HSTS);
  }
  return response;
}

function jsonError(status: number, code: string, message: string, extraHeaders: Record<string, string> = {}) {
  const response = NextResponse.json({ error: { code, message } }, { status });
  for (const [name, value] of Object.entries(extraHeaders)) {
    response.headers.set(name, value);
  }
  return applySecurityHeaders(response);
}

/**
 * Rejects state-changing API requests whose `Origin` does not match the host.
 * Browsers send `Origin` on cross-site POSTs, so this blocks casual CSRF
 * without affecting same-origin fetch calls (which may omit it).
 */
function isCrossOriginWrite(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return false;
  }
  const origin = req.headers.get("origin");
  if (!origin) {
    return false;
  }
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    if (pathname.startsWith("/platform")) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return applySecurityHeaders(response);
  }

  if (isCrossOriginWrite(req)) {
    return jsonError(403, "cross_origin_blocked", "Cross-origin request blocked.");
  }

  if (requiresOperatorAuth(pathname, req.method)) {
    const auth = await requireOperator(req);
    if (!auth.ok) {
      return jsonError(auth.status, auth.code, auth.message);
    }
  }

  const rule = limitForRequest(pathname, req.method);
  const result = consume(`api:${clientKey(req.headers)}:${pathname.split("/").slice(0, 3).join("/")}`, rule);
  if (!result.allowed) {
    return jsonError(
      429,
      "rate_limited",
      "Too many requests. Please retry shortly.",
      {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(rule.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(rule.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
