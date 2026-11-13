import { randomUUID } from "node:crypto";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CrawlPageRecord, CrawlRunRecord, CrawlRunStatus, CrawlQueueState, SiteCrawlSummary } from "./types";

const memoryCrawlRuns = new Map<string, CrawlRunRecord>();
const memoryCrawlPages = new Map<string, CrawlPageRecord[]>();

export async function createCrawlRun(opts: {
  propertyId: string | null;
  taskRunId: string | null;
  startUrl: string;
  maxPages: number;
  crawlDepth: number;
  includePatterns: string[];
  excludePatterns: string[];
  queueState: CrawlQueueState;
  pagesDiscovered: number;
}): Promise<CrawlRunRecord> {
  const now = new Date().toISOString();
  const emptySummary: SiteCrawlSummary = {
    sitemapUrls: opts.queueState.sitemapStatuses,
    robotsTxtPresent: Boolean(opts.queueState.robots.raw),
    brokenLinks: [],
    redirectChains: [],
    orphanPages: [],
    missingFromSitemap: [],
    jsRenderedPages: [],
    issueCounts: {},
  };

  if (!isSupabaseConfigured()) {
    const rec: CrawlRunRecord = {
      id: randomUUID(),
      propertyId: opts.propertyId,
      taskRunId: opts.taskRunId,
      startUrl: opts.startUrl,
      maxPages: opts.maxPages,
      crawlDepth: opts.crawlDepth,
      includePatterns: opts.includePatterns,
      excludePatterns: opts.excludePatterns,
      startedAt: now,
      finishedAt: null,
      pagesDiscovered: opts.pagesDiscovered,
      pagesCrawled: 0,
      status: "running",
      queueState: opts.queueState,
      siteSummary: emptySummary,
    };
    memoryCrawlRuns.set(rec.id, rec);
    memoryCrawlPages.set(rec.id, []);
    return rec;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("crawl_runs")
    .insert({
      property_id: opts.propertyId,
      task_run_id: opts.taskRunId,
      start_url: opts.startUrl,
      max_pages: opts.maxPages,
      crawl_depth: opts.crawlDepth,
      include_patterns: opts.includePatterns,
      exclude_patterns: opts.excludePatterns,
      started_at: now,
      pages_discovered: opts.pagesDiscovered,
      pages_crawled: 0,
      status: "running",
      queue_state: opts.queueState,
      site_summary: emptySummary,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create crawl_run");
  return mapRunRow(data);
}

export async function getCrawlRun(crawlRunId: string): Promise<CrawlRunRecord | null> {
  if (!isSupabaseConfigured()) {
    return memoryCrawlRuns.get(crawlRunId) ?? null;
  }
  const db = getSupabase();
  const { data, error } = await db.from("crawl_runs").select("*").eq("id", crawlRunId).single();
  if (error || !data) return null;
  return mapRunRow(data);
}

export async function getLatestCrawlRunForProperty(propertyId: string): Promise<CrawlRunRecord | null> {
  if (!isSupabaseConfigured()) {
    const runs = [...memoryCrawlRuns.values()]
      .filter((r) => r.propertyId === propertyId && r.status === "completed")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return runs[0] ?? null;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("crawl_runs")
    .select("*")
    .eq("property_id", propertyId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapRunRow(data);
}

export async function listCrawlRuns(propertyId?: string): Promise<CrawlRunRecord[]> {
  if (!isSupabaseConfigured()) {
    return [...memoryCrawlRuns.values()]
      .filter((r) => !propertyId || r.propertyId === propertyId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  const db = getSupabase();
  let query = db.from("crawl_runs").select("*").order("started_at", { ascending: false }).limit(25);
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapRunRow);
}

export async function updateCrawlRunProgress(
  crawlRunId: string,
  patch: {
    status?: CrawlRunStatus;
    pagesDiscovered?: number;
    pagesCrawled?: number;
    finishedAt?: string | null;
    queueState?: CrawlQueueState;
    siteSummary?: SiteCrawlSummary;
  },
): Promise<CrawlRunRecord | null> {
  if (!isSupabaseConfigured()) {
    const existing = memoryCrawlRuns.get(crawlRunId);
    if (!existing) return null;
    const updated: CrawlRunRecord = {
      ...existing,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.pagesDiscovered !== undefined ? { pagesDiscovered: patch.pagesDiscovered } : {}),
      ...(patch.pagesCrawled !== undefined ? { pagesCrawled: patch.pagesCrawled } : {}),
      ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
      ...(patch.queueState !== undefined ? { queueState: patch.queueState } : {}),
      ...(patch.siteSummary !== undefined ? { siteSummary: patch.siteSummary } : {}),
    };
    memoryCrawlRuns.set(crawlRunId, updated);
    return updated;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("crawl_runs")
    .update({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.pagesDiscovered !== undefined ? { pages_discovered: patch.pagesDiscovered } : {}),
      ...(patch.pagesCrawled !== undefined ? { pages_crawled: patch.pagesCrawled } : {}),
      ...(patch.finishedAt !== undefined ? { finished_at: patch.finishedAt } : {}),
      ...(patch.queueState !== undefined ? { queue_state: patch.queueState } : {}),
      ...(patch.siteSummary !== undefined ? { site_summary: patch.siteSummary } : {}),
    })
    .eq("id", crawlRunId)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRunRow(data);
}

export async function upsertCrawlPages(crawlRunId: string, pages: CrawlPageRecord[]): Promise<void> {
  if (pages.length === 0) return;

  if (!isSupabaseConfigured()) {
    const existing = memoryCrawlPages.get(crawlRunId) ?? [];
    const byUrl = new Map(existing.map((p) => [p.url, p]));
    for (const p of pages) byUrl.set(p.url, p);
    memoryCrawlPages.set(crawlRunId, [...byUrl.values()]);
    return;
  }

  const db = getSupabase();
  const { error } = await db.from("crawl_pages").upsert(
    pages.map((p) => ({
      crawl_run_id: crawlRunId,
      url: p.url,
      final_url: p.finalUrl,
      status_code: p.statusCode,
      redirect_chain: p.redirectChain,
      canonical: p.canonical,
      robots_meta: p.robotsMeta,
      title: p.title,
      meta_description: p.metaDescription,
      h1_h6: p.h1H6,
      word_count: p.wordCount,
      content_hash: p.contentHash,
      images: p.images,
      internal_links: p.internalLinks,
      external_links: p.externalLinks,
      hreflang: p.hreflang,
      json_ld: p.jsonLd,
      open_graph: p.openGraph,
      response_time_ms: p.responseTimeMs,
      depth: p.depth,
      in_sitemap: p.inSitemap,
      needs_js_rendering: p.needsJsRendering,
      issues: p.issues,
      crawled_at: p.crawledAt,
    })),
    { onConflict: "crawl_run_id,url" },
  );
  if (error) throw new Error(error.message);
}

export async function getCrawlPages(crawlRunId: string): Promise<CrawlPageRecord[]> {
  if (!isSupabaseConfigured()) {
    return memoryCrawlPages.get(crawlRunId) ?? [];
  }

  const db = getSupabase();
  const { data, error } = await db.from("crawl_pages").select("*").eq("crawl_run_id", crawlRunId).order("id", { ascending: true });
  if (error || !data) return [];
  return data.map(mapPageRow);
}

function mapRunRow(row: Record<string, unknown>): CrawlRunRecord {
  return {
    id: row.id as string,
    propertyId: (row.property_id as string | null) ?? null,
    taskRunId: (row.task_run_id as string | null) ?? null,
    startUrl: row.start_url as string,
    maxPages: row.max_pages as number,
    crawlDepth: row.crawl_depth as number,
    includePatterns: (row.include_patterns as string[]) ?? [],
    excludePatterns: (row.exclude_patterns as string[]) ?? [],
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    pagesDiscovered: row.pages_discovered as number,
    pagesCrawled: row.pages_crawled as number,
    status: row.status as CrawlRunStatus,
    queueState: row.queue_state as CrawlQueueState,
    siteSummary: row.site_summary as SiteCrawlSummary,
  };
}

function mapPageRow(row: Record<string, unknown>): CrawlPageRecord {
  return {
    crawlRunId: row.crawl_run_id as string,
    url: row.url as string,
    finalUrl: row.final_url as string,
    statusCode: row.status_code as number,
    redirectChain: (row.redirect_chain as CrawlPageRecord["redirectChain"]) ?? [],
    canonical: (row.canonical as string | null) ?? null,
    robotsMeta: (row.robots_meta as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    metaDescription: (row.meta_description as string | null) ?? null,
    h1H6: (row.h1_h6 as CrawlPageRecord["h1H6"]) ?? [],
    wordCount: (row.word_count as number) ?? 0,
    contentHash: (row.content_hash as string) ?? "",
    images: (row.images as CrawlPageRecord["images"]) ?? [],
    internalLinks: (row.internal_links as string[]) ?? [],
    externalLinks: (row.external_links as string[]) ?? [],
    hreflang: (row.hreflang as CrawlPageRecord["hreflang"]) ?? [],
    jsonLd: (row.json_ld as string[]) ?? [],
    openGraph: (row.open_graph as Record<string, string>) ?? {},
    responseTimeMs: (row.response_time_ms as number) ?? 0,
    depth: (row.depth as number) ?? 0,
    inSitemap: Boolean(row.in_sitemap),
    needsJsRendering: Boolean(row.needs_js_rendering),
    issues: (row.issues as CrawlPageRecord["issues"]) ?? [],
    crawledAt: row.crawled_at as string,
  };
}
