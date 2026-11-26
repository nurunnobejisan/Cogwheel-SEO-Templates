import { NextRequest, NextResponse } from "next/server";
import { validateTargetUrl } from "@/core/crawler/url";
import { detectGaps } from "@/core/visibility/gap-detector";
import { latestVisibilityRun } from "@/core/visibility/store";
import { buildGapPatchPlans } from "../../../../../healing/gap-plans";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

async function respond(targetUrl: string): Promise<NextResponse> {
  if (!validateTargetUrl(targetUrl)) {
    return NextResponse.json({ error: "targetUrl must be a public http(s) URL" }, { status: 400 });
  }
  const run = await latestVisibilityRun(targetUrl);
  if (!run) {
    return NextResponse.json(
      { error: "No visibility run recorded for this URL. Run a tracker first." },
      { status: 404 }
    );
  }
  const gaps = detectGaps(run);
  return NextResponse.json({
    success: true,
    runId: run.id,
    measuredAt: run.finishedAt,
    gaps,
    patchPlans: buildGapPatchPlans(gaps),
  });
}

export async function GET(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const targetUrl = (searchParams.get("targetUrl") || "").trim();
  if (!targetUrl) return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
  return respond(targetUrl);
}

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : "";
  if (!targetUrl) return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
  return respond(targetUrl);
}
