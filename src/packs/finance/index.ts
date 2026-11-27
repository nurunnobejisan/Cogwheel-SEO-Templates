/**
 * Finance & Insurance pack — YMYL trust, product disclosure and
 * structured-data scoring for financial sites (docs/PACKS.md).
 *
 * Everything is assembled from sources that already existed; nothing is
 * re-authored elsewhere:
 *   - identity + weights  → src/packs/catalog.ts via getPackMeta("finance");
 *                           the weights are the authored defaults documented
 *                           in docs/PACKS.md, never measured scores
 *   - checklist           → ./index.ts (authored for this vertical)
 *   - schema rules        → ./schema-rules.ts (authored for finance JSON-LD
 *                           types with the disclosure angle spelled out)
 *   - keyword matrix      → ./keywords.json (the 78-keyword dataset,
 *                           revalidated through zod on load)
 *   - brand guardrails    → src/packs/generic-guardrails.ts (shared
 *                           GENERIC_BRAND_GUARDRAILS; no franchise rulebook)
 *   - ai prompts          → none yet (populated by the AI/ops phase)
 *
 * Registration is guarded so a dev-HMR / serverless module re-evaluation
 * does not throw on the duplicate-id check — the registry itself still
 * refuses duplicates for callers that register explicitly.
 */
import { GENERIC_BRAND_GUARDRAILS } from "../generic-guardrails";
import { getPackMeta } from "../catalog";
import { getPack, registerPack } from "../index";
import type { Pack, ChecklistItem } from "../types";
import { validateKeywordMatrix } from "../../schemas/validation";
import { FINANCE_SCHEMA_RULES } from "./schema-rules";
import keywordsJson from "./keywords.json";

/**
 * Audit checklist for the finance vertical. Every item is something an
 * auditor executes against a live YMYL site; the disclosure item is the
 * gate the rest hang off — a site that cannot substantiate its published
 * terms fails the pack regardless of its markup score.
 */
export const FINANCE_CHECKLIST: ChecklistItem[] = [
  {
    id: "finance-disclosure-accuracy",
    task: "Verify published rates, fees and APRs against source documents",
    description:
      "Open every rate table, fee schedule and product card on the page and confirm each figure matches the institution's current published terms, with an effective or last-reviewed date visible next to the claim.",
    priority: "Critical",
  },
  {
    id: "finance-product-schema",
    task: "Complete FinancialProduct / Loan / CreditCard JSON-LD",
    description:
      "Check that product pages carry the required properties (name, provider, amount, APR, loanTerm as applicable) and that any fee or term the markup claims is disclosed on the page itself.",
    priority: "Critical",
  },
  {
    id: "finance-no-outcome-claims",
    task: "Remove unsubstantiated outcome claims from copy",
    description:
      "Scan titles, H1s and body copy for guaranteed-approval, guaranteed-return or superlative language; flag anything the generic guardrails forbid and require a cited source or a softer formulation before re-publishing.",
    priority: "Critical",
  },
  {
    id: "finance-ymlyl-authorship",
    task: "Attach reviewer credentials to money content",
    description:
      "Confirm each advice article names an author and a qualified reviewer with their credentials, plus a visible last-reviewed date that reflects material changes to the terms it describes.",
    priority: "High",
  },
  {
    id: "finance-faq-markup",
    task: "Validate FAQPage markup against current answers",
    description:
      "Ensure FAQ blocks ship Question/mainEntity JSON-LD and that each answer still matches the current fee schedule and eligibility rules — stale answers are treated as a disclosure failure, not a formatting one.",
    priority: "High",
  },
  {
    id: "finance-generative-citation",
    task: "Test AI engines for accurate product citations",
    description:
      "Query Google AI Overviews, Gemini, ChatGPT and Perplexity with the pack's conversational prompts and record whether the site is cited, whether the cited facts match the current terms, and which third-party source answers instead.",
    priority: "High",
  },
  {
    id: "finance-canonical-rate-pages",
    task: "Consolidate duplicate rate and product pages",
    description:
      "Identify pages that publish overlapping versions of the same product terms, designate one canonical product/rate page, and point the variants at it so pricing claims cannot diverge across URLs.",
    priority: "Medium",
  },
  {
    id: "finance-breadcrumb-schema",
    task: "Mark up BreadcrumbList on product and article pages",
    description:
      "Add itemListElement breadcrumbs that mirror the site's product taxonomy so results and AI citations present a rate page as a product page rather than an article.",
    priority: "Medium",
  },
];

function buildFinancePack(): Pack {
  const meta = getPackMeta("finance");
  if (!meta) {
    // catalog.ts always defines it; fail loudly rather than register a husk.
    throw new Error('Pack "finance" is missing from src/packs/catalog.ts');
  }
  // Parsed through the schema so JSON import types cannot drift from the
  // validated KeywordStrategyMatrix shape (source: "illustrative" literal).
  const keywordMatrix = validateKeywordMatrix(keywordsJson);

  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    pageTypes: meta.pageTypes,
    // Authored defaults from the catalog — never hardcoded here.
    scoringWeights: meta.scoringWeights,
    checklist: FINANCE_CHECKLIST,
    schemaRules: FINANCE_SCHEMA_RULES,
    keywordMatrix,
    brandGuardrails: GENERIC_BRAND_GUARDRAILS,
    aiPrompts: [],
  };
}

export const financePack: Pack = buildFinancePack();

if (!getPack(financePack.id)) {
  registerPack(financePack);
}

export default financePack;
