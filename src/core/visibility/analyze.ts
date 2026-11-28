/**
 * Deterministic answer analysis.
 *
 * Mention and citation extraction are plain text/URL matching, not an LLM
 * judge. That keeps results auditable and prevents a model from inventing a
 * mention. Competitor citation classification only uses operator-supplied
 * domains; we never guess who a competitor is.
 */

import type { CitationRef, CitationSource, CitationType, ProviderAnswer, ProviderId } from "./types.ts";

const SOCIAL_DOMAINS = [
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "reddit.com",
  "pinterest.com",
  "tripadvisor.com",
  "yelp.com",
  "quora.com",
];

const INFORMATIONAL_DOMAINS = [
  "wikipedia.org",
  "britannica.com",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "nytimes.com",
  "theguardian.com",
  "wsj.com",
  "bloomberg.com",
  "forbes.com",
  "cnn.com",
  "travelandleisure.com",
  "cntraveler.com",
  "nationalgeographic.com",
];

function normalizeDomain(value: string): string {
  return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

function matchesDomain(domain: string, expected: string): boolean {
  return domain === expected || domain.endsWith(`.${expected}`);
}

export function classifyCitation(
  url: string,
  targetDomain: string,
  competitorDomains: string[] = []
): CitationRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const domain = normalizeDomain(parsed.hostname);
  if (!domain) return null;

  let source: CitationSource = "other";
  if (targetDomain && matchesDomain(domain, normalizeDomain(targetDomain))) source = "own";
  else if (competitorDomains.some((competitor) => matchesDomain(domain, normalizeDomain(competitor)))) source = "competitor";
  else if (SOCIAL_DOMAINS.some((social) => matchesDomain(domain, social))) source = "social";
  else if (
    INFORMATIONAL_DOMAINS.some((info) => matchesDomain(domain, info)) ||
    domain.endsWith(".gov") ||
    domain.endsWith(".edu")
  ) {
    source = "informational";
  }

  return { url, domain, source };
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]}"'<>]+/gi) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;:!?]+$/, "")))];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findMentions(answer: string, brand: string, targetDomain: string): { mentioned: boolean; snippets: string[] } {
  const terms = new Set<string>();
  if (brand.trim().length > 1) terms.add(brand.trim());
  const token = normalizeDomain(targetDomain).split(".")[0];
  if (token && token.length > 3 && token !== "www") terms.add(token);

  const sentences = answer.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
  const snippets: string[] = [];
  let mentioned = false;
  for (const term of terms) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i");
    if (!pattern.test(answer)) continue;
    mentioned = true;
    for (const sentence of sentences) {
      if (pattern.test(sentence) && !snippets.includes(sentence)) snippets.push(sentence.slice(0, 300));
    }
  }
  return { mentioned, snippets: snippets.slice(0, 3) };
}

export interface AnalyzeAnswerInput {
  provider: ProviderId;
  promptId: string;
  brand: string;
  targetDomain: string;
  competitorDomains?: string[];
  model: string | null;
  answer: string;
  providerCitations?: Array<{ url: string; title?: string }>;
  estimatedCostUsd?: number | null;
  answeredAt?: string;
  citationType?: CitationType;
}

export function analyzeAnswer(input: AnalyzeAnswerInput): ProviderAnswer {
  const { mentioned, snippets } = findMentions(input.answer, input.brand, input.targetDomain);
  // Memory-only answers can name URLs without having opened them. Those are
  // not web-grounded citations, so they are excluded from citation counts.
  const urls = [
    ...(input.providerCitations ?? []).map((citation) => citation.url),
    ...(input.citationType === "model_memory" ? [] : extractUrls(input.answer)),
  ];
  const citations = [...new Set(urls)]
    .map((url) => classifyCitation(url, input.targetDomain, input.competitorDomains))
    .filter((citation): citation is CitationRef => citation !== null);
  const ownCitationCount = citations.filter((citation) => citation.source === "own").length;

  return {
    provider: input.provider,
    promptId: input.promptId,
    available: true,
    model: input.model,
    answeredAt: input.answeredAt ?? new Date().toISOString(),
    answer: input.answer,
    mentioned,
    mentionSnippets: snippets,
    citations,
    ownCitationCount,
    estimatedCostUsd: input.estimatedCostUsd ?? null,
    citationType: input.citationType,
  };
}

export function unavailableAnswer(
  provider: ProviderId,
  promptId: string,
  reason: string,
  model: string | null = null
): ProviderAnswer {
  return {
    provider,
    promptId,
    available: false,
    reason,
    model,
    answeredAt: new Date().toISOString(),
    answer: null,
    mentioned: null,
    mentionSnippets: [],
    citations: [],
    ownCitationCount: null,
    estimatedCostUsd: null,
    citationType: "unavailable",
  };
}
