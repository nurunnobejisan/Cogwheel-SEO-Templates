import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceAccountEmail, isGoogleConfigured, isServiceAccountFailure, listGscProperties } from "@/core/gsc/client.ts";
import { gscCacheKey, getCachedGscPanel } from "@/core/gsc/cache.ts";
import { buildLiveGscPanel, unavailableGscPanel } from "@/core/gsc/panel.ts";
import { GSC_RANGE_PRESETS } from "@/core/gsc/presets.ts";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const dayValues = GSC_RANGE_PRESETS.map((preset) => preset.days) as [number, ...number[]];

const requestSchema = z.object({
  siteUrl: z.string().trim().min(1, "Select a Search Console property"),
  days: z.union([z.literal(7), z.literal(28), z.literal(90), z.literal(180), z.literal(480)]).default(28),
  brandTerms: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  includeSitemaps: z.boolean().default(true),
});

const querySchema = z.object({
  siteUrl: z.string().trim().optional(),
  days: z.coerce.number().refine((value): value is (typeof dayValues)[number] => dayValues.includes(value)).optional(),
});

async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const principal = await principalFromRequest({ header: (name) => req.headers.get(name) });
  return isAuthenticatedPrincipal(principal)
    ? null
    : NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

function handleGoogleError(error: unknown): NextResponse {
  if (isServiceAccountFailure(error)) {
    const email = getServiceAccountEmail();
    const message = email
      ? `Add ${email} as a user (Restricted is enough) on this property in Search Console`
      : "Add the configured service account as a user (Restricted is enough) on this property in Search Console";
    return NextResponse.json(
      {
        success: false,
        error: message,
        code: "gsc_permission_denied",
        ...(email ? { copyText: email } : {}),
      },
      { status: 403 }
    );
  }
  const detail = error instanceof Error ? error.message : "Search Console request failed";
  return NextResponse.json({ success: false, error: detail, code: "gsc_request_failed" }, { status: 502 });
}

async function loadPanel(parsed: z.infer<typeof requestSchema>) {
  const key = gscCacheKey(
    parsed.siteUrl,
    "overview-cannibalization",
    `${parsed.days}:${(parsed.brandTerms ?? []).join(",").toLowerCase()}`
  );
  const result = await getCachedGscPanel(key, () =>
    buildLiveGscPanel({
      siteUrl: parsed.siteUrl,
      days: parsed.days,
      brandTerms: parsed.brandTerms,
      includeSitemaps: parsed.includeSitemaps,
    })
  );
  return { data: result.value, cache: result.cache, cachedAt: result.cachedAt };
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const parsed = querySchema.safeParse({
    siteUrl: req.nextUrl.searchParams.get("siteUrl") || undefined,
    days: req.nextUrl.searchParams.get("days") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid GSC query", details: parsed.error.issues.slice(0, 6) },
      { status: 400 }
    );
  }

  const configured = isGoogleConfigured();
  if (!parsed.data.siteUrl) {
    try {
      return NextResponse.json({
        success: true,
        configured,
        properties: configured ? await listGscProperties() : [],
        presets: GSC_RANGE_PRESETS,
      });
    } catch (error) {
      return handleGoogleError(error);
    }
  }

  const days = (parsed.data.days ?? 28) as z.infer<typeof requestSchema>["days"];
  if (!configured) {
    return NextResponse.json({
      success: true,
      configured: false,
      data: unavailableGscPanel(parsed.data.siteUrl, days),
      cache: "miss",
      cachedAt: null,
    });
  }

  try {
    return NextResponse.json({ success: true, configured: true, ...(await loadPanel({
      siteUrl: parsed.data.siteUrl,
      days,
      brandTerms: [],
      includeSitemaps: true,
    })) });
  } catch (error) {
    return handleGoogleError(error);
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid GSC request", details: parsed.error.issues.slice(0, 6) },
      { status: 400 }
    );
  }

  if (!isGoogleConfigured()) {
    return NextResponse.json({
      success: true,
      configured: false,
      data: unavailableGscPanel(parsed.data.siteUrl, parsed.data.days),
      cache: "miss",
      cachedAt: null,
    });
  }

  try {
    return NextResponse.json({ success: true, configured: true, ...(await loadPanel(parsed.data)) });
  } catch (error) {
    return handleGoogleError(error);
  }
}
