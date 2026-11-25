/**
 * Issue Triage (Phase 4, step 2)
 *
 * Categorizes audit issues and synthesized mutations by operational risk so the
 * approval gate can route them correctly:
 *
 *   Low    — missing alt text, missing meta descriptions, missing basic JSON-LD.
 *   Medium — title tag edits, H1 changes, non-destructive internal links.
 *   High   — canonical changes, 301 redirects, main body copy edits.
 */

import type { AuditIssue } from "../rules/types.ts";
import type { FixPatch, PatchMutation } from "../ai/types.ts";
import type { IssueTriage, PatchTriage, RiskTier } from "./types.ts";

const RISK_ORDER: RiskTier[] = ["low", "medium", "high"];

/** Roadmap-aligned risk tier for a CMS field. Unknown fields are high risk. */
export const FIELD_TRIAGE_RISK: Record<string, RiskTier> = {
  image_alt_text: "low",
  meta_description: "low",
  og_title: "low",
  og_description: "low",
  og_image: "low",
  twitter_card: "low",
  viewport_meta: "low",
  link_rel: "low",
  image_dimensions: "low",
  heading_text: "low",
  json_ld_schema: "low",
  title: "medium",
  h1: "medium",
  heading_structure: "medium",
  internal_link_url: "medium",
  image_url: "medium",
  canonical_url: "high",
  meta_robots: "high",
  body_content: "high",
};

/** Severity-based fallback risk when an issue has no CMS field target. */
const CATEGORY_FALLBACK_RISK: Record<string, RiskTier> = {
  accessibility: "low",
  media: "medium",
  metadata: "medium",
  content: "high",
  technical: "high",
  schema: "low",
  hospitality: "medium",
};

export function riskTierForField(field: string | null): RiskTier {
  if (!field) {
    return "high";
  }
  return FIELD_TRIAGE_RISK[field] ?? "high";
}

/** Higher of two risk tiers. */
export function maxRisk(a: RiskTier, b: RiskTier): RiskTier {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

export function isRiskWithin(risk: RiskTier, ceiling: RiskTier): boolean {
  return RISK_ORDER.indexOf(risk) <= RISK_ORDER.indexOf(ceiling);
}

/** Classify a single audit issue. */
export function triageIssue(issue: AuditIssue): IssueTriage {
  const risk: RiskTier = !issue.fixable
    ? "high"
    : issue.cmsTargetField
      ? riskTierForField(issue.cmsTargetField)
      : CATEGORY_FALLBACK_RISK[issue.category] ?? "high";
  return {
    issueId: issue.issueId,
    category: issue.category,
    risk,
    autoApplicable: issue.fixable && risk === "low",
  };
}

export function triageIssues(issues: AuditIssue[]): IssueTriage[] {
  return issues.map(triageIssue);
}

/**
 * Triage a synthesized patch. Each mutation's tier is the most conservative of
 * the roadmap field tier and the risk the AI layer assigned.
 */
export function triagePatch(patch: FixPatch, issues: AuditIssue[] = []): PatchTriage {
  const mutations = patch.mutations.map((mutation: PatchMutation) => {
    const fieldRisk = riskTierForField(mutation.field);
    const assigned = mutation.risk as RiskTier;
    const risk = maxRisk(fieldRisk, assigned);
    return { field: mutation.field, risk, action: mutation.action };
  });

  const deployable = mutations.filter((mutation) => mutation.action !== "manual_review");
  const overallRisk = mutations.reduce<RiskTier>(
    (acc, mutation) => maxRisk(acc, mutation.risk),
    "low"
  );

  const autoDeployable =
    deployable.length > 0 && deployable.every((mutation) => mutation.risk === "low");

  return {
    mutations,
    overallRisk,
    autoDeployable,
    requiresApproval: !autoDeployable,
    issues: triageIssues(issues),
  };
}
