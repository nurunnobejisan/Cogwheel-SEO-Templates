/**
 * Operator session endpoints.
 *
 *   GET    /api/platform/session  → { authenticated, principal, devAuth, signInConfigured }
 *   POST   /api/platform/session  → exchange PLATFORM_OPERATOR_TOKEN for a signed cookie
 *   DELETE /api/platform/session  → clear the session cookie
 *
 * The operator token is a shared bootstrap secret for single-operator
 * deployments. For multi-user setups, replace this route with your SSO callback
 * and mint the same signed session (`createSessionToken`).
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  createSessionToken,
  clearSessionCookie,
  devAuthEnabled,
  readCookie,
  sessionCookie,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/platform/session";
import type { Role } from "../../../../../platform/index.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TOKEN_LENGTH = 32;

function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function publicPrincipal(principal: { id: string; role: Role; organizationId?: string }) {
  return {
    id: principal.id,
    role: principal.role,
    ...(principal.organizationId ? { organizationId: principal.organizationId } : {}),
  };
}

export async function GET(req: NextRequest) {
  const principal = await verifySessionToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  return NextResponse.json({
    authenticated: Boolean(principal),
    principal: principal ? publicPrincipal(principal) : null,
    devAuth: devAuthEnabled(),
    signInConfigured: Boolean(process.env.PLATFORM_OPERATOR_TOKEN),
  });
}

export async function POST(req: NextRequest) {
  const expected = process.env.PLATFORM_OPERATOR_TOKEN?.trim() ?? "";
  if (expected.length < MIN_TOKEN_LENGTH) {
    return NextResponse.json(
      {
        error:
          "Sign-in is not configured. Set PLATFORM_OPERATOR_TOKEN to a random value of at least 32 characters.",
        code: "sign_in_not_configured",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as { token?: unknown; role?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token || !tokensMatch(token, expected)) {
    return NextResponse.json(
      { error: "Invalid operator token.", code: "invalid_token" },
      { status: 401 },
    );
  }

  const requestedRole = body?.role;
  const role: Role =
    requestedRole === "viewer" || requestedRole === "specialist" || requestedRole === "admin"
      ? requestedRole
      : "admin";

  let sessionToken: string;
  try {
    sessionToken = await createSessionToken({ id: "operator", role });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, code: "session_not_configured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({
    authenticated: true,
    principal: { id: "operator", role },
  });
  response.headers.set("Set-Cookie", sessionCookie(sessionToken));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}