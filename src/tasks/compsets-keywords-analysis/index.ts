import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import { buildCompsetKeywordsPrompt, parseCompsetKeywordsDraft } from "./prompt";
import { renderCompsetsKeywordsAnalysisOutput, type CompsetsKeywordsAnalysisOutput } from "./render";
import {
  compsetsKeywordsAnalysisDraftSchema,
  compsetsKeywordsAnalysisInputSchema,
  type CompsetsKeywordsAnalysisDraft,
  type CompsetsKeywordsAnalysisInput,
} from "./schema";
import { validateCompsetKeywordsDraft } from "./validator";

export interface CompsetsKeywordsAnalysisDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runCompsetsKeywordsAnalysisTask(
  rawInput: unknown,
  deps: CompsetsKeywordsAnalysisDeps = {},
): Promise<PipelineResult<CompsetsKeywordsAnalysisOutput>> {
  const parsed = compsetsKeywordsAnalysisInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    CompsetsKeywordsAnalysisInput,
    { compsetCount: number },
    CompsetsKeywordsAnalysisDraft,
    CompsetsKeywordsAnalysisOutput
  >({
    taskId: "compsets-keywords-analysis",
    propertyId: input.propertyId,
    schema: compsetsKeywordsAnalysisInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ compsetCount: input.compsetDomains.length }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildCompsetKeywordsPrompt({ input, feedback });
      const rawText = await callClaude({ system, prompt, taskId: "compsets-keywords-analysis" });
      const parsedDraft = parseCompsetKeywordsDraft(rawText);
      const validated = compsetsKeywordsAnalysisDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateCompsetKeywordsDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderCompsetsKeywordsAnalysisOutput({ input, draft, flags }),
  });
}
