import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildCompetitorsBacklinkPrompt,
  parseCompetitorsBacklinkDraft,
} from "./prompt";
import {
  renderCompetitorsBacklinkAnalysisOutput,
  type CompetitorsBacklinkAnalysisOutput,
} from "./render";
import {
  competitorsBacklinkAnalysisDraftSchema,
  competitorsBacklinkAnalysisInputSchema,
  type CompetitorsBacklinkAnalysisDraft,
  type CompetitorsBacklinkAnalysisInput,
} from "./schema";
import { validateCompetitorsBacklinkDraft } from "./validator";

export interface CompetitorsBacklinkAnalysisDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runCompetitorsBacklinkAnalysisTask(
  rawInput: unknown,
  deps: CompetitorsBacklinkAnalysisDeps = {},
): Promise<PipelineResult<CompetitorsBacklinkAnalysisOutput>> {
  const parsed = competitorsBacklinkAnalysisInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    CompetitorsBacklinkAnalysisInput,
    { compsetCount: number },
    CompetitorsBacklinkAnalysisDraft,
    CompetitorsBacklinkAnalysisOutput
  >({
    taskId: "competitors-backlink-analysis",
    propertyId: input.propertyId,
    schema: competitorsBacklinkAnalysisInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({ compsetCount: input.compsetDomains.length }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildCompetitorsBacklinkPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "competitors-backlink-analysis",
      });
      const parsedDraft = parseCompetitorsBacklinkDraft(rawText);
      const validated = competitorsBacklinkAnalysisDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateCompetitorsBacklinkDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderCompetitorsBacklinkAnalysisOutput({ input, draft, flags }),
  });
}
