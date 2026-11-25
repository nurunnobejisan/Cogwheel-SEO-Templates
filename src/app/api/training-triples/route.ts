import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "training-triples.jsonl");

type Quality = "raw" | "reviewed" | "gold";

interface Triple {
  id: string;
  url: string;
  audit: unknown;
  expertFix: unknown;
  quality: Quality;
  capturedAt: string;
}

function stripPii(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
      .replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{2,4}\)|\d{2,4})[-.\s]\d{3,4}[-.\s]\d{3,4}\b/g, "[REDACTED_PHONE]");
  }
  if (Array.isArray(value)) return value.map(stripPii);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripPii(v);
    return out;
  }
  return value;
}

async function readAll(): Promise<Triple[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Triple);
  } catch {
    return [];
  }
}

async function robotsAllowed(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return true;
    const text = await res.text();
    // Very small gate: disallow if "Disallow: /" for User-agent: *
    const lines = text.split("\n").map((l) => l.trim().toLowerCase());
    let inStar = false;
    for (const line of lines) {
      if (line.startsWith("user-agent:")) inStar = line.includes("*");
      if (inStar && line.startsWith("disallow:") && line.includes("/")) {
        const path = line.split(":")[1]?.trim() ?? "";
        if (path === "/" || u.pathname.startsWith(path.replace("*", ""))) return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
    if (!body.consent) return NextResponse.json({ error: "consent is required" }, { status: 400 });

    const allowed = await robotsAllowed(url);
    if (!allowed) return NextResponse.json({ error: "robots.txt disallows capture" }, { status: 403 });

    const all = await readAll();
    if (all.some((t) => t.url === url)) {
      return NextResponse.json({ error: "duplicate url" }, { status: 409 });
    }

    const record: Triple = {
      id: crypto.randomUUID(),
      url,
      audit: stripPii(body.audit ?? null),
      expertFix: stripPii(body.expertFix ?? null),
      quality: "raw",
      capturedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.appendFile(FILE, JSON.stringify(record) + "\n", "utf8");
    return NextResponse.json({ success: true, id: record.id, quality: record.quality });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const all = await readAll();
    const counts = { raw: 0, reviewed: 0, gold: 0 };
    for (const t of all) counts[t.quality] += 1;
    return NextResponse.json({ success: true, total: all.length, counts, triples: all });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
