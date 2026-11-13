import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { getCrawlPages } from "@/core/crawler";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { resolvePropertyAndCrawl, type PropertySummary } from "@/tasks/_shared/crawl-context";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildDuplicateContentPrompt,
  detectDeterministicDuplicateClusters,
  parseDuplicateContentDraft,
} from "./prompt";
import { renderDuplicateContentOutput, type DuplicateContentOutput } from "./render";
import {
  duplicateContentAuditInputSchema,
  type DuplicateCluster,
  type DuplicateContentAuditInput,
  type DuplicateContentRowDraft,
  type DuplicateContentSummary,
} from "./schema";
import { validateDuplicateContentRows } from "./validator";

interface DuplicateContentDataBundle {
  property: PropertySummary;
  clusters: DuplicateCluster[];
  summary: DuplicateContentSummary;
  allowedUrls: Set<string>;
  initialFlags: TaskRunFlag[];
}

export interface DuplicateContentDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runDuplicateContentAuditTask(
  rawInput: unknown,
  deps: DuplicateContentDeps = {},
): Promise<PipelineResult<DuplicateContentOutput>> {
  const parsed = duplicateContentAuditInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const { propertyId, property, crawlRun } = await resolvePropertyAndCrawl({
    propertyId: input.propertyId,
    property: input.property,
    crawlRunId: input.crawlRunId,
  });

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    DuplicateContentAuditInput,
    DuplicateContentDataBundle,
    DuplicateContentRowDraft[],
    DuplicateContentOutput
  >({
    taskId: "duplicate-content-audit",
    propertyId,
    schema: duplicateContentAuditInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => {
      const rawPages = await getCrawlPages(crawlRun.id);
      if (rawPages.length === 0) {
        throw new TaskExecutionError("Site Crawl contains 0 pages.", 400);
      }

      const { clusters, summary } = detectDeterministicDuplicateClusters(rawPages);
      const allowedUrls = new Set(rawPages.map((p) => p.url));
      const initialFlags: TaskRunFlag[] = [];

      if (clusters.length === 0) {
        initialFlags.push({
          code: "no-duplicate-content",
          message: "No duplicate content, duplicate metadata, or thin pages (<250 words) detected.",
          severity: "warning",
        });
      }

      return { property, clusters, summary, allowedUrls, initialFlags };
    },
    draftWithClaude: async ({ data, feedback }) => {
      if (data.clusters.length === 0) {
        return [];
      }
      const { system, prompt } = buildDuplicateContentPrompt({
        property: data.property,
        clusters: data.clusters,
        summary: data.summary,
        feedback,
      });
      const text = await callClaude({ system, prompt, maxTokens: 4096, taskId: "duplicate-content-audit" });
      return parseDuplicateContentDraft(text);
    },
    validate: ({ data, draft }) => {
      const outcome = validateDuplicateContentRows({
        draft,
        clusters: data.clusters,
        allowedUrls: data.allowedUrls,
      });
      return {
        ...outcome,
        flags: [...data.initialFlags, ...outcome.flags],
      };
    },
    renderTemplate: async ({ data, draft }) => {
      const output = await renderDuplicateContentOutput({
        property: data.property,
        summary: data.summary,
        rows: draft,
      });
      return { outputUrl: output.spreadsheetUrl, output };
    },
  });
}
