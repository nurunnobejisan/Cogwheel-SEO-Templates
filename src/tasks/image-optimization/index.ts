import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { getCrawlPages } from "@/core/crawler";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import {
  loadKeywordMapForProperty,
  resolvePropertyAndCrawl,
  type PropertySummary,
} from "@/tasks/_shared/crawl-context";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildImageOptimizationPrompt,
  detectDeterministicImageIssues,
  parseImageOptimizationDraft,
} from "./prompt";
import { renderImageOptimizationOutput, type ImageOptimizationOutput } from "./render";
import {
  imageOptimizationInputSchema,
  type ImageAuditCandidate,
  type ImageOptimizationInput,
  type ImageOptimizationRowDraft,
  type ImageOptimizationSummary,
} from "./schema";
import { validateImageOptimizationRows } from "./validator";

interface ImageOptimizationDataBundle {
  property: PropertySummary;
  candidates: ImageAuditCandidate[];
  summary: ImageOptimizationSummary;
  initialFlags: TaskRunFlag[];
}

export interface ImageOptimizationDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runImageOptimizationTask(
  rawInput: unknown,
  deps: ImageOptimizationDeps = {},
): Promise<PipelineResult<ImageOptimizationOutput>> {
  const parsed = imageOptimizationInputSchema.safeParse(rawInput);
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
    ImageOptimizationInput,
    ImageOptimizationDataBundle,
    ImageOptimizationRowDraft[],
    ImageOptimizationOutput
  >({
    taskId: "image-optimization",
    propertyId,
    schema: imageOptimizationInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => {
      const rawPages = await getCrawlPages(crawlRun.id);
      const indexable = rawPages.filter(
        (p) => p.statusCode === 200 && !(p.robotsMeta ?? "").toLowerCase().includes("noindex"),
      );
      const filtered =
        input.pageUrls && input.pageUrls.length > 0
          ? indexable.filter((p) => input.pageUrls!.includes(p.url))
          : indexable;

      if (filtered.length === 0) {
        throw new TaskExecutionError("Site Crawl has no indexable 200 pages matching the selection.", 400);
      }

      const kwMap = await loadKeywordMapForProperty(propertyId, input.keywordRunId, input.keywordMap);
      const initialFlags: TaskRunFlag[] = [];
      if (kwMap.size === 0) {
        initialFlags.push({
          code: "missing-keyword-run",
          message: "No approved Keyword Research run found; generating alt text from page context.",
          severity: "warning",
        });
      }

      const { candidates, summary } = detectDeterministicImageIssues(filtered, kwMap);
      if (candidates.length === 0) {
        initialFlags.push({
          code: "all-images-optimized",
          message: "All crawled images have descriptive alt text, dimensions, and optimal sizing.",
          severity: "warning",
        });
      }

      return { property, candidates, summary, initialFlags };
    },
    draftWithClaude: async ({ data, feedback }) => {
      if (data.candidates.length === 0) {
        return [];
      }
      const { system, prompt } = buildImageOptimizationPrompt({
        property: data.property,
        candidates: data.candidates,
        feedback,
      });
      const text = await callClaude({ system, prompt, maxTokens: 4096, taskId: "image-optimization" });
      return parseImageOptimizationDraft(text);
    },
    validate: ({ data, draft }) => {
      const outcome = validateImageOptimizationRows({
        draft,
        candidates: data.candidates,
      });
      return {
        ...outcome,
        flags: [...data.initialFlags, ...outcome.flags],
      };
    },
    renderTemplate: async ({ data, draft }) => {
      const output = await renderImageOptimizationOutput({
        property: data.property,
        summary: data.summary,
        rows: draft,
      });
      return { outputUrl: output.spreadsheetUrl, output };
    },
  });
}
