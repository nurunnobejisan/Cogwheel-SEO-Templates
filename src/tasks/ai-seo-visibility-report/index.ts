import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildAiSeoVisibilityPrompt,
  parseAiSeoVisibilityDraft,
} from "./prompt";
import {
  renderAiSeoVisibilityReportOutput,
  type AiSeoVisibilityReportOutput,
} from "./render";
import {
  aiSeoVisibilityReportDraftSchema,
  aiSeoVisibilityReportInputSchema,
  type AiSeoVisibilityReportDraft,
  type AiSeoVisibilityReportInput,
} from "./schema";
import { validateAiSeoVisibilityDraft } from "./validator";

export interface AiSeoVisibilityDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runAiSeoVisibilityReportTask(
  rawInput: unknown,
  deps: AiSeoVisibilityDeps = {},
): Promise<PipelineResult<AiSeoVisibilityReportOutput>> {
  const parsed = aiSeoVisibilityReportInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    AiSeoVisibilityReportInput,
    { hasPeriod: boolean },
    AiSeoVisibilityReportDraft,
    AiSeoVisibilityReportOutput
  >({
    taskId: "ai-seo-visibility-report",
    propertyId: input.propertyId,
    schema: aiSeoVisibilityReportInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ hasPeriod: Boolean(input.quarterPeriod) }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildAiSeoVisibilityPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "ai-seo-visibility-report",
      });
      const parsedDraft = parseAiSeoVisibilityDraft(rawText);
      const validated = aiSeoVisibilityReportDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateAiSeoVisibilityDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderAiSeoVisibilityReportOutput({ input, draft, flags }),
  });
}
