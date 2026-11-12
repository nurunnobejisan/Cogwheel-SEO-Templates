import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_RULES } from "@/config/rules";
import { keywordSchema, pageSchema, propertySchema, templateSchema } from "@/lib/schemas";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

const refSchema = z.object({ id: z.string(), keyword: z.string(), volume: z.number(), kd: z.number().nullable() }).nullable();

const bodySchema = z.object({
  property: propertySchema,
  pages: z.array(pageSchema),
  template: templateSchema,
  stats: z.record(z.unknown()).default({}),
  allocation: z.object({
    pool: z.array(keywordSchema.extend({ role: z.enum(["primary", "secondary", "fill", "reserve"]), pageId: z.string().optional() })),
  }),
  matrix: z.array(
    z.object({
      pageId: z.string(),
      path: z.string(),
      title: z.string(),
      primary: refSchema,
      secondary: refSchema,
      flags: z.array(z.string()),
      status: z.enum(["pending", "approved", "edited"]),
    }),
  ),
});

/** Persist a run (property upsert, 78-KW pool, approval matrix) to Supabase. */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const { property, pages, template, stats, allocation, matrix } = parsed.data;
  const db = getSupabase();

  const { data: prop, error: propErr } = await db
    .from("properties")
    .upsert(
      {
        name: property.name,
        url: property.url ?? "",
        brand: property.brand,
        city: property.city,
        state: property.state,
        notes: property.notes ?? "",
        allowed_locations: property.allowedLocations,
        excluded_locations: property.excludedLocations,
        pages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name,city,state" },
    )
    .select("id")
    .single();
  if (propErr || !prop) return NextResponse.json({ error: propErr?.message ?? "Property upsert failed" }, { status: 500 });

  const allApproved = matrix.length > 0 && matrix.every((r) => r.status === "approved");
  const { data: run, error: runErr } = await db
    .from("runs")
    .insert({
      property_id: prop.id,
      template,
      status: allApproved ? "approved" : "draft",
      stats,
      rules: DEFAULT_RULES,
      approved_at: allApproved ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (runErr || !run) return NextResponse.json({ error: runErr?.message ?? "Run insert failed" }, { status: 500 });

  const { error: kwErr } = await db.from("run_keywords").insert(
    allocation.pool.map((k) => ({
      run_id: run.id,
      keyword: k.keyword,
      volume: k.volume,
      kd: k.kd,
      cpc: k.cpc,
      intent: k.intent,
      bucket_id: k.bucketId,
      bucket_name: k.bucketName,
      bucket_source: k.bucketSource,
      source_group: k.sourceGroup,
      source_files: k.sourceFiles,
      role: k.role,
      page_id: k.pageId ?? null,
      flags: k.flags,
    })),
  );
  if (kwErr) return NextResponse.json({ error: kwErr.message }, { status: 500 });

  const now = new Date().toISOString();
  const { error: mxErr } = await db.from("run_matrix").insert(
    matrix.map((r) => ({
      run_id: run.id,
      page_id: r.pageId,
      path: r.path,
      title: r.title,
      primary_keyword: r.primary?.keyword ?? null,
      primary_volume: r.primary?.volume ?? null,
      primary_kd: r.primary?.kd ?? null,
      secondary_keyword: r.secondary?.keyword ?? null,
      secondary_volume: r.secondary?.volume ?? null,
      secondary_kd: r.secondary?.kd ?? null,
      flags: r.flags,
      status: r.status,
      approved_at: r.status === "approved" ? now : null,
    })),
  );
  if (mxErr) return NextResponse.json({ error: mxErr.message }, { status: 500 });

  return NextResponse.json({ runId: run.id, propertyId: prop.id, status: allApproved ? "approved" : "draft" });
}

