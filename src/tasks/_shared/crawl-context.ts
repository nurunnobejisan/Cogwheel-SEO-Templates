import { getCrawlRun, getLatestCrawlRunForProperty, listCrawlRuns, type CrawlRunRecord } from "@/core/crawler";
import { getPropertyProfile, upsertPropertyProfile } from "@/core/property";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Property } from "@/lib/types";
import { TaskExecutionError } from "@/tasks/keyword-research";

export type PropertySummary = Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes">;

export async function resolvePropertyAndCrawl(opts: {
  propertyId?: string;
  property?: PropertySummary;
  crawlRunId?: string;
}): Promise<{
  propertyId: string | null;
  property: PropertySummary;
  crawlRun: CrawlRunRecord;
}> {
  let propertyId: string | null = opts.propertyId ?? null;
  let property: PropertySummary | null = opts.property ?? null;

  if (propertyId && !property) {
    property = await getPropertyProfile(propertyId);
  } else if (!propertyId && opts.property) {
    const res = await upsertPropertyProfile({
      ...opts.property,
      allowedLocations: [],
      excludedLocations: [],
    }).catch(() => ({ propertyId: null }));
    propertyId = res.propertyId;
  }

  if (!property) {
    throw new TaskExecutionError("Property profile or valid propertyId is required.", 400);
  }

  let crawlRun = opts.crawlRunId ? await getCrawlRun(opts.crawlRunId) : null;
  if (!crawlRun && propertyId) {
    crawlRun = await getLatestCrawlRunForProperty(propertyId);
  }
  if (!crawlRun && !opts.crawlRunId) {
    const allRuns = await listCrawlRuns(propertyId ?? undefined);
    crawlRun = allRuns.find((r) => r.status === "completed") ?? null;
  }

  if (!crawlRun) {
    throw new TaskExecutionError(
      "No completed Site Crawl run found for this property. Please run Site Crawl first.",
      400,
    );
  }

  return { propertyId, property, crawlRun };
}

export async function loadKeywordMapForProperty(
  propertyId: string | null,
  keywordRunId?: string,
  inlineMap?: Record<string, string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  if (isSupabaseConfigured()) {
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
    if (runId) {
      const { data: rows } = await db
        .from("run_matrix")
        .select("path, primary_keyword")
        .eq("run_id", runId);

      for (const r of rows ?? []) {
        if (r.path && r.primary_keyword) {
          map.set((r.path as string).replace(/\/$/, "") || "/", r.primary_keyword as string);
        }
      }
    }
  }

  if (inlineMap) {
    for (const [k, v] of Object.entries(inlineMap)) {
      map.set(k.replace(/\/$/, "") || "/", v);
    }
  }

  return map;
}
