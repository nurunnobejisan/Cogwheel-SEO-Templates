import {
  createCrawlRun,
  fetchAndParseSitemaps,
  fetchPageWithRedirects,
  fetchRobotsTxt,
  getCrawlPages,
  getCrawlRun,
  isUrlAllowedByRobots,
  matchesIncludeExclude,
  normalizeCrawlUrl,
  parseHtmlPage,
  RateLimiter,
  updateCrawlRunProgress,
  upsertCrawlPages,
  UrlValidationError,
  validateTargetUrl,
  type CrawlPageRecord,
  type CrawlRunRecord,
  type QueueItem,
} from "@/core/crawler";
import type { PipelineResult } from "@/core/pipeline";
import { upsertPropertyProfile } from "@/core/property";
import { createTaskRun, updateTaskRun } from "@/core/runs";
import { TaskExecutionError } from "@/tasks/keyword-research";
import { renderSiteCrawlOutput, type SiteCrawlOutput } from "./render";
import { siteCrawlInputSchema, startSiteCrawlSchema, stepSiteCrawlSchema, type StartSiteCrawlInput } from "./schema";
import { computeSiteSummary, evaluatePageIssues, summaryToTaskFlags } from "./validator";

const BATCH_TIME_BUDGET_MS = 20_000;

export interface CrawlBatchDeps {
  rateLimiter?: RateLimiter;
  fetchPage?: typeof fetchPageWithRedirects;
}

async function processCrawlBatch(
  run: CrawlRunRecord,
  batchSize: number,
  runAllBatches: boolean,
  deps: CrawlBatchDeps = {},
): Promise<CrawlRunRecord> {
  if (run.status === "completed" || run.status === "failed") {
    return run;
  }

  const limiter = deps.rateLimiter ?? new RateLimiter(2);
  const fetchPage = deps.fetchPage ?? fetchPageWithRedirects;

  const frontier: QueueItem[] = [...run.queueState.frontier];
  const visited = new Set<string>(run.queueState.visited);
  const sitemapSet = new Set<string>(run.queueState.sitemapUrls);
  const batchStarted = Date.now();
  const newPages: CrawlPageRecord[] = [];
  let pagesCrawled = run.pagesCrawled;
  let processedInBatch = 0;

  while (frontier.length > 0 && pagesCrawled < run.maxPages) {
    if (!runAllBatches && (processedInBatch >= batchSize || Date.now() - batchStarted >= BATCH_TIME_BUDGET_MS)) {
      break;
    }

    const item = frontier.shift()!;
    if (visited.has(item.url)) continue;
    if (!isUrlAllowedByRobots(item.url, run.queueState.robots)) continue;
    if (!matchesIncludeExclude(item.url, run.includePatterns, run.excludePatterns)) continue;

    visited.add(item.url);
    const fetched = await fetchPage(item.url, limiter);
    const parsed = fetched.html
      ? parseHtmlPage(fetched.html, fetched.finalUrl)
      : {
          canonical: null,
          robotsMeta: null,
          title: null,
          metaDescription: null,
          h1H6: [],
          wordCount: 0,
          contentHash: "",
          images: [],
          internalLinks: [],
          externalLinks: [],
          hreflang: [],
          jsonLd: [],
          openGraph: {},
          needsJsRendering: false,
          plainText: "",
        };

    const basePage: Omit<CrawlPageRecord, "issues"> = {
      crawlRunId: run.id,
      url: item.url,
      finalUrl: fetched.finalUrl,
      statusCode: fetched.statusCode,
      redirectChain: fetched.redirectChain,
      canonical: parsed.canonical,
      robotsMeta: parsed.robotsMeta,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      h1H6: parsed.h1H6,
      wordCount: parsed.wordCount,
      contentHash: parsed.contentHash,
      images: parsed.images,
      internalLinks: parsed.internalLinks,
      externalLinks: parsed.externalLinks,
      hreflang: parsed.hreflang,
      jsonLd: parsed.jsonLd,
      openGraph: parsed.openGraph,
      responseTimeMs: fetched.responseTimeMs,
      depth: item.depth,
      inSitemap: sitemapSet.has(item.url),
      needsJsRendering: parsed.needsJsRendering,
      crawledAt: new Date().toISOString(),
    };

    const pageRecord: CrawlPageRecord = {
      ...basePage,
      issues: evaluatePageIssues(basePage),
    };
    newPages.push(pageRecord);
    pagesCrawled += 1;
    processedInBatch += 1;

    if (item.depth < run.crawlDepth) {
      for (const link of parsed.internalLinks) {
        if (
          !visited.has(link) &&
          !frontier.some((f) => f.url === link) &&
          isUrlAllowedByRobots(link, run.queueState.robots) &&
          matchesIncludeExclude(link, run.includePatterns, run.excludePatterns)
        ) {
          frontier.push({ url: link, depth: item.depth + 1 });
        }
      }
    }
  }

  await upsertCrawlPages(run.id, newPages);

  const isDone = frontier.length === 0 || pagesCrawled >= run.maxPages;
  const pagesDiscovered = Math.max(run.pagesDiscovered, visited.size + frontier.length);

  let siteSummary = run.siteSummary;
  if (isDone) {
    const allPages = await getCrawlPages(run.id);
    siteSummary = computeSiteSummary({
      pages: allPages,
      sitemapUrls: run.queueState.sitemapUrls,
      sitemapStatuses: run.queueState.sitemapStatuses,
      robotsTxtPresent: Boolean(run.queueState.robots.raw),
      startUrl: run.startUrl,
    });
  }

  const updated = await updateCrawlRunProgress(run.id, {
    status: isDone ? "completed" : "running",
    pagesDiscovered,
    pagesCrawled,
    finishedAt: isDone ? new Date().toISOString() : null,
    queueState: {
      ...run.queueState,
      frontier,
      visited: [...visited],
    },
    siteSummary,
  });

  const finalRun = updated ?? run;

  if (finalRun.taskRunId) {
    const flags = isDone ? summaryToTaskFlags(finalRun.siteSummary) : [];
    await updateTaskRun(finalRun.taskRunId, {
      status: isDone ? (flags.some((f) => f.severity === "error") ? "Flagged" : "Done") : "Running",
      outputs: renderSiteCrawlOutput(finalRun, flags) as unknown as Record<string, unknown>,
      flags,
      outputUrl: null,
    });
  }

  return finalRun;
}

