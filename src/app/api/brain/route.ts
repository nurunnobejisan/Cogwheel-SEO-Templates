import { NextRequest, NextResponse } from "next/server";
import { runBrain } from "@/core/brain";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = (body.targetUrl || "").trim();
    if (!targetUrl) {
      return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
    }
    const result = await runBrain({
      targetUrl,
      question: typeof body.question === "string" ? body.question : undefined,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "Brain run failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("targetUrl") || "https://example.com";
  try {
    const result = await runBrain({ targetUrl, maxPages: 5 });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "Brain run failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
