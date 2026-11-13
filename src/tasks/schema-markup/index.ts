import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { getCrawlPages } from "@/core/crawler";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { resolvePropertyAndCrawl, type PropertySummary } from "@/tasks/_shared/crawl-context";
import { TaskExecutionError } from "@/tasks/keyword-research";
import { buildSchemaMarkupPrompt, extractSchemaCandidates, parseSchemaMarkupDraft } from "./prompt";
import { renderSchemaMarkupOutput, type SchemaMarkupOutput } from "./render";
import {
  schemaMarkupInputSchema,
  type SchemaMarkupInput,
  type SchemaMarkupItemDraft,
  type SchemaPageCandidate,
} from "./schema";
import { validateSchemaMarkupItems } from "./validator";

interface SchemaMarkupDataBundle {
  property: PropertySummary;
  candidates: SchemaPageCandidate[];
  initialFlags: TaskRunFlag[];
}

export interface SchemaMarkupDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runSchemaMarkupTask(
  rawInput: unknown,
  deps: SchemaMarkupDeps = {},
): Promise<PipelineResult<SchemaMarkupOutput>> {
  const parsed = schemaMarkupInputSchema.safeParse(rawInput);
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
    SchemaMarkupInput,
    SchemaMarkupDataBundle,
    SchemaMarkupItemDraft[],
    SchemaMarkupOutput
  >({
    taskId: "schema-markup",
    propertyId,
    schema: schemaMarkupInputSchema,
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

      const candidates = extractSchemaCandidates(filtered);
      const missingCount = candidates.filter((c) => c.existingTypes.length === 0).length;
      const initialFlags: TaskRunFlag[] = [];
      if (missingCount > 0) {
        initialFlags.push({
          code: "missing-schema-pages",
          message: `${missingCount} of ${candidates.length} crawled pages have no JSON-LD structured data.`,
          severity: "warning",
        });
      }

      return { property, candidates, initialFlags };
    },
    draftWithClaude: async ({ data, feedback }) => {
      const { system, prompt } = buildSchemaMarkupPrompt({
        property: data.property,
        candidates: data.candidates,
        feedback,
      });
      const text = await callClaude({ system, prompt, maxTokens: 4096, taskId: "schema-markup" });
      return parseSchemaMarkupDraft(text);
    },
    validate: ({ data, draft }) => {
      const outcome = validateSchemaMarkupItems({
        draft,
        candidates: data.candidates,
        propertyNotes: data.property.notes ?? undefined,
      });
      return {
        ...outcome,
        flags: [...data.initialFlags, ...outcome.flags],
      };
    },
    renderTemplate: async ({ draft }) => {
      const output = renderSchemaMarkupOutput(draft);
      return { outputUrl: null, output };
    },
  });
}
