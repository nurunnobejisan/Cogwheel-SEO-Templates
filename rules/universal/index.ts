/**
 * Universal Mode — Rule Registry
 *
 * General technical, semantic, indexability, structural and performance
 * evaluation modules applied to any web property.
 */

import type { AuditIssue, AuditRule, RuleContext } from "../types.ts";
import { METADATA_RULES } from "./metadata.ts";
import { CONTENT_RULES } from "./content.ts";
import { MEDIA_RULES } from "./media.ts";
import { TECHNICAL_RULES } from "./technical.ts";

export * from "./metadata.ts";
export * from "./content.ts";
export * from "./media.ts";
export * from "./technical.ts";

export const UNIVERSAL_RULES: AuditRule[] = [
  ...METADATA_RULES,
  ...CONTENT_RULES,
  ...MEDIA_RULES,
  ...TECHNICAL_RULES,
];

/** Execute every universal rule against the snapshot and flatten the results. */
export function runUniversalRules(ctx: RuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const rule of UNIVERSAL_RULES) {
    for (const issue of rule.evaluate(ctx)) {
      issues.push(issue);
    }
  }
  return issues;
}
