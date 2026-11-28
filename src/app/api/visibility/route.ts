import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateTargetUrl, UrlValidationError } from "@/core/crawler/url";
import { adapterStatus } from "@/core/visibility/adapters";
import { detectGaps } from "@/core/visibility/gap-detector";
import { runVisibilityTracker } from "@/core/visibility/tracker";
import { listVisibilityRuns, saveVisibilityRun } from "@/core/visibility/store";
import { buildGapPatchPlans } from "../../../../healing/gap-plans";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import type { ProviderId, VisibilityMode } from "@/core/visibility/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROVIDER_IDS = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "gemini_grounded",
  "groq_llama",
  "openrouter_free",
  "pollinations",
  "ai_overviews",
] as const satisfies readonly ProviderId[];

const requestSchema = z.object({
  targetUrl: z.string().trim().min(3).max(2048),
  brand: z.string().trim().max(160).optional(),
  mode: z.enum(["hotel", "universal"]).default("hotel"),
  city: z.string().trim().max(120).optional(),
  category: z.string().trim().max(160).optional(),
  audience: z.string().trim().max(160).optional(),
  features: z.array(z.string().trim().max(120)).max(20).optional(),
  competitorDomains: z.array(z.string().trim().max(200)).max(20).optional(),
  // Bounded so one request fits inside the Vercel 60s function window. The UI
  // calls this route once per provider and shows progress between batches.
  maxPrompts: z.number().int().min(1).max(4).default(4),
  providers: z.array(z.enum(PROVIDER_IDS)).min(1).max(PROVIDER_IDS.length).optional(),
});

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

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid visibility request", details: parsed.error.issues.slice(0, 8) },
      { status: 400 }
    );
  }

  let targetUrl: string;
  try {
    targetUrl = validateTargetUrl(parsed.data.targetUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof UrlValidationError ? error.message : "targetUrl must be a public http(s) URL" },
      { status: 400 }
    );
  }

  try {
    const run = await runVisibilityTracker({
      ...parsed.data,
      targetUrl,
      mode: parsed.data.mode as VisibilityMode,
      providers: parsed.data.providers as ProviderId[] | undefined,
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
