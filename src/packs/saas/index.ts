/**
 * SaaS & Software pack — product-led software vertical (docs/PACKS.md).
 *
 * Covers pricing, docs, integration and comparison scoring for B2B SaaS and
 * developer-tool sites. Assembly notes:
 *   - identity + weights  → src/packs/catalog.ts (authored default weights for
 *                           the "saas" entry; never redefined here)
 *   - checklist           → authored for this vertical (SAAS_CHECKLIST below):
 *                           the audit steps a SaaS SEO actually runs
 *   - schema rules        → ./schema-rules.ts (SoftwareApplication, FAQPage,
 *                           Article, HowTo, Review, BreadcrumbList)
 *   - keyword matrix      → ./keywords.json (the 78-keyword strategy matrix,
 *                           revalidated through zod)
 *   - brand guardrails    → GENERIC_BRAND_GUARDRAILS (no franchise rulebook)
 *   - ai prompts          → none yet (populated by the AI/ops phase)
 *
 * Scoring weights are the authored defaults documented in docs/PACKS.md and
 * delivered by catalog.ts — they are planning values, not measurements.
 * Registration is guarded so a dev-HMR / serverless module re-evaluation does
 * not throw on the duplicate-id check.
 */
import { validateKeywordMatrix } from "../../schemas/validation";
import { getPackMeta } from "../catalog";
import { getPack, registerPack } from "../index";
import { GENERIC_BRAND_GUARDRAILS } from "../generic-guardrails";
import type { Pack, ChecklistItem } from "../types";
import { SAAS_SCHEMA_RULES } from "./schema-rules";
import keywordsJson from "./keywords.json";

/**
 * The pack checklist: real audit steps for a product-led SaaS site, in the
 * order an operator would run them. Ids are prefixed "saas-" so findings from
 * other packs never collide with these.
 */
export const SAAS_CHECKLIST: ChecklistItem[] = [
  {
    id: "saas-softwareapplication-jsonld",
    task: "Ship SoftwareApplication JSON-LD on homepage and product pages",
    description:
      "Every indexable product page publishes a SoftwareApplication node with name, description, url and applicationCategory so software rich results and answer engines can identify the product.",
    priority: "Critical",
  },
  {
    id: "saas-pricing-page-consistency",
    task: "Reconcile pricing page copy with plan markup",
    description:
      "Confirm every plan name, price and billing period in visible copy matches any Offer or SoftwareApplication pricing markup, and that the free tier is stated where the FAQ claims one exists.",
    priority: "Critical",
  },
  {
    id: "saas-docs-indexability",
    task: "Verify docs and API reference pages are indexable",
    description:
      "Check the docs section for accidental noindex directives, orphaned pages missing from the sitemap, and canonical tags pointing at non-documentation URLs that discard the section's signals.",
    priority: "High",
  },
  {
    id: "saas-faq-structured-answers",
    task: "Mark up existing buyer questions with FAQPage",
    description:
      "Wrap the pricing, refund and integration questions already on the site in FAQPage mainEntity pairs so AI engines can cite the answers verbatim instead of paraphrasing competitor copy.",
    priority: "High",
  },
  {
    id: "saas-integration-directory",
    task: "Audit integration directory pages for unique content",
    description:
      "Each integration page should describe what syncs, in which direction, and any limitations — not re-use a boilerplate paragraph with only the partner name swapped in.",
    priority: "High",
  },
  {
    id: "saas-geo-answer-blocks",
    task: "Structure direct-answer blocks for AI engines",
    description:
      "Open use-case and FAQ sections with a concise direct answer that restates the question, so generative engines can lift it without guessing at missing context.",
    priority: "High",
  },
  {
    id: "saas-comparison-cannibalisation",
    task: "Check comparison and alternative pages for overlap",
    description:
      "Map internal links and titles across vs, alternatives and comparison pages so two URLs do not compete for the same commercial query and split their signals.",
    priority: "Medium",
  },
  {
    id: "saas-review-schema-governance",
    task: "Publish Review markup only for genuine reviews",
    description:
      "AggregateRating and Review nodes must reflect real customer feedback collected on-site; strip markup that mirrors third-party ratings without permission or invents a review count.",
    priority: "Medium",
  },
];

function buildSaasPack(): Pack {
  const meta = getPackMeta("saas");
  if (!meta) {
    // catalog.ts always defines it; fail loudly rather than register a husk.
    throw new Error('Pack "saas" is missing from src/packs/catalog.ts');
  }
  // Parsed through the schema so JSON import types cannot drift from the
  // validated KeywordStrategyMatrix shape (source: "illustrative" literal).
  const keywordMatrix = validateKeywordMatrix(keywordsJson);

  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    pageTypes: meta.pageTypes,
    // Authored default weights from the catalog — never hardcoded here.
    scoringWeights: meta.scoringWeights,
    checklist: SAAS_CHECKLIST,
    schemaRules: SAAS_SCHEMA_RULES,
    keywordMatrix,
    brandGuardrails: GENERIC_BRAND_GUARDRAILS,
    aiPrompts: [],
  };
}

export const saasPack: Pack = buildSaasPack();

if (!getPack(saasPack.id)) {
  registerPack(saasPack);
}

export default saasPack;
