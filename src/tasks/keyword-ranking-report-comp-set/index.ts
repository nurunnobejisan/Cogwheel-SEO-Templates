import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildKeywordRankingCompSetPrompt,
  parseKeywordRankingCompSetDraft,
} from "./prompt";
import {
  renderKeywordRankingReportCompSetOutput,
  type KeywordRankingReportCompSetOutput,
} from "./render";
import {
  keywordRankingReportCompSetDraftSchema,
  keywordRankingReportCompSetInputSchema,
  type KeywordRankingReportCompSetDraft,
  type KeywordRankingReportCompSetInput,
} from "./schema";
import { validateKeywordRankingCompSetDraft } from "./validator";

export interface KeywordRankingReportCompSetDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runKeywordRankingReportCompSetTask(
  rawInput: unknown,
  deps: KeywordRankingReportCompSetDeps = {},
): Promise<PipelineResult<KeywordRankingReportCompSetOutput>> {
  const parsed = keywordRankingReportCompSetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    KeywordRankingReportCompSetInput,
    { trackedCount: number },
    KeywordRankingReportCompSetDraft,
    KeywordRankingReportCompSetOutput
  >({
    taskId: "keyword-ranking-report-comp-set",
    propertyId: input.propertyId,
    schema: keywordRankingReportCompSetInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ trackedCount: input.trackedKeywords.length }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildKeywordRankingCompSetPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "keyword-ranking-report-comp-set",
      });
      const parsedDraft = parseKeywordRankingCompSetDraft(rawText);
      const validated = keywordRankingReportCompSetDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateKeywordRankingCompSetDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderKeywordRankingReportCompSetOutput({ input, draft, flags }),
  });
}
