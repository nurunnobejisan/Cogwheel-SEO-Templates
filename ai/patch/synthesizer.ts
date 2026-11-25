/**
 * Deterministic Fix Synthesizer (Phase 2)
 *
 * Produces a machine-applicable mutation for an issue without calling an LLM.
 * It is the offline/fallback path that guarantees the phase-2 pipeline still
 * emits valid patches when no provider credential is configured (CI, air-gapped
 * backends, rate-limited APIs). The LLM path in ai/orchestrator.ts uses this as
 * its fallback for any issue a model cannot resolve.
 */

import type { AuditIssue, AuditReport, JsonLdNode } from "../../rules/types.ts";
import type { MutationAction, PatchMutation } from "../types.ts";
import { META_DESCRIPTION_MAX_CHARS, riskForField, TITLE_MAX_CHARS } from "./validator.ts";

export interface SynthesizeInput {
  issue: AuditIssue;
  report: Pick<AuditReport, "pageUrl" | "domain" | "mode">;
  /** Optional page facts for grounding generated values. */
  pageContext?: PageContext;
}

export interface PageContext {
  title?: string | null;
  h1?: string | null;
  metaDescription?: string | null;
  textContent?: string | null;
  images?: { src: string; alt?: string | null }[];
  jsonLd?: JsonLdNode[];
  brand?: string | null;
}

/**
 * Produce a mutation for an issue. Returns null when the issue cannot be
 * safely auto-synthesized (the caller defers it for human review).
 */
export function synthesizeMutation(input: SynthesizeInput): PatchMutation | null {
  const { issue, report, pageContext = {} } = input;
  const field = issue.cmsTargetField;

  if (!issue.fixable || !field) {
    return null;
  }

  const risk = riskForField(field);
  const base = { field, before: issue.context.currentValue, risk } as const;

  switch (issue.issueId) {
    case "iss_title_missing":
    case "iss_title_too_short":
    case "iss_title_too_long": {
      const after = buildTitle(pageContext, report);
      return withAutoApply({ ...base, action: "replace", after: truncate(after, TITLE_MAX_CHARS) }, "replace");
    }
    case "iss_meta_desc_missing":
    case "iss_meta_desc_too_short":
    case "iss_meta_desc_too_long": {
      const after = buildMetaDescription(pageContext, report);
      return withAutoApply(
        { ...base, action: "replace", after: truncate(after, META_DESCRIPTION_MAX_CHARS) },
        "replace"
      );
    }
    case "iss_h1_missing":
    case "iss_h1_multiple": {
      const after = pageContext.h1?.trim() || pageContext.title?.trim() || buildTitle(pageContext, report);
      return withAutoApply({ ...base, action: issue.issueId === "iss_h1_missing" ? "inject" : "replace", after }, issue.issueId === "iss_h1_missing" ? "inject" : "replace");
    }
    case "iss_heading_empty":
      return manualReview(base, "Empty heading requires editorial copy that cannot be auto-derived.");
    case "iss_canonical_missing":
      return withAutoApply({ ...base, action: "inject", after: report.pageUrl }, "inject");
    case "iss_canonical_mismatch":
      return withAutoApply({ ...base, action: "replace", after: report.pageUrl }, "replace");
    case "iss_viewport_missing":
      return withAutoApply(
        { ...base, action: "inject", after: "width=device-width, initial-scale=1" },
        "inject"
      );
    case "iss_og_title_missing":
      return withAutoApply(
        { ...base, action: "inject", after: truncate(buildTitle(pageContext, report), TITLE_MAX_CHARS) },
        "inject"
      );
    case "iss_og_description_missing":
      return withAutoApply(
        { ...base, action: "inject", after: truncate(buildMetaDescription(pageContext, report), META_DESCRIPTION_MAX_CHARS) },
        "inject"
      );
    case "iss_og_image_missing": {
      const image = pageContext.images?.find((entry) => entry.src)?.src;
      if (!image) {
        return manualReview(base, "No on-page image is available to reuse as the social preview.");
      }
      return withAutoApply({ ...base, action: "inject", after: absoluteUrl(image, report.pageUrl) }, "inject");
    }
    case "iss_twitter_card_missing":
      return withAutoApply({ ...base, action: "inject", after: "summary_large_image" }, "inject");
    case "iss_noindex":
      return manualReview(base, "Indexability change is high-risk and always requires human approval.");
    case "iss_img_alt_missing": {
      const after = buildAltText(issue, pageContext);
      if (!after) {
        return manualReview(base, "Could not derive meaningful alt text without image understanding.");
      }
      return withAutoApply({ ...base, action: "replace", after }, "replace");
    }
    case "iss_hotel_schema_missing":
    case "iss_structured_data_missing":
      return withAutoApply(
        { ...base, action: "inject", after: buildStructuredData(report, pageContext) },
        "inject"
      );
    case "iss_hotel_schema_property_missing":
    case "iss_hotel_schema_property_recommended_missing":
      return manualReview(base, "Enriching an existing schema node requires business facts that must be reviewed.");
    case "iss_broken_internal_link":
    case "iss_redirect_chain":
      return manualReview(base, "Link replacement needs a verified destination and a redirect decision.");
    case "iss_external_link_rel":
      return withAutoApply({ ...base, action: "replace", after: "noopener noreferrer" }, "replace");
    case "iss_img_legacy_format":
    case "iss_img_oversized":
    case "iss_img_missing_dimensions":
      return manualReview(base, "Asset transformation must run through the media pipeline, not a CMS field write.");
    case "iss_thin_content":
    case "iss_readability_low":
    case "iss_keyword_stuffing":
      return manualReview(base, "Body-copy remediation is high-risk and requires editorial authoring.");
    case "iss_heading_hierarchy_skip":
    case "iss_heading_structure":
      return manualReview(base, "Heading restructure affects the rendered document outline and needs review.");
    default:
      return manualReview(base, "No deterministic generator is registered for this issue.");
  }
}

