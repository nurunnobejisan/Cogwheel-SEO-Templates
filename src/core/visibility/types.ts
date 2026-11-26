/**
 * Visibility tracking types.
 *
 * "Unavailable" is a first-class result: when a provider has no key (or no
 * official API), mention/citation values are `null`, never `false`. `false`
 * means we measured an answer and the brand was absent.
 */

export type VisibilityMode = "hotel" | "universal";

export type ProviderId = "chatgpt" | "claude" | "perplexity" | "gemini" | "ai_overviews";

export type PromptIntent = "comparison" | "local" | "transactional" | "informational" | "branded";

export interface BuyerPrompt {
  id: string;
  text: string;
  intent: PromptIntent;
  /** True when the prompt already contains the brand name. */
  branded: boolean;
}

export interface PromptSet {
  targetUrl: string;
  brand: string;
  domain: string;
  mode: VisibilityMode;
  city: string | null;
  category: string | null;
  competitorDomains: string[];
  prompts: BuyerPrompt[];
  generatedAt: string;
}

export type CitationSource = "own" | "competitor" | "social" | "informational" | "other";

export interface CitationRef {
  url: string;
  domain: string;
  source: CitationSource;
}

export interface ProviderAnswer {
  provider: ProviderId;
  promptId: string;
  available: boolean;
  reason?: string;
  model: string | null;
  answeredAt: string;
  /** Raw answer text. Null when unavailable. */
  answer: string | null;
  /** `null` = not measured (provider unavailable). */
  mentioned: boolean | null;
  mentionSnippets: string[];
  citations: CitationRef[];
  ownCitationCount: number | null;
  estimatedCostUsd: number | null;
}

export interface PromptResult {
  promptId: string;
  prompt: string;
  intent: PromptIntent;
  branded: boolean;
  provider: ProviderId;
  available: boolean;
  reason?: string;
  mentioned: boolean | null;
  mentionCount: number;
  ownCitations: number | null;
  citations: CitationRef[];
  model: string | null;
  answeredAt: string;
}

export interface VisibilityRun {
  id: string;
  targetUrl: string;
  brand: string;
  mode: VisibilityMode;
  startedAt: string;
  finishedAt: string;
  providersRequested: ProviderId[];
  results: PromptResult[];
  summary: VisibilitySummary;
}

export interface ProviderSummary {
  provider: ProviderId;
  available: boolean;
  reason?: string;
  answeredPrompts: number;
  mentionedPrompts: number;
  mentionRate: number | null;
  ownCitations: number | null;
}

export interface VisibilitySummary {
  totalPrompts: number;
  totalAnswersRequested: number;
  availableAnswers: number;
  unavailableAnswers: number;
  /** Over available answers only; null when nothing was measured. */
  mentionRate: number | null;
  ownCitationCount: number | null;
  byProvider: ProviderSummary[];
  /** Prompts with at least one available answer where the brand was absent. */
  absentPromptIds: string[];
  /** Prompts where no provider returned an answer. */
  unmeasuredPromptIds: string[];
}

export interface VisibilityGap {
  promptId: string;
  prompt: string;
  intent: PromptIntent;
  branded: boolean;
  severity: "critical" | "high" | "medium" | "low";
  providersWithAnswer: ProviderId[];
  providersAbsent: ProviderId[];
  competitorCitations: string[];
  ownCitations: number;
  rationale: string;
  recommendedActions: string[];
}

export interface GapReport {
  targetUrl: string;
  brand: string;
  measuredAt: string;
  measuredPrompts: number;
  mentionRate: number | null;
  gaps: VisibilityGap[];
  unmeasuredPrompts: Array<{ promptId: string; prompt: string; reasons: string[] }>;
}
