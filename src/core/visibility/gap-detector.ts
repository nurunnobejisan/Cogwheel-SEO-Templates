/**
 * Gap detector — prompts where the brand is absent.
 *
 * A prompt is a gap only when at least one provider actually answered and none
 * of those answers mentioned the brand. Prompts where every provider was
 * unavailable are reported separately as unmeasured, never as gaps.
 */

import type { GapReport, PromptResult, VisibilityGap, VisibilityRun } from "./types.ts";

export function detectGaps(run: VisibilityRun): GapReport {
  const promptIds = [...new Set(run.results.map((result) => result.promptId))];
  const gaps: VisibilityGap[] = [];
  const unmeasuredPrompts: GapReport["unmeasuredPrompts"] = [];

  for (const promptId of promptIds) {
    const rows = run.results.filter((result) => result.promptId === promptId);
    const answered = rows.filter((row) => row.available);
    const sample = rows[0];
    if (!sample) continue;

    if (answered.length === 0) {
      unmeasuredPrompts.push({
        promptId,
        prompt: sample.prompt,
        reasons: [...new Set(rows.map((row) => row.reason).filter((reason): reason is string => Boolean(reason)))],
      });
      continue;
    }

    if (answered.some((row) => row.mentioned === true)) continue;

    const competitorCitations = [
      ...new Set(
        answered.flatMap((row) =>
          row.citations.filter((citation) => citation.source === "competitor").map((citation) => citation.domain)
        )
      ),
    ];
    const ownCitations = answered.reduce((sum, row) => sum + (row.ownCitations ?? 0), 0);
    gaps.push({
      promptId,
      prompt: sample.prompt,
      intent: sample.intent,
      branded: sample.branded,
      severity: severityFor(sample, competitorCitations.length),
      providersWithAnswer: answered.map((row) => row.provider),
      providersAbsent: answered.filter((row) => row.mentioned === false).map((row) => row.provider),
      competitorCitations,
      ownCitations,
      rationale: rationaleFor(sample.prompt, sample.branded, answered.length, competitorCitations),
      recommendedActions: actionsFor(sample.intent, sample.branded, competitorCitations.length > 0),
    });
  }

  gaps.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const measuredPrompts = promptIds.length - unmeasuredPrompts.length;
  return {
    targetUrl: run.targetUrl,
    brand: run.brand,
    measuredAt: run.finishedAt,
    measuredPrompts,
    mentionRate: measuredPrompts > 0 ? Number(((measuredPrompts - gaps.length) / measuredPrompts).toFixed(4)) : null,
    gaps,
    unmeasuredPrompts,
  };
}

function severityFor(sample: PromptResult, competitorCitations: number): VisibilityGap["severity"] {
  if (sample.branded) return "critical";
  if (competitorCitations > 0) return "high";
  if (sample.intent === "local" || sample.intent === "comparison") return "high";
  return "medium";
}

function severityRank(severity: VisibilityGap["severity"]): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
}

function rationaleFor(prompt: string, branded: boolean, providerCount: number, competitorCitations: string[]): string {
  const who = `${providerCount} provider${providerCount === 1 ? "" : "s"}`;
  if (branded) {
    return `The brand was absent from ${who} when asked directly (“${prompt}”). That points to an entity-recognition or corroboration gap, not just a content gap.`;
  }
  if (competitorCitations.length > 0) {
    return `The brand was absent from ${who} while ${competitorCitations.slice(0, 3).join(", ")} were cited. The answer set has a citable alternative we are not part of.`;
  }
  return `The brand was absent from ${who} for this buyer prompt. No competitor citation was observed, so the answer set may be built from general sources.`;
}

function actionsFor(intent: PromptResult["intent"], branded: boolean, competitorsCited: boolean): string[] {
  if (branded) {
    return [
      "Add or fix Organization/Hotel schema with name, url, logo, sameAs and NAP.",
      "Align brand name, address and description across the site, Google Business Profile and Wikidata.",
      "Publish an About/entity page that third parties can cite; seek legitimate third-party corroboration (no paid placement claims).",
    ];
  }
  if (intent === "local") {
    return [
      "Create or strengthen a location page with address, map, hours, and 40–60 word answer blocks.",
      "Add LocalBusiness/Hotel/FAQPage JSON-LD to the location page.",
      "Cite local sources (tourism boards, transit, local press) that answer engines already trust.",
    ];
  }
  if (intent === "comparison") {
    return [
      "Publish a factual comparison or alternatives page covering the options buyers ask about.",
      "Add differentiators with cited evidence (statistics, quotations, first-party data).",
      "Keep claims verifiable and dated; never invent rankings or review counts.",
    ];
  }
  return [
    "Add a question-led H2 with a concise 40–60 word answer, then supporting detail.",
    "Include cited statistics or quotations with source links.",
    competitorsCited
      ? "Review the sources currently cited and earn legitimate coverage there; do not fabricate placements."
      : "Add source-backed facts that make the page quotable by answer engines.",
  ];
}
