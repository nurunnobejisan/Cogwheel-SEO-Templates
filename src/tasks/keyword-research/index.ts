import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { isGoogleConfigured } from "@/core/google";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { upsertPropertyProfile } from "@/core/property";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { MatrixRow, PoolEntry, SitemapPage, TemplateId } from "@/lib/types";
import { buildDeterministicRationales, buildRationalePrompt, parseRationales } from "./prompt";
import { renderKeywordResearchDoc, type KeywordResearchOutput } from "./render";
import { keywordResearchInputSchema, type KeywordResearchInput, type ResolvedKeywordRun } from "./schema";
import { runPreGenerationChecks, validateKeywordResearchDraft, type KeywordResearchDraft } from "./validator";

export class TaskExecutionError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "TaskExecutionError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function loadRunFromSupabase(runId: string): Promise<ResolvedKeywordRun & { propertyId?: string }> {
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
    propertyId: run.property_id as string,
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

async function resolveKeywordRun(input: KeywordResearchInput): Promise<ResolvedKeywordRun & { propertyId?: string | null }> {
  if ("runId" in input) {
    try {
      return await loadRunFromSupabase(input.runId);
    } catch (e) {
      throw new TaskExecutionError((e as Error).message, 404);
    }
  }

  const { propertyId } = await upsertPropertyProfile(input.property, input.pages).catch(() => ({ propertyId: null }));
  return {
    propertyId,
    property: input.property,
    pages: input.pages,
    template: input.template,
    matrix: input.matrix as MatrixRow[],
    pool: input.allocation.pool as PoolEntry[],
  };
}

export async function runKeywordResearchTask(
  rawInput: unknown,
): Promise<PipelineResult<KeywordResearchOutput>> {
  const parsed = keywordResearchInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const resolved = await resolveKeywordRun(parsed.data);

  const preCheck = runPreGenerationChecks(resolved);
  if (!preCheck.ok) {
    throw new TaskExecutionError(
      preCheck.error ?? "Pre-generation check failed",
      preCheck.statusCode ?? 400,
      preCheck.qualityReport ? { qualityReport: preCheck.qualityReport } : undefined,
    );
  }

  if (!isGoogleConfigured()) {
    throw new TaskExecutionError(
      "Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64).",
      503,
    );
  }

  return runTaskPipeline<KeywordResearchInput, ResolvedKeywordRun, KeywordResearchDraft, KeywordResearchOutput>({
    taskId: "keyword-research",
    propertyId: resolved.propertyId ?? null,
    schema: keywordResearchInputSchema,
    rawInput: parsed.data,
    fetchData: async () => resolved,
    draftWithClaude: async ({ data, feedback }) => {
      if (isClaudeConfigured()) {
        try {
          const { system, prompt } = buildRationalePrompt(data, feedback);
          const raw = await generateClaudeText({ system, prompt, maxTokens: 3000 });
          return {
            rationales: parseRationales(raw, data.matrix),
            usedAi: true,
          };
        } catch (e) {
          throw new TaskExecutionError(`Rationale generation failed: ${(e as Error).message}`, 502);
        }
      }
      return {
        rationales: buildDeterministicRationales(data.matrix),
        usedAi: false,
      };
    },
    validate: async ({ data, draft }) => validateKeywordResearchDraft(data, draft),
    renderTemplate: async ({ data, draft }) => {
      try {
        const output = await renderKeywordResearchDoc(data, draft.rationales, draft.usedAi);
        return { outputUrl: output.docUrl, output };
      } catch (e) {
        throw new TaskExecutionError(`Google Docs generation failed: ${(e as Error).message}`, 502);
      }
    },
  });
}

