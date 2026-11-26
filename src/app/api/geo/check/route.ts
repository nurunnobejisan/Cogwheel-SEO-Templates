import { NextRequest, NextResponse } from "next/server";
import { runGeoCheck } from "@/core/geo/run";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { UrlValidationError } from "@/core/crawler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : "";
  if (!targetUrl) {
    return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
  }
  return respond(targetUrl, body.persist !== false);
}

export async function GET(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const targetUrl = (searchParams.get("url") || searchParams.get("targetUrl") || "").trim();
  if (!targetUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  return respond(targetUrl, searchParams.get("persist") !== "false");
}

async function respond(targetUrl: string, persist: boolean): Promise<NextResponse> {
  try {
    const report = await runGeoCheck(targetUrl, { persist });
    return NextResponse.json({
      success: true,
      // Provenance is embedded per check; this summary mirrors it for clients.
      provenance: report.provenance,
      report,
    });
  } catch (err) {
    const status = err instanceof UrlValidationError ? 400 : 502;
    return NextResponse.json(
      { error: "GEO check failed", details: err instanceof Error ? err.message : String(err) },
      { status }
    );
  }
}
