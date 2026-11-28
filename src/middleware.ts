/**
 * Global middleware: operator auth, API rate limiting, CSRF origin checks and
 * security headers.
 *
 * Rate-limit state is per instance unless Upstash/Vercel KV credentials are
 * set (see `lib/security/rate-limit.ts`); it is an abuse brake, not auth.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireOperator, type OperatorRequest } from "./lib/auth/requireOperator";
import { clientKey, consumeShared, limitForRequest } from "./lib/security/rate-limit";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const HSTS = "max-age=63072000; includeSubDomains; preload";
const BASIC_REALM = 'Basic realm="SEO Studio", charset="UTF-8"';

/** Marketing assets and documents stay reachable when site auth is enabled. */
const PUBLIC_PATHS = [
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/templates",
  "/icon.svg",
  "/icon.png",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/seo-studio-logo.png",
  "/system-architecture.svg",
  "/updates.xml",
  "/seo-studio.zip",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function siteAuthEnabled(): boolean {
  return ["1", "true", "yes"].includes((process.env.SITE_AUTH_ENABLED ?? "").trim().toLowerCase());
}

function siteBasicAuthValid(request: OperatorRequest): boolean {
  const user = process.env.SITE_BASIC_AUTH_USER?.trim();
  const password = process.env.SITE_BASIC_AUTH_PASSWORD?.trim();
  if (!user || !password) {
    return false;
  }
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return false;
  }
  try {
    const decoded = atob(header.slice(6).trim());
    const separator = decoded.indexOf(":");
    return decoded.slice(0, separator) === user && decoded.slice(separator + 1) === password;
  } catch {
    return false;
  }
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", HSTS);
  }
  return response;
}

function jsonError(
  status: number,
  code: string,
  message: string,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  const response = NextResponse.json({ error: { code, message } }, { status });
  for (const [name, value] of Object.entries(extraHeaders)) {
    response.headers.set(name, value);
  }
  return applySecurityHeaders(response);
}

/**
 * Rejects state-changing API requests whose `Origin` does not match the host.
 * This is CSRF protection only: requests without an Origin header are handled
 * by `requireOperator` instead.
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

/** Platform health checks stay public so Vercel can probe the gateway. */
function isPublicApiHealthCheck(pathname: string, method: string): boolean {
  return (
    (pathname === "/api/platform/health" || pathname === "/api/platform/v1/health") &&
    (method === "GET" || method === "HEAD")
  );
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    if (pathname.startsWith("/platform")) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    if (siteAuthEnabled() && !isPublicPath(pathname) && !siteBasicAuthValid(req)) {
      return jsonError(401, "site_auth_required", "Site authentication required.", {
        "WWW-Authenticate": BASIC_REALM,
      });
    }
    return applySecurityHeaders(response);
  }

  if (isCrossOriginWrite(req)) {
    return jsonError(403, "cross_origin_blocked", "Cross-origin request blocked.");
  }

  // Every API route except health checks requires an operator. This covers all
  // LLM, crawl and write handlers plus data-bearing GETs such as ai-training.
  if (!isPublicApiHealthCheck(pathname, req.method)) {
    const denied = await requireOperator(req);
    if (denied) {
      return applySecurityHeaders(denied);
    }
  }

  const rule = limitForRequest(pathname, req.method);
  const result = await consumeShared(
    `api:${clientKey(req.headers)}:${pathname.split("/").slice(0, 3).join("/")}`,
    rule,
  );
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
