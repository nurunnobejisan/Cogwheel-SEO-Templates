import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildFinalProjectReportPrompt,
  parseFinalProjectReportDraft,
} from "./prompt";
import {
  renderFinalProjectReportOutput,
  type FinalSeoGeoProjectReportOutput,
} from "./render";
import {
  finalSeoGeoProjectReportDraftSchema,
  finalSeoGeoProjectReportInputSchema,
  type FinalSeoGeoProjectReportDraft,
  type FinalSeoGeoProjectReportInput,
} from "./schema";
import { validateFinalProjectReportDraft } from "./validator";

export interface FinalProjectReportDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runFinalSeoGeoProjectReportTask(
  rawInput: unknown,
  deps: FinalProjectReportDeps = {},
): Promise<PipelineResult<FinalSeoGeoProjectReportOutput>> {
  const parsed = finalSeoGeoProjectReportInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    FinalSeoGeoProjectReportInput,
    { completedCount: number },
    FinalSeoGeoProjectReportDraft,
    FinalSeoGeoProjectReportOutput
  >({
    taskId: "final-seo-geo-project-report",
    propertyId: input.propertyId,
    schema: finalSeoGeoProjectReportInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ completedCount: input.completedTasksCount }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildFinalProjectReportPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "final-seo-geo-project-report",
      });
      const parsedDraft = parseFinalProjectReportDraft(rawText);
      const validated = finalSeoGeoProjectReportDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateFinalProjectReportDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderFinalProjectReportOutput({ input, draft, flags }),
  });
}
