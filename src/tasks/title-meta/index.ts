import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { getCrawlPages, getCrawlRun, getLatestCrawlRunForProperty, listCrawlRuns } from "@/core/crawler";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { getPropertyProfile, upsertPropertyProfile } from "@/core/property";
import type { TaskRunFlag } from "@/core/runs";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Property } from "@/lib/types";
import { TaskExecutionError } from "@/tasks/keyword-research";
import { buildTitleMetaPrompt, parseTitleMetaDraft } from "./prompt";
import { renderTitleMetaDoc, type TitleMetaOutput } from "./render";
import {
  titleMetaInputSchema,
  type TitleMetaInput,
  type TitleMetaPageInput,
  type TitleMetaRowDraft,
} from "./schema";
import { validateTitleMetaRows } from "./validator";

interface TitleMetaDataBundle {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes">;
  pages: TitleMetaPageInput[];
  initialFlags: TaskRunFlag[];
}

export interface TitleMetaDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number }) => Promise<string>;
}

async function loadLatestKeywordMap(
  propertyId: string | null,
  keywordRunId?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!isSupabaseConfigured()) return map;

  const db = getSupabase();
  let runId = keywordRunId;
  if (!runId && propertyId) {
    const { data } = await db
      .from("runs")
      .select("id")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    runId = data?.id as string | undefined;
  }
  if (!runId) return map;

  const { data: rows } = await db
    .from("run_matrix")
    .select("path, primary_keyword")
    .eq("run_id", runId);

  for (const r of rows ?? []) {
    if (r.path && r.primary_keyword) {
      map.set((r.path as string).replace(/\/$/, "") || "/", r.primary_keyword as string);
    }
  }
  return map;
}

export async function runTitleMetaTask(
  rawInput: unknown,
  deps: TitleMetaDeps = {},
): Promise<PipelineResult<TitleMetaOutput>> {
  const parsed = titleMetaInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  let propertyId: string | null = input.propertyId ?? null;
  let property: Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes"> | null =
    input.property ?? null;

  if (propertyId && !property) {
    property = await getPropertyProfile(propertyId);
  } else if (!propertyId && input.property) {
    const res = await upsertPropertyProfile(input.property).catch(() => ({ propertyId: null }));
    propertyId = res.propertyId;
  }

  if (!property) {
    throw new TaskExecutionError("Property profile or valid propertyId is required.", 400);
  }

  // Locate latest Site Crawl run
  let crawlRun = input.crawlRunId ? await getCrawlRun(input.crawlRunId) : null;
  if (!crawlRun && propertyId) {
    crawlRun = await getLatestCrawlRunForProperty(propertyId);
  }
  if (!crawlRun && !input.crawlRunId) {
    const allRuns = await listCrawlRuns(propertyId ?? undefined);
    crawlRun = allRuns.find((r) => r.status === "completed") ?? null;
  }

  if (!crawlRun) {
    throw new TaskExecutionError(
      "No completed Site Crawl run found for this property. Please run Site Crawl first.",
      400,
    );
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<TitleMetaInput, TitleMetaDataBundle, TitleMetaRowDraft[], TitleMetaOutput>({
    taskId: "title-meta",
    propertyId,
    schema: titleMetaInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => {
      const rawPages = await getCrawlPages(crawlRun!.id);
      const indexable = rawPages.filter(
        (p) => p.statusCode === 200 && !(p.robotsMeta ?? "").toLowerCase().includes("noindex"),
      );
      const filtered =
        input.pageUrls && input.pageUrls.length > 0
          ? indexable.filter((p) => input.pageUrls!.includes(p.url))
          : indexable;

      if (filtered.length === 0) {
        throw new TaskExecutionError(
          "Site Crawl completed but contains no indexable 200 pages matching the selection.",
          400,
        );
      }

      const kwMap = await loadLatestKeywordMap(propertyId, input.keywordRunId);
      if (input.keywordMap) {
        for (const [k, v] of Object.entries(input.keywordMap)) {
          kwMap.set(k.replace(/\/$/, "") || "/", v);
        }
      }

      const initialFlags: TaskRunFlag[] = [];
      if (kwMap.size === 0) {
        initialFlags.push({
          code: "missing-keyword-run",
          message: "No approved Keyword Research run found; proceeding without mapped primary keywords.",
          severity: "warning",
        });
      }

      const pages: TitleMetaPageInput[] = filtered.map((p) => {
        let pathname = "/";
        try {
          pathname = new URL(p.url).pathname.replace(/\/$/, "") || "/";
        } catch {
          pathname = "/";
        }
        const h1 = p.h1H6.find((h) => h.level === 1)?.text ?? "";
        const kw = kwMap.get(p.url) ?? kwMap.get(pathname) ?? "";
        return {
          page: pathname === "/" ? "Home" : pathname.replace(/^\//, ""),
          url: p.url,
          currentTitle: p.title ?? "",
          currentMeta: p.metaDescription ?? "",
          h1,
          wordCount: p.wordCount,
          canonical: p.canonical,
          robotsMeta: p.robotsMeta,
          primaryKeyword: kw,
        };
      });

      return { property: property!, pages, initialFlags };
    },
    draftWithClaude: async ({ data, feedback }) => {
      const { system, prompt } = buildTitleMetaPrompt({
        property: data.property,
        pages: data.pages,
        feedback,
      });
      const raw = await callClaude({ system, prompt, maxTokens: 3000 });
      return parseTitleMetaDraft(raw, data.pages);
    },
    validate: async ({ data, draft }) =>
      validateTitleMetaRows({
        rows: draft,
        brand: data.property.brand,
        initialFlags: data.initialFlags,
      }),
    renderTemplate: async ({ data, draft }) => {
      const output = await renderTitleMetaDoc({
        property: data.property,
        rows: draft,
      });
      return { outputUrl: output.docUrl, output };
    },
  });
}