export async function startSiteCrawl(
  input: StartSiteCrawlInput,
  deps: CrawlBatchDeps = {},
): Promise<CrawlRunRecord> {
  let normalizedStartUrl: string;
  try {
    normalizedStartUrl = validateTargetUrl(input.url);
  } catch (e) {
    if (e instanceof UrlValidationError) {
      throw new TaskExecutionError(e.message, 400);
    }
    throw e;
  }

  const startNorm = normalizeCrawlUrl(normalizedStartUrl, normalizedStartUrl, true) ?? normalizedStartUrl;
  const origin = new URL(startNorm).origin;

  let propertyId: string | null = input.propertyId ?? null;
  if (!propertyId && input.property) {
    const res = await upsertPropertyProfile(input.property).catch(() => ({ propertyId: null }));
    propertyId = res.propertyId;
  }

  const robots = await fetchRobotsTxt(origin);
  const { sitemapUrls, sitemapStatuses } = await fetchAndParseSitemaps(startNorm, robots.sitemaps);

  const frontier: QueueItem[] = [];
  const seen = new Set<string>();

  const seed = (u: string, depth: number) => {
    if (seen.has(u)) return;
    if (!isUrlAllowedByRobots(u, robots)) return;
    if (!matchesIncludeExclude(u, input.includePatterns, input.excludePatterns)) return;
    seen.add(u);
    frontier.push({ url: u, depth });
  };

  // Discover pages from sitemap.xml first, then seed startUrl for internal link discovery
  for (const smUrl of sitemapUrls) {
    seed(smUrl, 1);
  }
  seed(startNorm, 0);

  const taskRun = await createTaskRun({
    propertyId,
    taskId: "site-crawl",
    inputs: input as unknown as Record<string, unknown>,
  });

  const crawlRun = await createCrawlRun({
    propertyId,
    taskRunId: taskRun.id,
    startUrl: startNorm,
    maxPages: input.maxPages,
    crawlDepth: input.crawlDepth,
    includePatterns: input.includePatterns,
    excludePatterns: input.excludePatterns,
    pagesDiscovered: frontier.length,
    queueState: {
      frontier,
      visited: [],
      sitemapUrls,
      sitemapStatuses,
      robots,
    },
  });

  return processCrawlBatch(crawlRun, input.batchSize, input.runAllBatches ?? false, deps);
}

export async function stepSiteCrawl(
  crawlRunId: string,
  batchSize = 10,
  runAllBatches = false,
  deps: CrawlBatchDeps = {},
): Promise<CrawlRunRecord> {
  const existing = await getCrawlRun(crawlRunId);
  if (!existing) {
    throw new TaskExecutionError(`Crawl run ${crawlRunId} not found`, 404);
  }
  return processCrawlBatch(existing, batchSize, runAllBatches, deps);
}

export async function runSiteCrawlTask(
  rawInput: unknown,
  deps: CrawlBatchDeps = {},
): Promise<PipelineResult<SiteCrawlOutput>> {
  const parsed = siteCrawlInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  let run: CrawlRunRecord;
  if ("crawlRunId" in parsed.data) {
    const stepInput = stepSiteCrawlSchema.parse(parsed.data);
    run = await stepSiteCrawl(stepInput.crawlRunId, stepInput.batchSize, stepInput.runAllBatches, deps);
  } else {
    const startInput = startSiteCrawlSchema.parse(parsed.data);
    run = await startSiteCrawl(startInput, deps);
  }

  const flags = run.status === "completed" ? summaryToTaskFlags(run.siteSummary) : [];
  const taskStatus =
    run.status === "completed" ? (flags.some((f) => f.severity === "error") ? "Flagged" : "Done") : "Running";

  return {
    runId: run.taskRunId ?? run.id,
    taskId: "site-crawl",
    status: taskStatus,
    outputUrl: null,
    flags,
    retries: 0,
    output: renderSiteCrawlOutput(run, flags),
  };
}

