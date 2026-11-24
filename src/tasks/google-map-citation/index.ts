import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildGoogleMapCitationPrompt,
  parseGoogleMapCitationDraft,
} from "./prompt";
import {
  renderGoogleMapCitationOutput,
  type GoogleMapCitationOutput,
} from "./render";
import {
  googleMapCitationDraftSchema,
  googleMapCitationInputSchema,
  type GoogleMapCitationDraft,
  type GoogleMapCitationInput,
} from "./schema";
import { validateGoogleMapCitationDraft } from "./validator";

export interface GoogleMapCitationDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runGoogleMapCitationTask(
  rawInput: unknown,
  deps: GoogleMapCitationDeps = {},
): Promise<PipelineResult<GoogleMapCitationOutput>> {
  const parsed = googleMapCitationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    GoogleMapCitationInput,
    { hasAddress: boolean },
    GoogleMapCitationDraft,
    GoogleMapCitationOutput
  >({
    taskId: "google-map-citation",
    propertyId: input.propertyId,
    schema: googleMapCitationInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ hasAddress: Boolean(input.property.address) }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildGoogleMapCitationPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "google-map-citation",
      });
      const parsedDraft = parseGoogleMapCitationDraft(rawText);
      const validated = googleMapCitationDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateGoogleMapCitationDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderGoogleMapCitationOutput({ input, draft, flags }),
  });
}
