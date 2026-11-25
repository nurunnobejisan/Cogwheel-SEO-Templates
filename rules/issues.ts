/**
 * Cogwheel Universal SEO Engine — Issue Factory & Scoring
 */

import type {
  AuditIssue,
  AuditSummary,
  IssueCategory,
  IssueSeverity,
} from "./types.ts";

export interface IssueInput {
  issueId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  /** Defaults to true — most roadmap issues are CMS-patchable. */
  fixable?: boolean;
  cmsTargetField?: string | null;
  currentValue?: string | number | boolean | null;
  selector: string;
  imageSrc?: string;
  recommendedAction: string;
}

/** Build a normalized issue, applying safe defaults for CMS patches. */
export function makeIssue(input: IssueInput): AuditIssue {
  const issue: AuditIssue = {
    issueId: input.issueId,
    category: input.category,
    severity: input.severity,
    fixable: input.fixable ?? true,
    cmsTargetField: input.cmsTargetField ?? null,
    context: {
      currentValue: input.currentValue ?? null,
      selector: input.selector,
      recommendedAction: input.recommendedAction,
    },
  };
  if (input.imageSrc !== undefined) {
    issue.context.imageSrc = input.imageSrc;
  }
  return issue;
}

export const SEVERITY_WEIGHTS: Record<IssueSeverity, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 3,
  info: 1,
};

const SEVERITY_ORDER: IssueSeverity[] = ["critical", "high", "medium", "low", "info"];

/** Roll a flat issue list into a deterministic summary + 0..100 score. */
export function summarizeIssues(issues: AuditIssue[]): AuditSummary {
  const bySeverity: Record<IssueSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const byCategory: Partial<Record<IssueCategory, number>> = {};

  let penalty = 0;
  for (const issue of issues) {
    bySeverity[issue.severity] += 1;
    byCategory[issue.category] = (byCategory[issue.category] ?? 0) + 1;
    penalty += SEVERITY_WEIGHTS[issue.severity];
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    totalIssues: issues.length,
    bySeverity,
    byCategory,
    score,
  };
}

/** Sort issues by descending severity so consumers see the worst first. */
export function sortIssuesBySeverity(issues: AuditIssue[]): AuditIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
}
