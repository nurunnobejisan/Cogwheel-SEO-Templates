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

type BaseMutation = {
  field: string;
  before: PatchMutation["before"];
  risk: PatchMutation["risk"];
};

function mutation(
  base: BaseMutation,
  action: MutationAction,
  after: PatchMutation["after"]
): PatchMutation {
  return { field: base.field, action, before: base.before, after, risk: base.risk, autoApply: false };
}

function review(base: BaseMutation): PatchMutation {
  return mutation(base, "manual_review", null);
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

  const base: BaseMutation = {
    field,
    before: normalizeValue(issue.context.currentValue),
    risk: riskForField(field),
  };

  switch (issue.issueId) {
    case "iss_title_missing":
    case "iss_title_too_short":
    case "iss_title_too_long":
      return mutation(base, "replace", truncate(buildTitle(pageContext, report), TITLE_MAX_CHARS));

    case "iss_meta_desc_missing":
    case "iss_meta_desc_too_short":
    case "iss_meta_desc_too_long":
      return mutation(
        base,
        "replace",
        truncate(buildMetaDescription(pageContext, report), META_DESCRIPTION_MAX_CHARS)
      );

    case "iss_h1_missing":
      return mutation(
        base,
        "inject",
        pageContext.h1?.trim() || pageContext.title?.trim() || buildTitle(pageContext, report)
      );

    case "iss_h1_multiple":
      return mutation(
        base,
        "replace",
        pageContext.h1?.trim() || pageContext.title?.trim() || buildTitle(pageContext, report)
      );

    case "iss_heading_empty":
      return review(base);

    case "iss_canonical_missing":
      return mutation(base, "inject", report.pageUrl);

    case "iss_canonical_mismatch":
      return mutation(base, "replace", report.pageUrl);

    case "iss_viewport_missing":
      return mutation(base, "inject", "width=device-width, initial-scale=1");

    case "iss_og_title_missing":
      return mutation(base, "inject", truncate(buildTitle(pageContext, report), TITLE_MAX_CHARS));

    case "iss_og_description_missing":
      return mutation(
        base,
        "inject",
        truncate(buildMetaDescription(pageContext, report), META_DESCRIPTION_MAX_CHARS)
      );

    case "iss_og_image_missing": {
      const image = pageContext.images?.find((entry) => entry.src)?.src;
      if (!image) {
        return review(base);
      }
      return mutation(base, "inject", absoluteUrl(image, report.pageUrl));
    }

    case "iss_twitter_card_missing":
      return mutation(base, "inject", "summary_large_image");

    case "iss_noindex":
      return review(base);

    case "iss_img_alt_missing": {
      const after = buildAltText(issue, pageContext);
      return after ? mutation(base, "replace", after) : review(base);
    }

    case "iss_hotel_schema_missing":
    case "iss_structured_data_missing":
      return mutation(base, "inject", buildStructuredData(report, pageContext));

    case "iss_hotel_schema_property_missing":
    case "iss_hotel_schema_property_recommended_missing":
    case "iss_broken_internal_link":
    case "iss_redirect_chain":
    case "iss_img_legacy_format":
    case "iss_img_oversized":
    case "iss_img_missing_dimensions":
    case "iss_thin_content":
    case "iss_readability_low":
    case "iss_keyword_stuffing":
    case "iss_heading_hierarchy_skip":
    case "iss_heading_structure":
      return review(base);

    case "iss_external_link_rel":
      return mutation(base, "replace", "noopener noreferrer");

    default:
      return review(base);
  }
}

function normalizeValue(
  value: string | number | boolean | Record<string, unknown> | null
): PatchMutation["before"] {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "object") {
    return value;
  }
  return String(value);
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
