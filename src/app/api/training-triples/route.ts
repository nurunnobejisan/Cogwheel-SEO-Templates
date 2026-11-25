import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "training-triples.jsonl");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
    const record = {
      url,
      audit: body.audit ?? null,
      expertFix: body.expertFix ?? null,
      capturedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.appendFile(FILE, JSON.stringify(record) + "\n", "utf8");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8").catch(() => "");
    const count = raw.split("\n").filter(Boolean).length;
    return NextResponse.json({ success: true, count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
