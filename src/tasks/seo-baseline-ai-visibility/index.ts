import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { getLatestCrawlRunForProperty } from "@/core/crawler";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { buildSeoBaselinePrompt, parseSeoBaselineDraft } from "./prompt";
import { renderSeoBaselineDeck, type SeoBaselineOutput } from "./render";
import {
  seoBaselineInputSchema,
  type SeoBaselineDraft,
  type SeoBaselineInput,
} from "./schema";
import {
  runDeterministicBaselineChecks,
  validateSeoBaselineDraft,
  type BaselineDeterministicResult,
} from "./validator";

export interface SeoBaselineDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number }) => Promise<string>;
}

interface BaselineDataBundle {
  deterministic: BaselineDeterministicResult;
  crawledPageCount?: number;
}

function buildFallbackDraft(
  input: SeoBaselineInput,
  deterministic: BaselineDeterministicResult,
): SeoBaselineDraft {
  const sm = input.semrushSummary;
  const ai = input.aiVisibility;
  const kwTotal = deterministic.reconciledTotalKeywords ?? sm.totalRankingKeywords ?? 0;

  return {
    mobileTrafficSummary:
      input.mobileTrends.trafficNote ||
      `Mobile organic traffic baseline is ${sm.organicTraffic ?? "recorded in Semrush"} visits.`,
    mobileKeywordsSummary:
      input.mobileTrends.keywordNote ||
      `Site currently ranks for ${kwTotal} total keywords across mobile search.`,
    mobileAnalysis:
      "Mobile keyword stability will be tracked alongside core hotel landing page optimizations.",
    desktopTrafficSummary:
      input.desktopTrends.trafficNote ||
      `Desktop organic traffic baseline is ${sm.organicTraffic ?? "recorded in Semrush"} visits.`,
    desktopKeywordsSummary:
      input.desktopTrends.keywordNote ||
      `Desktop visibility spans ${sm.nonBrandKeywords ?? 0} non-brand and ${sm.brandKeywords ?? 0} brand terms.`,
    desktopAnalysis:
      "Desktop rankings provide a baseline for expanding non-brand hospitality and amenity discovery.",
    compSetTakeaway:
      input.compSetNotes?.trim() ||
      "Closing non-brand keyword gaps against the local comp set will guide on-page and content priorities.",
    aiVisibilityTakeaway: `Baseline AI visibility is ${ai.visibilityScore ?? "pending"}% with ${ai.brandMentions ?? 0} mentions and ${ai.pagesCited ?? 0} cited pages.`,
  };
}

export async function runSeoBaselineAiVisibility(
  rawInput: unknown,
  deps: SeoBaselineDeps = {},
): Promise<PipelineResult<SeoBaselineOutput>> {
  const callClaude = deps.callClaude ?? (isClaudeConfigured() ? generateClaudeText : null);

  return runTaskPipeline<
    SeoBaselineInput,
    BaselineDataBundle,
    SeoBaselineDraft,
    SeoBaselineOutput
  >({
    taskId: "seo-baseline-ai-visibility",
    schema: seoBaselineInputSchema,
    rawInput,
    fetchData: async (input) => {
      let crawledPageCount: number | undefined;
      if (input.propertyId) {
        const latestCrawl = await getLatestCrawlRunForProperty(input.propertyId).catch(() => null);
        if (latestCrawl) crawledPageCount = latestCrawl.pagesCrawled;
      }
      return {
        deterministic: runDeterministicBaselineChecks(input, crawledPageCount),
        crawledPageCount,
      };
    },
    draftWithClaude: async ({ input, data, feedback }) => {
      if (!callClaude) {
        return buildFallbackDraft(input, data.deterministic);
      }
      const { system, prompt } = buildSeoBaselinePrompt({
        input,
        deterministicFindings: data.deterministic.findings,
        feedback,
      });
      const raw = await callClaude({ system, prompt, maxTokens: 900 });
      try {
        return parseSeoBaselineDraft(raw);
      } catch {
        return buildFallbackDraft(input, data.deterministic);
      }
    },
    validate: ({ draft, data }) => {
      const outcome = validateSeoBaselineDraft(draft);
      return {
        ...outcome,
        flags: [...data.deterministic.flags, ...outcome.flags],
      };
    },
    renderTemplate: async ({ input, data, draft, flags }) =>
      renderSeoBaselineDeck({
        input,
        draft,
        reconciledTotalKeywords: data.deterministic.reconciledTotalKeywords,
        indexedPages: input.semrushSummary.indexedPages ?? data.crawledPageCount,
        flags,
      }),
  });
}
