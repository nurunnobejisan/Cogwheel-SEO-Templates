/**
 * Fix Patch Schema (Phase 2)
 *
 * Strict contract for the machine-applicable patch the AI Brain emits. The
 * backend validation layer rejects anything that is not an exact match — notably
 * freeform text — matching the roadmap's "strict JSON patch validation" step.
 */

import { z } from "zod";
import type { FixPatch } from "../types.ts";

/** CMS fields the auto-fix engine is allowed to target. */
export const ALLOWED_CMS_FIELDS = [
  "title",
  "meta_description",
  "h1",
  "heading_text",
  "heading_structure",
  "image_alt_text",
  "image_url",
  "image_dimensions",
  "canonical_url",
  "meta_robots",
  "viewport_meta",
  "internal_link_url",
  "link_rel",
  "og_title",
  "og_description",
  "og_image",
  "twitter_card",
  "json_ld_schema",
  "body_content",
] as const;

export type CmsField = (typeof ALLOWED_CMS_FIELDS)[number];

export const MUTATION_ACTIONS = ["replace", "inject", "remove", "manual_review"] as const;
export const PATCH_RISKS = ["low", "medium", "high"] as const;

const valueSchema = z.union([z.string(), z.record(z.unknown()), z.null()]);

export const PatchMutationSchema = z
  .object({
    field: z.string().min(1),
    action: z.enum(MUTATION_ACTIONS),
    before: valueSchema,
    after: valueSchema,
    risk: z.enum(PATCH_RISKS),
    autoApply: z.boolean(),
  })
  .strict();

export const FixPatchSchema = z
  .object({
    patchId: z.string().min(1),
    auditId: z.string().min(1),
    targetUrl: z.string().min(1),
    mode: z.enum(["universal", "hotel"]),
    createdAt: z.string().min(1),
    mutations: z.array(PatchMutationSchema),
  })
  .strict();

export function isAllowedCmsField(field: string): field is CmsField {
  return (ALLOWED_CMS_FIELDS as readonly string[]).includes(field);
}

export function parseFixPatch(data: unknown): FixPatch {
  return FixPatchSchema.parse(data) as FixPatch;
}

export function isValidFixPatch(data: unknown): boolean {
  return FixPatchSchema.safeParse(data).success;
}
