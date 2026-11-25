import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "training-triples.jsonl");

type Quality = "raw" | "reviewed" | "gold";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const quality = searchParams.get("quality") || "raw";
  try {
    const raw = await fs.readFile(FILE, "utf8").catch(() => "");
    const triples = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const filtered = triples.filter((t: { quality: string }) => t.quality === quality);
    return NextResponse.json({ success: true, triples: filtered });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const quality = body.quality as Quality;
    if (!id || !["raw", "reviewed", "gold"].includes(quality)) {
      return NextResponse.json({ error: "id and valid quality required" }, { status: 400 });
    }
    const raw = await fs.readFile(FILE, "utf8").catch(() => "");
    const triples = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    let found = false;
    for (const t of triples) {
      if (t.id === id) {
        t.quality = quality;
        found = true;
      }
    }
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    await fs.writeFile(FILE, triples.map((t) => JSON.stringify(t)).join("\n") + "\n", "utf8");
    return NextResponse.json({ success: true, id, quality });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
