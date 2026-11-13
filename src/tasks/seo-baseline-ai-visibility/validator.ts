import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import type { SeoBaselineDraft, SeoBaselineInput } from "./schema";

const FORBIDDEN_PLACEHOLDERS = [
  /\[website name\]/i,
  /\[insert/i,
  /\[example analysis\]/i,
  /\[seo team/i,
  /note to seo team/i,
  /this is an example screenshot/i,
  /these are example screenshots/i,
  /remove these instructions/i,
];

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export interface BaselineDeterministicResult {
  flags: TaskRunFlag[];
  findings: string[];
  reconciledTotalKeywords: number | undefined;
}

export function runDeterministicBaselineChecks(
  input: SeoBaselineInput,
  crawledPageCount?: number,
): BaselineDeterministicResult {
  const flags: TaskRunFlag[] = [];
  const findings: string[] = [];
  const sm = input.semrushSummary;
  const ai = input.aiVisibility;

  let reconciledTotal = sm.totalRankingKeywords;
  if (sm.nonBrandKeywords !== undefined && sm.brandKeywords !== undefined) {
    const sum = sm.nonBrandKeywords + sm.brandKeywords;
    if (sm.totalRankingKeywords !== undefined && sm.totalRankingKeywords !== sum) {
      flags.push({
        code: "KEYWORD_TOTAL_MISMATCH",
        message: `Total Ranking Keywords (${sm.totalRankingKeywords}) does not equal Non-Brand (${sm.nonBrandKeywords}) + Brand (${sm.brandKeywords}) = ${sum}.`,
        severity: "warning",
        section: "Slide 4",
      });
    }
    reconciledTotal = reconciledTotal ?? sum;
  }

  if (sm.organicTraffic === undefined || reconciledTotal === undefined) {
    flags.push({
      code: "MISSING_SEMRUSH_METRICS",
      message: "One or more Semrush baseline metrics (Organic Traffic / Ranking Keywords) were omitted.",
      severity: "warning",
      section: "Slide 3",
    });
  } else {
    findings.push(
      `Semrush baseline: ${sm.organicTraffic} organic traffic, ${reconciledTotal} total ranking keywords.`,
    );
  }

  if (!sm.keywordReportUrl) {
    flags.push({
      code: "MISSING_KEYWORD_REPORT_LINK",
      message: "Full keyword ranking report link was not provided for Slide 4.",
      severity: "warning",
      section: "Slide 4",
    });
  }

  const effectiveIndexedPages = sm.indexedPages ?? crawledPageCount;
  if (effectiveIndexedPages === undefined) {
    flags.push({
      code: "MISSING_INDEXED_PAGES",
      message: "Indexed pages count not provided and no Site Crawl run found.",
      severity: "warning",
      section: "Slide 4",
    });
  } else {
    findings.push(`Indexed / crawled pages baseline: ${effectiveIndexedPages}.`);
  }

  if (ai.visibilityScore === undefined) {
    flags.push({
      code: "MISSING_AI_VISIBILITY_SCORE",
      message: "AI Visibility Score was not provided for Slides 8-10.",
      severity: "warning",
      section: "Slide 8",
    });
  } else {
    findings.push(`AI Visibility Score: ${ai.visibilityScore}% (target >30%).`);
    if (ai.visibilityScore < 30) {
      flags.push({
        code: "LOW_AI_VISIBILITY",
        message: `AI Visibility Score (${ai.visibilityScore}%) is below the >30% target threshold.`,
        severity: "warning",
        section: "Slide 8",
      });
    }
  }

  if (ai.brandSentiment !== undefined) {
    findings.push(`AI Brand Sentiment: ${ai.brandSentiment}/100 (50 = factual/neutral).`);
  }
  if (ai.shareOfVoice !== undefined) {
    findings.push(`AI Share of Voice: ${ai.shareOfVoice}%.`);
  }

  return { flags, findings, reconciledTotalKeywords: reconciledTotal };
}

export function validateSeoBaselineDraft(
  draft: SeoBaselineDraft,
): ValidationOutcome<SeoBaselineDraft> {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (countSentences(draft.compSetTakeaway) > 2) {
    feedback.push("compSetTakeaway must be 2 sentences MAX (Slide 7 rule).");
  }
  if (!draft.compSetTakeaway || draft.compSetTakeaway.length < 15) {
    feedback.push("compSetTakeaway must be a meaningful 1-2 sentence strategic takeaway.");
  }

  const allText = Object.values(draft).join("\n");
  for (const pattern of FORBIDDEN_PLACEHOLDERS) {
    if (pattern.test(allText)) {
      feedback.push(`Draft contains forbidden template placeholder text matching ${pattern.source}.`);
      flags.push({
        code: "PLACEHOLDER_TEXT",
        message: `Forbidden placeholder text detected (${pattern.source}).`,
        severity: "error",
      });
    }
  }

  if (feedback.length > 0) {
    return { valid: false, flags, feedback };
  }

  return {
    valid: true,
    flags,
    normalized: draft,
  };
}

