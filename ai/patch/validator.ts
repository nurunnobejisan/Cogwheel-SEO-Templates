/**
 * Strict JSON Patch Validation (Phase 2)
 *
 * The backend validation layer from the roadmap. Every patch the AI Brain
 * produces — LLM-generated or deterministically synthesized — passes through
 * here before it can reach the CMS gateway (Phase 3).
 *
 * Beyond schema conformance it enforces the semantic rules the roadmap calls
 * out: no freeform prose, allowed CMS fields, action/value consistency, and
 * SERP length budgets.
 */

import type { AuditIssue, AuditReport } from "../../rules/types.ts";
import type {
  FixPatch,
  MutationAction,
  PatchMutation,
  PatchRisk,
  PatchValidationResult,
} from "../types.ts";
import { ALLOWED_CMS_FIELDS, isAllowedCmsField, parseFixPatch } from "./schema.ts";

export const TITLE_MAX_CHARS = 60;
export const META_DESCRIPTION_MAX_CHARS = 160;

/** Operational risk assigned to each CMS field when a mutation touches it. */
export const FIELD_RISK: Record<string, PatchRisk> = {
  title: "low",
  meta_description: "low",
  h1: "medium",
  heading_text: "low",
  heading_structure: "medium",
  image_alt_text: "low",
  image_url: "medium",
  image_dimensions: "low",
  canonical_url: "medium",
  meta_robots: "high",
  viewport_meta: "low",
  internal_link_url: "medium",
  link_rel: "low",
  og_title: "low",
  og_description: "low",
  og_image: "low",
  twitter_card: "low",
  json_ld_schema: "medium",
  body_content: "high",
};

/** Fields whose content must satisfy the SERP budgets. */
const LENGTH_BUDGETS: Record<string, number> = {
  title: TITLE_MAX_CHARS,
  og_title: TITLE_MAX_CHARS,
  meta_description: META_DESCRIPTION_MAX_CHARS,
  og_description: META_DESCRIPTION_MAX_CHARS,
};

export interface ValidatePatchOptions {
  /** Report the patch was generated against, used for cross-checks. */
  report?: Pick<AuditReport, "auditId">;
  /** Reject mutations that exceed a risk tier (default: allow all). */
  maxRisk?: PatchRisk;
}

const RISK_ORDER: PatchRisk[] = ["low", "medium", "high"];

/**
 * Validate a single mutation. Returns human-readable error strings; an empty
 * array means the mutation is safe to apply.
 */
export function validateMutation(mutation: PatchMutation): string[] {
  const errors: string[] = [];

  if (!isAllowedCmsField(mutation.field)) {
    errors.push(
      `field "${mutation.field}" is not an allowed CMS target (allowed: ${ALLOWED_CMS_FIELDS.join(", ")})`
    );
  }

  if (mutation.risk !== FIELD_RISK[mutation.field] && mutation.field in FIELD_RISK) {
    errors.push(
      `risk "${mutation.risk}" does not match the operational tier "${FIELD_RISK[mutation.field]}" for field "${mutation.field}"`
    );
  }

  if ((mutation.action === "replace" || mutation.action === "inject") && isEmptyValue(mutation.after)) {
    errors.push(`action "${mutation.action}" requires a non-empty "after" value`);
  }

  if (mutation.action === "remove" && !isEmptyValue(mutation.after)) {
    errors.push('action "remove" must set "after" to null');
  }

  if (mutation.action === "manual_review" && !isEmptyValue(mutation.after)) {
    errors.push('action "manual_review" must set "after" to null');
  }

  if (mutation.action === "manual_review" && mutation.autoApply) {
    errors.push('action "manual_review" can never be auto-applied');
  }

  // No freeform prose in string values: reject markdown/prose dumps.
  for (const [label, value] of [
    ["before", mutation.before],
    ["after", mutation.after],
  ] as const) {
    if (typeof value === "string" && looksLikeFreeformProse(value)) {
      errors.push(`${label} value looks like freeform prose; only the target value is allowed`);
    }
  }

  const budget = LENGTH_BUDGETS[mutation.field];
  if (budget && typeof mutation.after === "string" && mutation.after.length > budget) {
    errors.push(`${mutation.field} is ${mutation.after.length} chars; the SERP budget is ${budget}`);
  }

  return errors;
}

/** Validate a whole patch: schema conformance + every mutation + cross-checks. */
export function validateFixPatch(
  data: unknown,
  options: ValidatePatchOptions = {}
): PatchValidationResult {
  const parsed = parseFixPatchSafe(data);
  if (!parsed.patch) {
    return { valid: false, errors: parsed.errors };
  }

  const errors: string[] = [...parsed.errors];

  if (options.report && parsed.patch.auditId !== options.report.auditId) {
    errors.push(
      `patch.auditId "${parsed.patch.auditId}" does not match the audit report "${options.report.auditId}"`
    );
  }

  if (options.maxRisk) {
    const ceiling = RISK_ORDER.indexOf(options.maxRisk);
    for (const mutation of parsed.patch.mutations) {
      if (RISK_ORDER.indexOf(mutation.risk) > ceiling) {
        errors.push(
          `mutation on "${mutation.field}" has risk "${mutation.risk}" above the allowed ceiling "${options.maxRisk}"`
        );
      }
    }
  }

  for (const [index, mutation] of parsed.patch.mutations.entries()) {
    for (const error of validateMutation(mutation)) {
      errors.push(`mutations[${index}]: ${error}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [], patch: parsed.patch };
}

/**
 * Guardrail for the LLM boundary: reject anything that is not a single JSON
 * object (prose, markdown fences, trailing commentary).
 */
export function assertJsonOnly(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("model returned an empty response");
  }
  if (trimmed.startsWith("```") || trimmed.endsWith("```")) {
    throw new Error("model returned a fenced code block instead of raw JSON");
  }
  if (!trimmed.startsWith("{")) {
    throw new Error("model returned non-JSON output (freeform text is rejected)");
  }
  return trimmed;
}

function parseFixPatchSafe(data: unknown): { patch?: FixPatch; errors: string[] } {
  try {
    return { patch: parseFixPatch(data), errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errors: [`patch failed schema validation: ${message}`] };
  }
}

function isEmptyValue(value: PatchMutation["before"]): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function looksLikeFreeformProse(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("<")) {
    return false;
  }
  if (trimmed.includes("\n") && trimmed.split("\n").length > 6) {
    return true;
  }
  return /\b(as an AI|here (is|are)|I (have|will)|certainly|sure,|let me)\b/i.test(trimmed);
}

/** Risk tier for a CMS field, defaulting to "high" for anything unmapped. */
export function riskForField(field: string): PatchRisk {
  return FIELD_RISK[field] ?? "high";
}

/** Whether the auto-pilot gate may deploy this mutation without human review. */
export function isAutoApplyEligible(
  mutation: Pick<PatchMutation, "risk" | "action">,
  autoPilot: boolean
): boolean {
  if (!autoPilot) {
    return false;
  }
  return mutation.risk === "low" && mutation.action !== "manual_review";
}

/** How many mutations a patch will deploy automatically vs. queue for review. */
export function summarizePatchDeployment(patch: FixPatch): {
  autoApply: number;
  manualReview: number;
} {
  let autoApply = 0;
  let manualReview = 0;
  for (const mutation of patch.mutations) {
    if (mutation.autoApply) {
      autoApply += 1;
    } else {
      manualReview += 1;
    }
  }
  return { autoApply, manualReview };
}
