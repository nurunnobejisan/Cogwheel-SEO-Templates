import { NextResponse } from "next/server";
import { z } from "zod";
import { TEMPLATES } from "@/config/templates";
import { runDocumentQualityCheck } from "@/lib/doc-quality";
import { createKeywordReportDoc, isGoogleConfigured, type RationaleEntry } from "@/lib/google";
import { generateText } from "@/lib/llm";
import { keywordSchema, pageSchema, propertySchema, templateSchema } from "@/lib/schemas";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { MatrixRow, PoolEntry, Property, SitemapPage, TemplateId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const refSchema = z
  .object({
    id: z.string(),
    keyword: z.string(),
    volume: z.number(),
    kd: z.number().nullable(),
    bucketId: z.string().optional(),
  })
  .nullable();

const directPayloadSchema = z.object({
  property: propertySchema,
  pages: z.array(pageSchema),
  template: templateSchema,
  allocation: z.object({
    pool: z.array(
      keywordSchema.extend({
        role: z.enum(["primary", "secondary", "fill", "reserve"]),
        pageId: z.string().optional(),
      }),
    ),
  }),
  matrix: z.array(
    z.object({
      pageId: z.string(),
      path: z.string(),
      title: z.string(),
      primary: refSchema,
      secondary: refSchema,
      alternatives: z.array(refSchema.unwrap()).default([]),
      exceptionCandidate: refSchema.default(null),
      flags: z.array(z.string()).default([]),
      status: z.enum(["pending", "approved", "edited"]),
    }),
  ),
});

const requestSchema = z.union([z.object({ runId: z.string().uuid() }), directPayloadSchema]);

interface ResolvedRun {
  runId?: string;
  property: Property;
  pages: SitemapPage[];
  template: TemplateId;
  matrix: MatrixRow[];
  pool: PoolEntry[];
}

async function loadRunFromSupabase(runId: string): Promise<ResolvedRun> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Pass the approved matrix directly or set SUPABASE_URL.");
  }
  const db = getSupabase();
  const { data: run, error: runErr } = await db
    .from("runs")
    .select("id, template, property_id")
    .eq("id", runId)
    .single();
  if (runErr || !run) throw new Error(runErr?.message ?? `Run ${runId} not found`);

  const [{ data: prop, error: propErr }, { data: mxRows, error: mxErr }, { data: kwRows, error: kwErr }] =
    await Promise.all([
      db.from("properties").select("*").eq("id", run.property_id).single(),
      db.from("run_matrix").select("*").eq("run_id", runId),
      db.from("run_keywords").select("*").eq("run_id", runId),
    ]);

  if (propErr || !prop) throw new Error(propErr?.message ?? "Property not found");
  if (mxErr) throw new Error(mxErr.message);
  if (kwErr) throw new Error(kwErr.message);

  const pages = (prop.pages ?? []) as SitemapPage[];
  const matrix: MatrixRow[] = (mxRows ?? []).map((r) => ({
    pageId: r.page_id,
    path: r.path,
    title: r.title,
    primary: r.primary_keyword
      ? { id: `kw:${r.primary_keyword}`, keyword: r.primary_keyword, volume: r.primary_volume ?? 0, kd: r.primary_kd }
      : null,
    secondary: r.secondary_keyword
      ? { id: `kw:${r.secondary_keyword}`, keyword: r.secondary_keyword, volume: r.secondary_volume ?? 0, kd: r.secondary_kd }
      : null,
    alternatives: [],
    exceptionCandidate: null,
    flags: r.flags ?? [],
    status: r.status,
  }));

  const pool: PoolEntry[] = (kwRows ?? []).map((k) => ({
    id: `kw:${k.keyword}`,
    keyword: k.keyword,
    volume: k.volume,
    kd: k.kd,
    cpc: k.cpc,
    intent: k.intent,
    sourceGroup: k.source_group ?? "",
    sourceFiles: k.source_files ?? [],
    flags: k.flags ?? [],
    bucketId: k.bucket_id ?? undefined,
    bucketName: k.bucket_name ?? undefined,
    bucketSource: k.bucket_source ?? undefined,
    role: k.role,
    pageId: k.page_id ?? undefined,
  }));

  return {
    runId,
    property: {
      name: prop.name,
      url: prop.url ?? "",
      brand: prop.brand ?? "",
      city: prop.city,
      state: prop.state,
      notes: prop.notes ?? "",
      allowedLocations: prop.allowed_locations ?? [],
      excludedLocations: prop.excluded_locations ?? [],
    },
    pages,
    template: run.template as TemplateId,
    matrix,
    pool,
  };
}

