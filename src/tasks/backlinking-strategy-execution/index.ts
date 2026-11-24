import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildBacklinkingExecutionPrompt,
  parseBacklinkingExecutionDraft,
} from "./prompt";
import {
  renderBacklinkingStrategyExecutionOutput,
  type BacklinkingStrategyExecutionOutput,
} from "./render";
import {
  backlinkingStrategyExecutionDraftSchema,
  backlinkingStrategyExecutionInputSchema,
  type BacklinkingStrategyExecutionDraft,
  type BacklinkingStrategyExecutionInput,
} from "./schema";
import { validateBacklinkingExecutionDraft } from "./validator";

export interface BacklinkingStrategyExecutionDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runBacklinkingStrategyExecutionTask(
  rawInput: unknown,
  deps: BacklinkingStrategyExecutionDeps = {},
): Promise<PipelineResult<BacklinkingStrategyExecutionOutput>> {
  const parsed = backlinkingStrategyExecutionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    BacklinkingStrategyExecutionInput,
    { targetCount: number },
    BacklinkingStrategyExecutionDraft,
    BacklinkingStrategyExecutionOutput
  >({
    taskId: "backlinking-strategy-execution",
    propertyId: input.propertyId,
    schema: backlinkingStrategyExecutionInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ targetCount: input.targetAcquisitionCount }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildBacklinkingExecutionPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "backlinking-strategy-execution",
      });
      const parsedDraft = parseBacklinkingExecutionDraft(rawText);
      const validated = backlinkingStrategyExecutionDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateBacklinkingExecutionDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderBacklinkingStrategyExecutionOutput({ input, draft, flags }),
  });
}
