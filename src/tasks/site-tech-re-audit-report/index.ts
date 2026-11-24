import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildSiteTechReAuditPrompt,
  parseSiteTechReAuditDraft,
} from "./prompt";
import {
  renderSiteTechReAuditReportOutput,
  type SiteTechReAuditReportOutput,
} from "./render";
import {
  siteTechReAuditReportDraftSchema,
  siteTechReAuditReportInputSchema,
  type SiteTechReAuditReportDraft,
  type SiteTechReAuditReportInput,
} from "./schema";
import { validateSiteTechReAuditDraft } from "./validator";

export interface SiteTechReAuditDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runSiteTechReAuditReportTask(
  rawInput: unknown,
  deps: SiteTechReAuditDeps = {},
): Promise<PipelineResult<SiteTechReAuditReportOutput>> {
  const parsed = siteTechReAuditReportInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    SiteTechReAuditReportInput,
    { priorCount: number; currentCount: number },
    SiteTechReAuditReportDraft,
    SiteTechReAuditReportOutput
  >({
    taskId: "site-tech-re-audit-report",
    propertyId: input.propertyId,
    schema: siteTechReAuditReportInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => ({
      priorCount: input.priorIssues?.length ?? 0,
      currentCount: input.currentFindings?.length ?? 0,
    }),
    draftWithClaude: async ({ feedback }) => {
      const { system, prompt } = buildSiteTechReAuditPrompt({ input, feedback });
      const rawText = await callClaude({
        system,
        prompt,
        taskId: "site-tech-re-audit-report",
      });
      const parsedDraft = parseSiteTechReAuditDraft(rawText);
      const validated = siteTechReAuditReportDraftSchema.safeParse(parsedDraft);
      if (!validated.success) {
        throw new Error(`Claude draft does not match schema: ${validated.error.message}`);
      }
      return validated.data;
    },
    validate: ({ draft }) => validateSiteTechReAuditDraft(draft, input),
    renderTemplate: async ({ draft, flags }) =>
      renderSiteTechReAuditReportOutput({ input, draft, flags }),
  });
}
