import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildGscPanelFromUpload, parseGscUpload } from "@/core/gsc/panel.ts";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

const fieldsSchema = z.object({
  siteUrl: z.string().trim().min(1),
  days: z.union([z.literal(7), z.literal(28), z.literal(90), z.literal(180), z.literal(480)]).default(28),
  brandTerms: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ success: false, error: "Invalid multipart upload" }, { status: 400 });

  const parsed = fieldsSchema.safeParse({
    siteUrl: form.get("siteUrl"),
    days: form.get("days") ?? undefined,
    brandTerms: form.get("brandTerms") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid upload request", details: parsed.error.issues.slice(0, 6) },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Choose a GSC CSV or ZIP export" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "Upload is too large (20 MB limit)" }, { status: 413 });
  }

  let brandTerms: string[] = [];
  if (parsed.data.brandTerms) {
    try {
      brandTerms = z.array(z.string()).parse(JSON.parse(parsed.data.brandTerms));
    } catch {
      return NextResponse.json({ success: false, error: "brandTerms must be a JSON array of strings" }, { status: 400 });
    }
  }

  try {
    const rows = await parseGscUpload(file.name, await file.arrayBuffer());
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "No GSC rows found. Expected columns such as Query, Page, Clicks, Impressions, CTR and Position." },
        { status: 422 }
      );
    }
    const data = buildGscPanelFromUpload({
      siteUrl: parsed.data.siteUrl,
      days: parsed.data.days,
      fileName: file.name,
      rows,
      brandTerms,
    });
    return NextResponse.json({ success: true, configured: true, data, cache: "none", cachedAt: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse the uploaded export";
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
