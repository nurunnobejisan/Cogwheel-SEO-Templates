/**
 * Ecommerce & Retail pack — product, offer and collection-page scoring
 * (docs/PACKS.md, catalog id "ecommerce").
 *
 * Assembled from sources that already existed in the repo; nothing here is
 * re-authored from measurements:
 *   - identity + weights  → src/packs/catalog.ts (authored defaults for the
 *                           five universal packs, documented in PACKS.md;
 *                           never hardcoded in this file)
 *   - checklist           → ./index.ts (authored for this vertical: the
 *                           checks an ecommerce SEO auditor runs on a store)
 *   - schema rules        → ./schema-rules.ts (Product/Offer/Brand/
 *                           CollectionPage/Review/BreadcrumbList clauses)
 *   - keyword matrix      → ./keywords.json (the 78-keyword dataset,
 *                           revalidated through zod)
 *   - brand guardrails    → ../generic-guardrails.ts (GENERIC_BRAND_GUARDRAILS;
 *                           no franchise rulebook exists for this vertical)
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
import { ECOMMERCE_SCHEMA_RULES } from "./schema-rules";
import keywordsJson from "./keywords.json";

/**
 * Vertical audit checklist — authored for ecommerce stores so the audit
 * side panel surfaces the checks that actually move product and category
 * pages. Priorities are Critical/High/Medium per ChecklistItem.
 */
export const ECOMMERCE_CHECKLIST: ChecklistItem[] = [
  {
    id: "ecommerce-product-jsonld",
    task: "Validate Product JSON-LD on every product detail page",
    description:
      "Confirm each product URL emits Product markup with name, image, brand, sku and an offers block, and that the validator reports no errors for required properties.",
    priority: "Critical",
  },
  {
    id: "ecommerce-offer-price-sync",
    task: "Sync Offer price and availability with the rendered page",
    description:
      "Compare the priceCurrency, price and availability values in Offer markup against the visible price and stock state so the two never disagree at crawl time.",
    priority: "Critical",
  },
  {
    id: "ecommerce-collection-itemlist",
    task: "Mark up category pages as CollectionPage with ItemList",
    description:
      "Ensure each collection URL publishes CollectionPage markup whose itemListElement lists the products shown, in the same order the shopper sees them.",
    priority: "High",
  },
  {
    id: "ecommerce-breadcrumb-parity",
    task: "Align BreadcrumbList markup with visible navigation",
    description:
      "Verify the breadcrumb trail in JSON-LD matches the on-page breadcrumbs and the URL hierarchy so search results display readable category paths.",
    priority: "High",
  },
  {
    id: "ecommerce-review-genuineness",
    task: "Audit review markup for genuine reviews only",
    description:
      "Confirm Review and AggregateRating blocks reference reviews collected on-site with a real author and date, and remove any markup covering reviews gathered elsewhere.",
    priority: "Critical",
  },
  {
    id: "ecommerce-shipping-returns-faq",
    task: "Publish shipping and returns answers as FAQPage",
    description:
      "Check that shipping thresholds, return windows and tracking questions are answered in visible copy and marked up as FAQPage so answer engines can cite them.",
    priority: "High",
  },
  {
    id: "ecommerce-variant-canonicals",
    task: "Canonicalise variant and filter URLs",
    description:
      "Inspect size, colour and faceted-navigation URLs to confirm each canonicalises to the intended parent product or collection instead of spawning duplicate pages.",
    priority: "Medium",
  },
  {
    id: "ecommerce-brand-entity",
    task: "Declare a consistent Brand entity site-wide",
    description:
      "Verify the homepage and product pages reference the same Brand name, url and logo so entity signals consolidate on one recognisable maker.",
    priority: "Medium",
  },
  {
    id: "ecommerce-offer-feed-parity",
    task: "Reconcile on-page offers with the merchant feed",
    description:
      "Cross-check price, availability and identifier values between page markup and the shopping feed to prevent disapprovals caused by mismatched offer data.",
    priority: "High",
  },
];

function buildEcommercePack(): Pack {
  const meta = getPackMeta("ecommerce");
  if (!meta) {
    // catalog.ts always defines it; fail loudly rather than register a husk.
    throw new Error('Pack "ecommerce" is missing from src/packs/catalog.ts');
  }
  // Parsed through the schema so JSON import types cannot drift from the
  // validated KeywordStrategyMatrix shape (source: "illustrative" literal).
  const keywordMatrix = validateKeywordMatrix(keywordsJson);

  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    pageTypes: meta.pageTypes,
    // Weights come from the catalog's authored defaults — never hardcoded here.
    scoringWeights: meta.scoringWeights,
    checklist: ECOMMERCE_CHECKLIST,
    schemaRules: ECOMMERCE_SCHEMA_RULES,
    keywordMatrix,
    brandGuardrails: GENERIC_BRAND_GUARDRAILS,
    aiPrompts: [],
  };
}

export const ecommercePack: Pack = buildEcommercePack();

if (!getPack(ecommercePack.id)) {
  registerPack(ecommercePack);
}

export default ecommercePack;