type BaseMutation = {
  field: string;
  before: PatchMutation["before"];
  risk: PatchMutation["risk"];
};

function withAutoApply(
  mutation: BaseMutation & { action: MutationAction; after: PatchMutation["after"] },
  action: MutationAction
): PatchMutation {
  return {
    field: mutation.field,
    action,
    before: mutation.before,
    after: mutation.after,
    risk: mutation.risk,
    autoApply: false, // the orchestrator applies the auto-pilot gate
  };
}

function manualReview(base: BaseMutation, _reason: string): PatchMutation {
  return { field: base.field, action: "manual_review", before: base.before, after: null, risk: base.risk, autoApply: false };
}

function buildTitle(context: PageContext, report: Pick<AuditReport, "domain">): string {
  const brand = context.brand || prettifyDomain(report.domain);
  const topic = context.h1?.trim() || context.title?.trim() || brand;
  if (topic.toLowerCase().includes(brand.toLowerCase())) {
    return topic;
  }
  return `${topic} | ${brand}`;
}

function buildMetaDescription(context: PageContext, report: Pick<AuditReport, "domain">): string {
  const source = (context.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, META_DESCRIPTION_MAX_CHARS - 30);
  if (source.length > 40) {
    return `${source.replace(/[.,;:\s]+$/, "")}. Learn more at ${report.domain}.`;
  }
  const brand = context.brand || prettifyDomain(report.domain);
  return `Discover ${brand}. Explore our services, key details and everything you need in one place — visit us today.`;
}

function buildAltText(issue: AuditIssue, context: PageContext): string | null {
  const src = issue.context.imageSrc;
  if (!src) {
    return null;
  }
  const filename = src.split("/").pop()?.split(/[?#]/)[0] ?? "";
  const words = filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(\d{2,}|[0-9a-f]{8,})\b/gi, " ")
    .replace(/\b(img|image|photo|dsc|screenshot|final|copy)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (words.length >= 3) {
    const page = context.h1?.trim() || context.title?.trim() || context.brand || "";
    return page ? `${capitalize(words)} — ${page}` : capitalize(words);
  }
  return null;
}

function buildStructuredData(
  report: Pick<AuditReport, "pageUrl" | "domain" | "mode">,
  context: PageContext
): Record<string, unknown> {
  const name = context.h1?.trim() || context.title?.trim() || prettifyDomain(report.domain);
  if (report.mode === "hotel") {
    return {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      name,
      url: report.pageUrl,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: report.pageUrl,
  };
}

function absoluteUrl(value: string, pageUrl: string): string {
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return value;
  }
}

function prettifyDomain(domain: string): string {
  const core = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  return capitalize(core.replace(/[-_]+/g, " "));
}

function capitalize(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  const clipped = value.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trim();
}
