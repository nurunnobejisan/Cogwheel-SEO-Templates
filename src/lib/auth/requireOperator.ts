/**
 * Shared operator guard for API routes and middleware.
 *
 * Accepts (in order): an operator bearer token, valid site basic-auth
 * credentials, or a signed platform session cookie. With none of those
 * configured or present, access is denied — the legacy Origin header check is
 * CSRF protection only and is never treated as authentication.
 */

import { NextResponse } from "next/server";
import { isAuthenticatedPrincipal, principalFromRequest } from "../platform/auth";

export interface OperatorRequest {
  headers: Headers;
}

/** Constant-time-ish comparison without Node crypto (runs in Edge middleware). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bearer(request: OperatorRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7).trim() || null;
}

function basicCredentials(request: OperatorRequest): { user: string; password: string } | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return null;
  }
  try {
    const decoded = atob(header.slice(6).trim());
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return null;
    }
    return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

function configuredSecrets(): string[] {
  return [
    process.env.SEO_STUDIO_API_BEARER_TOKEN?.trim(),
    process.env.PLATFORM_OPERATOR_TOKEN?.trim(),
  ].filter((value): value is string => Boolean(value));
}

export async function isOperator(request: OperatorRequest): Promise<boolean> {
  const token = bearer(request);
  if (token && configuredSecrets().some((secret) => safeEqual(token, secret))) {
    return true;
  }

  const credentials = basicCredentials(request);
  const basicUser = process.env.SITE_BASIC_AUTH_USER?.trim();
  const basicPassword = process.env.SITE_BASIC_AUTH_PASSWORD?.trim();
  if (
    credentials &&
    basicUser &&
    basicPassword &&
    safeEqual(credentials.user, basicUser) &&
    safeEqual(credentials.password, basicPassword)
  ) {
    return true;
  }

  const principal = await principalFromRequest({ header: (name) => request.headers.get(name) });
  return isAuthenticatedPrincipal(principal);
}

/** Returns a 401 response when the caller is not an operator, otherwise null. */
export async function requireOperator(request: OperatorRequest): Promise<NextResponse | null> {
  if (await isOperator(request)) {
    return null;
  }
  return NextResponse.json(
    { error: { code: "unauthorized", message: "Operator authentication required." } },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="SEO Studio"' } },
  );
}
