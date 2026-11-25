/**
 * Platform API Route (Phase 5.1)
 *
 * Mounts the framework-agnostic Phase 5 gateway at `/api/platform/v1/*`. Each
 * verb is forwarded to `gateway.handle()` after the acting principal is
 * resolved, so the gateway's RBAC, rate limiting, audit log, history and
 * rollback guarantees apply unchanged.
 *
 *   POST /api/platform/v1/deployments   → gateway POST /v1/deployments
 *   GET  /api/platform/v1/audit-log     → gateway GET  /v1/audit-log
 */

import { NextResponse, type NextRequest } from "next/server";
import type { HttpMethod, PlatformRequest } from "../../../../../platform/index.ts";
import { principalFromRequest } from "../../../../lib/platform/auth.ts";
import { getPlatformRuntime } from "../../../../lib/platform/runtime.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS: readonly HttpMethod[] = ["GET", "POST", "PATCH", "DELETE"];

interface RouteContext {
  params: { path?: string[] };
}

async function forward(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const method = (req.method ?? "GET").toUpperCase();
  if (!(METHODS as readonly string[]).includes(method)) {
    return NextResponse.json(
      { error: { code: "method_not_allowed", message: method } },
      { status: 405 }
    );
  }

  let body: unknown;
  if (method !== "GET" && method !== "DELETE") {
    const text = await req.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { error: { code: "bad_request", message: "invalid JSON body" } },
          { status: 400 }
        );
      }
    }
  }

  const subPath = (context.params.path ?? []).join("/");
  const platformRequest: PlatformRequest = {
    method: method as HttpMethod,
    path: `/${subPath}${req.nextUrl.search}`,
    body,
    principal: readPrincipal(req),
  };

  const { platform } = await getPlatformRuntime();
  const response = await platform.gateway.handle(platformRequest);

  return NextResponse.json(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

const readPrincipal = (req: NextRequest) =>
  principalFromRequest({ header: (name) => req.headers.get(name) });

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
