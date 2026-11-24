import { NextRequest, NextResponse } from "next/server";
import { runFullWebsiteAudit } from "@/core/full-audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = (body.targetUrl || "").trim();

    if (!targetUrl) {
      return NextResponse.json(
        { error: "Target URL is required (e.g., https://example.com)" },
        { status: 400 }
      );
    }

    const report = await runFullWebsiteAudit({
      targetUrl,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : 25,
      enableSubdomains: Boolean(body.enableSubdomains),
      includeGsc: body.includeGsc !== false,
      includeGeo: body.includeGeo !== false,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to execute full website audit", details: errorMsg },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("targetUrl") || "https://example.com";

    const report = await runFullWebsiteAudit({
      targetUrl,
      maxPages: 10,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch audit sample", details: String(err) },
      { status: 500 }
    );
  }
}
