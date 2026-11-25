/**
 * Universal Rule Engine — Pillar 2: Content & Semantic Depth
 *
 * Thin-content detection and readability / keyword-density evaluation for any
 * web property. Entity-gap analysis against SERP benchmarks requires live
 * competitor data and is orchestrated at a higher layer.
 */

import type { AuditRule, PageSnapshot } from "../types.ts";
import { makeIssue } from "../issues.ts";

export const THIN_CONTENT_WORD_COUNT = 300;
export const MIN_READABILITY_WORDS = 50;
export const MIN_FLESCH_READING_EASE = 40;
export const MAX_KEYWORD_DENSITY = 0.05;

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
  "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy", "did",
  "use", "with", "this", "that", "from", "they", "have", "will", "your", "what",
  "when", "make", "like", "time", "just", "know", "take", "into", "them", "some",
  "them", "than", "then", "only", "come", "over", "also", "back", "after", "most",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+(\s|$)/g);
  return Math.max(1, matches ? matches.length : 1);
}

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) {
    return 0;
  }
  if (cleaned.length <= 3) {
    return 1;
  }
  const trimmed = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch Reading Ease (higher is easier). */
export function fleschReadingEase(snapshot: Pick<PageSnapshot, "textContent" | "wordCount">): number {
  const words = Math.max(1, snapshot.wordCount);
  if (words < MIN_READABILITY_WORDS) {
    return 100;
  }
  const sentences = countSentences(snapshot.textContent);
  const tokens = tokenize(snapshot.textContent);
  const syllables = tokens.reduce((total, token) => total + countSyllables(token), 0);
  const score =
    206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / Math.max(1, tokens.length));
  return Math.max(0, Math.min(120, Number(score.toFixed(1))));
}

export function topKeywordDensity(snapshot: Pick<PageSnapshot, "textContent">): {
  term: string;
  density: number;
} {
  const tokens = tokenize(snapshot.textContent).filter((token) => !STOP_WORDS.has(token));
  if (tokens.length === 0) {
    return { term: "", density: 0 };
  }
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  let topTerm = "";
  let topCount = 0;
  for (const [term, count] of counts) {
    if (count > topCount) {
      topTerm = term;
      topCount = count;
    }
  }
  return { term: topTerm, density: Number((topCount / tokens.length).toFixed(4)) };
}

export const thinContentRule: AuditRule = {
  id: "universal/content/thin-content",
  pillar: "content",
  description: `Flag pages with fewer than ${THIN_CONTENT_WORD_COUNT} words of indexable text.`,
  evaluate({ snapshot }) {
    if (snapshot.wordCount >= THIN_CONTENT_WORD_COUNT) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_thin_content",
        category: "content",
        severity: "high",
        fixable: false,
        cmsTargetField: null,
        currentValue: snapshot.wordCount,
        selector: "body",
        recommendedAction: `Expand the page to at least ${THIN_CONTENT_WORD_COUNT} words of original, useful content.`,
      }),
    ];
  },
};

export const readabilityRule: AuditRule = {
  id: "universal/content/readability",
  pillar: "content",
  description: "Warn when Flesch Reading Ease falls below a general-web readability floor.",
  evaluate({ snapshot }) {
    if (snapshot.wordCount < MIN_READABILITY_WORDS) {
      return [];
    }
    const score = fleschReadingEase(snapshot);
    if (score >= MIN_FLESCH_READING_EASE) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_readability_low",
        category: "content",
        severity: "low",
        fixable: false,
        cmsTargetField: null,
        currentValue: score,
        selector: "body",
        recommendedAction:
          "Shorten sentences and simplify vocabulary to improve readability.",
      }),
    ];
  },
};

export const keywordDensityRule: AuditRule = {
  id: "universal/content/keyword-density",
  pillar: "content",
  description: "Flag probable keyword stuffing above 5% density.",
  evaluate({ snapshot }) {
    const { term, density } = topKeywordDensity(snapshot);
    if (!term || density <= MAX_KEYWORD_DENSITY) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_keyword_stuffing",
        category: "content",
        severity: "low",
        fixable: false,
        cmsTargetField: null,
        currentValue: `${term} @ ${(density * 100).toFixed(1)}%`,
        selector: "body",
        recommendedAction: `Reduce repetition of "${term}" and use natural semantic variants.`,
      }),
    ];
  },
};

export const CONTENT_RULES: AuditRule[] = [
  thinContentRule,
  readabilityRule,
  keywordDensityRule,
];
