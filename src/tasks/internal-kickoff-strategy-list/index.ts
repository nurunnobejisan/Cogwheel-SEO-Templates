import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildInternalKickoffStrategyPrompt,
  parseInternalKickoffStrategyDraft,
} from "./prompt";
import {
  renderInternalKickoffStrategyListOutput,
  type InternalKickoffStrategyListOutput,
} from "./render";
import {
  internalKickoffStrategyListDraftSchema,
  internalKickoffStrategyListInputSchema,
  type InternalKickoffStrategyListDraft,
  type InternalKickoffStrategyListInput,
} from "./schema";
import { validateInternalKickoffStrategyDraft } from "./validator";

export interface InternalKickoffStrategyListDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runInternalKickoffStrategyListTask(
  rawInput: unknown,
  deps: InternalKickoffStrategyListDeps = {},
): Promise<PipelineResult<InternalKickoffStrategyListOutput>> {
  const parsed = internalKickoffStrategyListInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    InternalKickoffStrategyListInput,
    { propertyUrl: string },
    InternalKickoffStrategyListDraft,
    InternalKickoffStrategyListOutput
  >({
    taskId: "internal-kickoff-strategy-list",
    propertyId: input.propertyId,
    schema: internalKickoffStrategyListInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ propertyUrl: input.property.url }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildInternalKickoffStrategyPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "internal-kickoff-strategy-list",
      });
      const parsedDraft = parseInternalKickoffStrategyDraft(rawText);
      const validated = internalKickoffStrategyListDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateInternalKickoffStrategyDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderInternalKickoffStrategyListOutput({ input, draft, flags }),
  });
}
