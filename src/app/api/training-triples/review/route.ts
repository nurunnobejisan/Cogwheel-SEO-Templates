import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { isTrainingEligible, type TrainingTriple, type TripleTier } from "@/core/training/dataset";
import { cogwheelDataFile } from "@/lib/platform/data-dir";

export const dynamic = "force-dynamic";

function tripleFile(): string {
  return cogwheelDataFile("training-triples.jsonl");
}
const TIERS: TripleTier[] = ["raw", "reviewed", "gold"];

async function readAll(): Promise<TrainingTriple[]> {
  try {
    const raw = await fs.readFile(tripleFile(), "utf8");
    return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as TrainingTriple);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const quality = searchParams.get("quality");
  const eligibleOnly = searchParams.get("eligible") === "true";
  try {
    const triples = await readAll();
    const filtered = triples.filter((triple) => {
      if (eligibleOnly && !isTrainingEligible(triple.quality)) return false;
      if (quality && triple.quality !== quality) return false;
      return true;
    });
    return NextResponse.json({
      success: true,
      total: filtered.length,
      counts: {
        raw: triples.filter((triple) => triple.quality === "raw").length,
        reviewed: triples.filter((triple) => triple.quality === "reviewed").length,
        gold: triples.filter((triple) => triple.quality === "gold").length,
      },
      triples: filtered,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const quality = body.quality as TripleTier;
    if (!id || !TIERS.includes(quality)) {
      return NextResponse.json({ error: "id and valid quality (raw|reviewed|gold) required" }, { status: 400 });
    }

    const triples = await readAll();
    const target = triples.find((triple) => triple.id === id);
    if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

    target.quality = quality;
    target.reviewedBy = principal.id;
    target.reviewedAt = new Date().toISOString();

    await fs.mkdir(path.dirname(tripleFile()), { recursive: true });
    await fs.writeFile(tripleFile(), `${triples.map((triple) => JSON.stringify(triple)).join("\n")}\n`, "utf8");
    return NextResponse.json({
      success: true,
      id,
      quality,
      reviewedBy: principal.id,
      trainingEligible: isTrainingEligible(quality),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
