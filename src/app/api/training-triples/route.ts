import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { assertEgressAllowed, readTextCapped, safeFetch } from "@/lib/security/egress";
import {
  contentHash,
  deriveTripleProvenance,
  hasDuplicateContent,
  isTrainingEligible,
  stripPii,
  type TrainingTriple,
} from "@/core/training/dataset";
import { seoStudioDataFile } from "@/lib/platform/data-dir";

export const dynamic = "force-dynamic";

function tripleFile(): string {
  return seoStudioDataFile("training-triples.jsonl");
}

/** Temp-dir writes on serverless are ephemeral; surface that honestly. */
function persistenceNote(): string | null {
  if (process.env.SEO_STUDIO_DATA_DIR) return null;
  if (process.env.VERCEL) {
    return "Written to the serverless temp filesystem; set SEO_STUDIO_DATA_DIR (or back this with Supabase/KV) for durable training storage.";
  }
  return null;
}

async function readAll(): Promise<TrainingTriple[]> {
  try {
    const raw = await fs.readFile(tripleFile(), "utf8");
    return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as TrainingTriple);
  } catch {
    return [];
  }
}

/** Fetch robots.txt through the SSRF-safe egress path and evaluate the path. */
async function robotsAllowed(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const fetched = await safeFetch(
      robotsUrl,
      { method: "GET", headers: { "User-Agent": "SEO StudioSeoBot/3.0 (+https://seo-studio.ai/bot)" } },
      { timeoutMs: 5000, maxRedirects: 3 }
    ).catch(() => null);
    if (!fetched || !fetched.response.ok) return true;
    const text = await readTextCapped(fetched.response, 200_000).catch(() => "");
    const lines = text.split("\n").map((line) => line.trim().toLowerCase());
    let inStar = false;
    for (const line of lines) {
      if (line.startsWith("user-agent:")) inStar = line.includes("*");
      if (inStar && line.startsWith("disallow:") && line.includes("/")) {
        const rulePath = line.split(":")[1]?.trim() ?? "";
        if (rulePath === "/" || u.pathname.startsWith(rulePath.replace("*", ""))) return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
    if (!body.consent) return NextResponse.json({ error: "consent is required" }, { status: 400 });
    if (body.tosAccepted !== true) {
      return NextResponse.json({ error: "Site terms acceptance (tosAccepted) is required" }, { status: 400 });
    }
    // Provenance of the captured audit. Defaults to "measured" (live fetch);
    // callers may pass an explicit value from the allowed set.
    const ALLOWED_PROVENANCE = new Set(["measured", "estimated", "unavailable"]);
    const provenance = ALLOWED_PROVENANCE.has(body.provenance) ? (body.provenance as "measured" | "estimated" | "unavailable") : "measured";
    // Provenance (Task 5.1): pack + pageType on every exported record.
    const { pack, pageType } = deriveTripleProvenance(url, body);
    await assertEgressAllowed(url);

    const allowed = await robotsAllowed(url);
    if (!allowed) return NextResponse.json({ error: "robots.txt disallows capture" }, { status: 403 });

    const cleanAudit = stripPii(body.audit ?? null);
    const cleanFix = stripPii(body.expertFix ?? null);
    const hash = contentHash(cleanAudit, cleanFix);
    const all = await readAll();
    // Dedupe on the audit+fix content: the same page may be re-captured with a
    // different reviewed fix (iterative expert edits), but identical content is
    // still rejected.
    if (hasDuplicateContent(all, hash)) {
      return NextResponse.json({ error: "duplicate content" }, { status: 409 });
    }

    const record: TrainingTriple = {
      id: crypto.randomUUID(),
      url,
      audit: cleanAudit,
      expertFix: cleanFix,
      quality: "raw",
      capturedAt: new Date().toISOString(),
      contentHash: hash,
      consent: true,
      tenantId: principal.organizationId,
      provenance,
      pack,
      pageType,
      reviewedBy: undefined,
    };
    await fs.mkdir(path.dirname(tripleFile()), { recursive: true });
    await fs.appendFile(tripleFile(), `${JSON.stringify(record)}\n`, "utf8");
    return NextResponse.json({
      success: true,
      id: record.id,
      quality: record.quality,
      trainingEligible: false,
      persistenceNote: persistenceNote(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const all = await readAll();
    const counts: Record<string, number> = { raw: 0, reviewed: 0, gold: 0 };
    for (const triple of all) {
      const tier = triple.quality ?? "raw";
      counts[tier] = (counts[tier] ?? 0) + 1;
    }
    const { searchParams } = new URL(req.url);
    const eligibleOnly = searchParams.get("eligible") === "true";
    const triples = eligibleOnly
      ? all.filter((triple) => isTrainingEligible(triple.quality))
      : all;
    return NextResponse.json({
      success: true,
      total: all.length,
      counts,
      trainingEligible: all.filter((triple) => isTrainingEligible(triple.quality)).length,
      triples,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
