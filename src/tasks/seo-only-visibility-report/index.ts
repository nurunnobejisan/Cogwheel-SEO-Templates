import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { buildSeoVisibilityNarrativePrompt, parseSeoVisibilityNarrative } from "./prompt";
import { renderSeoVisibilityReportOutput, type SeoVisibilityReportOutput } from "./render";
import {
  seoVisibilityReportInputSchema,
  type SeoVisibilityNarrativeDraft,
  type SeoVisibilityReportInput,
} from "./schema";
import { runDeterministicReportChecks, validateSeoVisibilityDraft } from "./validator";

export interface SeoVisibilityReportDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number }) => Promise<string>;
}

interface ReportDataBundle {
  flags: TaskRunFlag[];
  findings: string[];
}

function buildFallbackNarrative(input: SeoVisibilityReportInput): SeoVisibilityNarrativeDraft {
  const s = input.summary;
  const hostMode = s.is_brand_hosted ? "brand-hosted" : "standalone";
  return {
    executiveSummary: `${s.property_name} (${hostMode}, ${s.slide_count} slides) includes ${s.tracked_count} tracked keywords and ${s.ancillary_count} ancillary keywords, with ${s.top10_count} rankings in the top 10.`,
    highlights: [
      `Top 3 ancillary keywords: ${s.rank_buckets.top3}`,
      `Positions 4-10 ancillary keywords: ${s.rank_buckets.pos4_10}`,
      `Positions 11-20 ancillary keywords: ${s.rank_buckets.pos11_20}`,
    ],
  };
}

export async function runSeoOnlyVisibilityReport(
  rawInput: unknown,
  deps: SeoVisibilityReportDeps = {},
): Promise<PipelineResult<SeoVisibilityReportOutput>> {
  const callClaude = deps.callClaude ?? (isClaudeConfigured() ? generateClaudeText : null);

  return runTaskPipeline<
    SeoVisibilityReportInput,
    ReportDataBundle,
    SeoVisibilityNarrativeDraft,
    SeoVisibilityReportOutput
  >({
    taskId: "seo-only-visibility-report",
    schema: seoVisibilityReportInputSchema,
    rawInput,
    fetchData: async (input) => runDeterministicReportChecks(input.summary, input),
    draftWithClaude: async ({ input, data, feedback }) => {
      if (!callClaude) {
        return buildFallbackNarrative(input);
      }
      const { system, prompt } = buildSeoVisibilityNarrativePrompt({
        summary: input.summary,
        deterministicFindings: data.findings,
        feedback,
      });
      const raw = await callClaude({ system, prompt, maxTokens: 700 });
      try {
        return parseSeoVisibilityNarrative(raw);
      } catch {
        return buildFallbackNarrative(input);
      }
    },
    validate: ({ input, data, draft }) => {
      const outcome = validateSeoVisibilityDraft(draft, input.summary);
      return {
        ...outcome,
        flags: [...data.flags, ...outcome.flags],
      };
    },
    renderTemplate: async ({ input, data, draft, flags }) => ({
      outputUrl: input.downloadName ? `download://${input.downloadName}` : null,
      output: renderSeoVisibilityReportOutput({
        input,
        draft,
        deterministicFindings: data.findings,
        flags,
      }),
    }),
  });
}
