/**
 * Visibility gap → reviewable patch plans.
 *
 * These plans are proposals only. They enter the same operator-gated `healing/`
 * workflow as audit fixes: `status: "pending_approval"`, no automatic apply,
 * and no mutation is generated until an operator approves.
 */

import type { GapReport, VisibilityGap } from "../src/core/visibility/types.ts";

export type GapPlanStatus = "pending_approval" | "approved" | "rejected";

export interface GapPatchChange {
  target: "structured_data" | "content" | "entity" | "citations" | "technical";
  field: string;
  action: string;
  evidence: string;
}

export interface GapPatchPlan {
  planId: string;
  source: "visibility_gap";
  createdAt: string;
  status: GapPlanStatus;
  brand: string;
  targetUrl: string;
  promptId: string;
  prompt: string;
  severity: VisibilityGap["severity"];
  evidence: {
    providersAbsent: string[];
    competitorCitations: string[];
    ownCitations: number;
  };
  proposedChanges: GapPatchChange[];
  approval: {
    required: true;
    approvedBy: string | null;
    approvedAt: string | null;
  };
  autoApply: false;
}

function hash(value: string): string {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result << 5) - result + value.charCodeAt(i);
    result |= 0;
  }
  return Math.abs(result).toString(36);
}

function changesFor(gap: VisibilityGap): GapPatchChange[] {
  const evidence = `Absent from ${gap.providersWithAnswer.join(", ") || "available providers"} when asked: “${gap.prompt}”.`;
  if (gap.branded) {
    return [
      {
        target: "structured_data",
        field: "Organization / Hotel JSON-LD",
        action: "Add name, url, logo, sameAs and NAP to the entity schema.",
        evidence,
      },
      {
        target: "entity",
        field: "About / entity page",
        action: "Publish a canonical brand description and align it across the site, Google Business Profile and Wikidata.",
        evidence,
      },
    ];
  }
  if (gap.intent === "local") {
    return [
      {
        target: "content",
        field: "Location page",
        action: "Add address, map, hours and a 40–60 word direct answer block for this buyer question.",
        evidence,
      },
      {
        target: "structured_data",
        field: "LocalBusiness / Hotel / FAQPage JSON-LD",
        action: "Mark up the location and question/answer content.",
        evidence,
      },
    ];
  }
  if (gap.intent === "comparison") {
    return [
      {
        target: "content",
        field: "Comparison / alternatives page",
        action: "Cover the options buyers ask about, with verifiable differentiators and cited evidence.",
        evidence,
      },
    ];
  }
  return [
    {
      target: "content",
      field: "Question-led section",
      action: "Add an H2 phrased as the buyer question with a concise sourced answer.",
      evidence,
    },
    {
      target: "citations",
      field: "Source-backed facts",
      action: "Add statistics or quotations with links to their sources; do not invent figures.",
      evidence,
    },
  ];
}

export function buildGapPatchPlans(report: GapReport, now = new Date().toISOString()): GapPatchPlan[] {
  return report.gaps.map((gap) => ({
    planId: `gap_${hash(`${report.targetUrl}|${gap.promptId}|${now}`)}`,
    source: "visibility_gap",
    createdAt: now,
    status: "pending_approval",
    brand: report.brand,
    targetUrl: report.targetUrl,
    promptId: gap.promptId,
    prompt: gap.prompt,
    severity: gap.severity,
    evidence: {
      providersAbsent: gap.providersAbsent,
      competitorCitations: gap.competitorCitations,
      ownCitations: gap.ownCitations,
    },
    proposedChanges: changesFor(gap),
    approval: { required: true, approvedBy: null, approvedAt: null },
    autoApply: false,
  }));
}
