import { NextRequest, NextResponse } from "next/server";
import { validateTargetUrl } from "@/core/crawler/url";
import { adapterStatus } from "@/core/visibility/adapters";
import { detectGaps } from "@/core/visibility/gap-detector";
import { runVisibilityTracker } from "@/core/visibility/tracker";
import { listVisibilityRuns, saveVisibilityRun } from "@/core/visibility/store";
import { buildGapPatchPlans } from "../../../../healing/gap-plans";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import type { ProviderId, VisibilityMode } from "@/core/visibility/types";

export const dynamic = "force-dynamic";

const PROVIDER_IDS: ProviderId[] = ["chatgpt", "claude", "perplexity", "gemini", "ai_overviews"];

export async function GET(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("targetUrl") || undefined;
  const runs = await listVisibilityRuns({ targetUrl, limit: 5 });
  return NextResponse.json({
    success: true,
    providers: adapterStatus(),
    runs: runs.map((run) => ({
      id: run.id,
      targetUrl: run.targetUrl,
      brand: run.brand,
      finishedAt: run.finishedAt,
      summary: run.summary,
    })),
  });
}

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : "";
  if (!targetUrl) return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
  if (!validateTargetUrl(targetUrl)) {
    return NextResponse.json({ error: "targetUrl must be a public http(s) URL" }, { status: 400 });
  }

  const providers = Array.isArray(body.providers)
    ? (body.providers as string[]).filter((value): value is ProviderId => PROVIDER_IDS.includes(value as ProviderId))
    : undefined;
  const mode: VisibilityMode = body.mode === "universal" ? "universal" : "hotel";

  try {
    const run = await runVisibilityTracker({
      targetUrl,
      brand: typeof body.brand === "string" ? body.brand : undefined,
      mode,
      city: typeof body.city === "string" ? body.city : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      audience: typeof body.audience === "string" ? body.audience : undefined,
      features: Array.isArray(body.features) ? body.features.filter((f: unknown) => typeof f === "string") : undefined,
      competitorDomains: Array.isArray(body.competitorDomains)
        ? body.competitorDomains.filter((value: unknown) => typeof value === "string")
        : undefined,
      maxPrompts: typeof body.maxPrompts === "number" ? body.maxPrompts : undefined,
      providers,
    });
    await saveVisibilityRun(run);
    const gaps = detectGaps(run);
    const plans = buildGapPatchPlans(gaps);
    return NextResponse.json({
      success: true,
      run,
      gaps,
      // Reviewable only; nothing is applied without operator approval.
      patchPlans: plans,
      providers: adapterStatus(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Visibility run failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
