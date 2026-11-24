import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildEmailOutreachPrompt,
  parseEmailOutreachDraft,
} from "./prompt";
import {
  renderEmailOutreachFormattingOutput,
  type EmailOutreachFormattingOutput,
} from "./render";
import {
  emailOutreachFormattingDraftSchema,
  emailOutreachFormattingInputSchema,
  type EmailOutreachFormattingDraft,
  type EmailOutreachFormattingInput,
} from "./schema";
import { validateEmailOutreachDraft } from "./validator";

export interface EmailOutreachFormattingDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runEmailOutreachFormattingTask(
  rawInput: unknown,
  deps: EmailOutreachFormattingDeps = {},
): Promise<PipelineResult<EmailOutreachFormattingOutput>> {
  const parsed = emailOutreachFormattingInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    EmailOutreachFormattingInput,
    { personaCount: number },
    EmailOutreachFormattingDraft,
    EmailOutreachFormattingOutput
  >({
    taskId: "email-outreach-formatting",
    propertyId: input.propertyId,
    schema: emailOutreachFormattingInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ personaCount: input.targetPersonas.length }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildEmailOutreachPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "email-outreach-formatting",
      });
      const parsedDraft = parseEmailOutreachDraft(rawText);
      const validated = emailOutreachFormattingDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateEmailOutreachDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderEmailOutreachFormattingOutput({ input, draft, flags }),
  });
}
