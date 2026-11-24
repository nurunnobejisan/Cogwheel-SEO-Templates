import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildSitemapNavigationPrompt,
  parseSitemapNavigationDraft,
} from "./prompt";
import {
  renderSitemapNavigationOptimizationOutput,
  type SitemapNavigationOptimizationOutput,
} from "./render";
import {
  sitemapNavigationOptimizationDraftSchema,
  sitemapNavigationOptimizationInputSchema,
  type SitemapNavigationOptimizationDraft,
  type SitemapNavigationOptimizationInput,
} from "./schema";
import { validateSitemapNavigationDraft } from "./validator";

export interface SitemapNavigationOptimizationDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runSitemapNavigationOptimizationTask(
  rawInput: unknown,
  deps: SitemapNavigationOptimizationDeps = {},
): Promise<PipelineResult<SitemapNavigationOptimizationOutput>> {
  const parsed = sitemapNavigationOptimizationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    SitemapNavigationOptimizationInput,
    { pageCount: number },
    SitemapNavigationOptimizationDraft,
    SitemapNavigationOptimizationOutput
  >({
    taskId: "sitemap-navigation-optimization",
    propertyId: input.propertyId,
    schema: sitemapNavigationOptimizationInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ pageCount: input.crawledPages?.length ?? 0 }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildSitemapNavigationPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "sitemap-navigation-optimization",
      });
      const parsedDraft = parseSitemapNavigationDraft(rawText);
      const validated = sitemapNavigationOptimizationDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateSitemapNavigationDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderSitemapNavigationOptimizationOutput({ input, draft, flags }),
  });
}
