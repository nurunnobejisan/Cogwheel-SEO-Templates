import { NextResponse } from "next/server";
import { z } from "zod";
import { BUCKETS } from "@/lib/engine/bucket";
import { ingestParsedFiles } from "@/lib/engine/ingest";
import type { ParsedFile, ParsedRow } from "@/lib/engine/parse";
import { propertySchema, rulesOverrideSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  property: propertySchema,
  bucketIds: z.array(z.string()).optional(),
  database: z.string().default("us"),
  limitPerBucket: z.number().int().min(5).max(50).default(20),
  rules: rulesOverrideSchema,
});

function parseSemrushTsv(text: string, groupName: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const phIdx = headers.findIndex((h) => h.includes("keyword") || h === "ph");
  const nqIdx = headers.findIndex((h) => h.includes("search volume") || h === "nq");
  const kdIdx = headers.findIndex((h) => h.includes("difficulty") || h === "kd");
  const cpIdx = headers.findIndex((h) => h.includes("cpc") || h === "cp");
  if (phIdx === -1 || nqIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(";");
    return {
      keyword: cols[phIdx] ?? "",
      volume: cols[nqIdx] ?? "0",
      kd: kdIdx !== -1 ? cols[kdIdx] : null,
      cpc: cpIdx !== -1 ? cols[cpIdx] : null,
      intent: null,
      group: groupName,
    };
  });
}

/** Direct Semrush Analytics API pull (optional — requires SEMRUSH_API_KEY). */
export async function POST(req: Request) {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SEMRUSH_API_KEY is not configured. Upload Semrush CSV/XLSX exports or set SEMRUSH_API_KEY." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { property, bucketIds, database, limitPerBucket, rules } = parsed.data;
  const selectedBuckets = bucketIds?.length
    ? BUCKETS.filter((b) => bucketIds.includes(b.id))
    : BUCKETS.slice(0, 12);

  const parsedFiles: ParsedFile[] = [];
  for (const b of selectedBuckets) {
    const seed = `${b.terms[0] ?? b.name} ${property.city}`.trim();
    const url = new URL("https://api.semrush.com/");
    url.searchParams.set("type", "phrase_related");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("phrase", seed);
    url.searchParams.set("database", database);
    url.searchParams.set("export_columns", "Ph,Nq,Kd,Cp");
    url.searchParams.set("display_limit", String(limitPerBucket));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) continue;
    const text = await res.text();
    if (text.startsWith("ERROR")) continue;

    const rows = parseSemrushTsv(text, b.name);
    if (rows.length > 0) {
      parsedFiles.push({
        fileName: `semrush-api-${b.id}.csv`,
        rows,
        sourceGroup: b.name,
        usedGroupColumn: true,
      });
    }
  }

  if (parsedFiles.length === 0) {
    return NextResponse.json({ error: "Semrush API returned no keyword rows." }, { status: 502 });
  }

  return NextResponse.json(ingestParsedFiles(parsedFiles, property, rules));
}

