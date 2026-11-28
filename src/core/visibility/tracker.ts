/**
 * Visibility run orchestration.
 *
 * A run asks the generated buyer prompts to each configured provider and
 * records one row per prompt × provider. Unconfigured providers are recorded
 * as `unavailable` rather than dropped, so coverage is visible.
 */

import { getProviderAdapters, type ProviderAdapter } from "./adapters.ts";
import { generatePromptSet, type PromptSetInput } from "./prompts.ts";
import type {
  PromptResult,
  ProviderId,
  ProviderSummary,
  VisibilityRun,
  VisibilitySummary,
} from "./types.ts";

export interface RunVisibilityOptions extends PromptSetInput {
  providers?: ProviderId[];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function runVisibilityTracker(options: RunVisibilityOptions): Promise<VisibilityRun> {
  const startedAt = new Date().toISOString();
  const promptSet = generatePromptSet({ ...options, maxPrompts: options.maxPrompts ?? 8 });
  const adapters = getProviderAdapters().filter(
    (adapter) => !options.providers || options.providers.includes(adapter.id)
  );
  const results: PromptResult[] = [];

  for (const adapter of adapters) {
    const answers = await mapLimit(promptSet.prompts, 3, async (prompt) => {
      const answer = await adapter.query({ promptSet, prompt });
      const result: PromptResult = {
        promptId: prompt.id,
        prompt: prompt.text,
        intent: prompt.intent,
        branded: prompt.branded,
        provider: adapter.id,
        available: answer.available,
        reason: answer.reason,
        mentioned: answer.mentioned,
        mentionCount: answer.mentionSnippets.length,
        ownCitations: answer.ownCitationCount,
        citations: answer.citations,
        model: answer.model,
        answeredAt: answer.answeredAt,
        citationType: answer.citationType,
        answer: answer.answer,
        citedSources: [
          ...new Set(
            answer.citations
              .filter((citation) => citation.source !== "own" && citation.source !== "competitor")
              .map((citation) => citation.domain)
          ),
        ],
      };
      return result;
    });
    results.push(...answers);
  }

  const finishedAt = new Date().toISOString();
  return {
    id: `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    targetUrl: promptSet.targetUrl,
    brand: promptSet.brand,
    mode: promptSet.mode,
    startedAt,
    finishedAt,
    providersRequested: adapters.map((adapter) => adapter.id),
    results,
    summary: summarizeResults(promptSet.prompts.map((prompt) => prompt.id), results, adapters),
  };
}

export function summarizeResults(
  promptIds: string[],
  results: PromptResult[],
  adapters: ProviderAdapter[]
): VisibilitySummary {
  const available = results.filter((result) => result.available);
  const mentioned = available.filter((result) => result.mentioned === true);
  const byProvider: ProviderSummary[] = adapters.map((adapter) => {
    const rows = results.filter((result) => result.provider === adapter.id);
    const answered = rows.filter((row) => row.available);
    const said = answered.filter((row) => row.mentioned === true);
    const reason = rows.find((row) => !row.available)?.reason;
    return {
      provider: adapter.id,
      available: answered.length > 0,
      reason,
      answeredPrompts: answered.length,
      mentionedPrompts: said.length,
      mentionRate: answered.length > 0 ? Number((said.length / answered.length).toFixed(4)) : null,
      ownCitations: answered.length > 0
        ? answered.reduce((sum, row) => sum + (row.ownCitations ?? 0), 0)
        : null,
    };
  });

  const absentPromptIds = promptIds.filter((promptId) => {
    const rows = results.filter((result) => result.promptId === promptId && result.available);
    return rows.length > 0 && !rows.some((row) => row.mentioned === true);
  });
  const unmeasuredPromptIds = promptIds.filter(
    (promptId) => !results.some((result) => result.promptId === promptId && result.available)
  );

  return {
    totalPrompts: promptIds.length,
    totalAnswersRequested: results.length,
    availableAnswers: available.length,
    unavailableAnswers: results.length - available.length,
    mentionRate: available.length > 0 ? Number((mentioned.length / available.length).toFixed(4)) : null,
    ownCitationCount: available.length > 0
      ? available.reduce((sum, row) => sum + (row.ownCitations ?? 0), 0)
      : null,
    byProvider,
    absentPromptIds,
    unmeasuredPromptIds,
  };
}