function buildRationalePrompt(run: ResolvedRun): { system: string; prompt: string } {
  const tmpl = TEMPLATES[run.template];
  const rStyle = run.property.rationaleStyle ?? (run.template === "B" ? "reitz" : "catbird");
  const styleGuide: Record<"arrive" | "catbird" | "reitz", string> = {
    arrive: `Arrive style: Write 1-2 crisp, direct sentences per page for "${tmpl.rationaleHeading}", citing the primary keyword, SV, KD, and page alignment.`,
    catbird: `Catbird style: Write 2-3 sentences per page for "${tmpl.rationaleHeading}" citing primary keyword, SV, KD, and traffic potential, PLUS a final sentence starting with "Supporting it with related ..." when relevant.`,
    reitz: `Cogwheel / Reitz style: Write a qualitative, strategic 3-sentence paragraph per page for "${tmpl.rationaleHeading}" covering demand-generator fit, SV/KD opportunity, and primary + secondary keyword pairing.`,
  };

  const system = [
    "You are an expert hospitality SEO strategist writing keyword recommendation rationales for hotel properties.",
    styleGuide[rStyle],
    "STRICT GROUNDING RULE: Only cite metrics (Search Volume, KD, bucket, flags) explicitly provided in the input JSON. Never invent numbers, rankings, or traffic estimates.",
    'Return ONLY valid JSON matching: {"rationales":[{"pageId":"...","title":"...","text":"..."}]}',
  ].join("\n");

  const payload = {
    property: {
      name: run.property.name,
      url: run.property.url || undefined,
      brand: run.property.brand || undefined,
      market: `${run.property.city}, ${run.property.state}`,
      notes: run.property.notes || undefined,
    },
    template: tmpl.name,
    pages: run.matrix.map((r) => ({
      pageId: r.pageId,
      title: r.title,
      path: r.path,
      primary: r.primary ? { keyword: r.primary.keyword, sv: r.primary.volume, kd: r.primary.kd } : null,
      secondary: r.secondary ? { keyword: r.secondary.keyword, sv: r.secondary.volume, kd: r.secondary.kd } : null,
      flags: r.flags,
    })),
  };

  return { system, prompt: JSON.stringify(payload, null, 2) };
}

function parseRationales(raw: string, matrix: MatrixRow[]): RationaleEntry[] {
  const withoutFences = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonText = withoutFences.match(/\{[\s\S]*\}/)?.[0] ?? withoutFences;
  const parsed = JSON.parse(jsonText) as { rationales?: RationaleEntry[] };
  if (!Array.isArray(parsed.rationales)) throw new Error("LLM response missing rationales array");
  const byId = new Map(parsed.rationales.map((r) => [r.pageId, r]));
  return matrix.map((m) => {
    const found = byId.get(m.pageId);
    return {
      pageId: m.pageId,
      title: m.title,
      text: found?.text?.trim() || `Selected "${m.primary?.keyword ?? "N/A"}" (SV ${m.primary?.volume ?? 0}, KD ${m.primary?.kd ?? "N/A"}) for ${m.title}.`,
    };
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  let run: ResolvedRun;
  try {
    if ("runId" in parsed.data) {
      run = await loadRunFromSupabase(parsed.data.runId);
    } else {
      run = {
        property: parsed.data.property,
        pages: parsed.data.pages,
        template: parsed.data.template,
        matrix: parsed.data.matrix as MatrixRow[],
        pool: parsed.data.allocation.pool as PoolEntry[],
      };
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }

  if (run.matrix.length === 0 || run.matrix.some((r) => r.status !== "approved")) {
    return NextResponse.json(
      { error: "All active matrix rows must be approved before generating the Keyword Report." },
      { status: 400 },
    );
  }

  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64)." },
      { status: 503 },
    );
  }

  const preCheck = runDocumentQualityCheck({
    property: run.property,
    pages: run.pages,
    matrix: run.matrix,
    pool: run.pool,
  });
  if (preCheck.overall === "failed") {
    return NextResponse.json(
      { error: "Document quality check failed before generation.", qualityReport: preCheck },
      { status: 400 },
    );
  }

  let rationales: RationaleEntry[];
  let usedAi = false;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { system, prompt } = buildRationalePrompt(run);
      const raw = await generateText({ system, prompt, maxTokens: 3000 });
      rationales = parseRationales(raw, run.matrix);
      usedAi = true;
    } catch (e) {
      return NextResponse.json({ error: `Rationale generation failed: ${(e as Error).message}` }, { status: 502 });
    }
  } else {
    rationales = run.matrix.map((m) => ({
      pageId: m.pageId,
      title: m.title,
      text: m.primary
        ? `Target "${m.primary.keyword}" (${m.primary.volume.toLocaleString()} monthly searches, KD ${m.primary.kd ?? "N/A"}) on ${m.title} (${m.path})${m.secondary ? `, paired with secondary keyword "${m.secondary.keyword}" (${m.secondary.volume.toLocaleString()} SV)` : ""}.`
        : `No primary keyword assigned for ${m.title} (${m.path}).`,
    }));
  }

  try {
    const doc = await createKeywordReportDoc({
      property: run.property,
      pages: run.pages,
      template: run.template,
      matrix: run.matrix,
      pool: run.pool,
      rationales,
    });

    const qualityReport = runDocumentQualityCheck({
      property: run.property,
      pages: run.pages,
      matrix: run.matrix,
      pool: run.pool,
      unresolvedPlaceholders: doc.unresolvedPlaceholders,
    });

    if (run.runId && isSupabaseConfigured()) {
      await getSupabase().from("runs").update({ status: "report_generated" }).eq("id", run.runId);
    }

    return NextResponse.json({
      docId: doc.docId,
      docUrl: doc.docUrl,
      usedTemplateCopy: doc.usedTemplateCopy,
      preservedTemplateDesign: doc.preservedTemplateDesign ?? false,
      usedAi,
      template: run.template,
      rationales,
      qualityReport,
    });
  } catch (e) {
    return NextResponse.json({ error: `Google Docs generation failed: ${(e as Error).message}` }, { status: 502 });
  }
}
