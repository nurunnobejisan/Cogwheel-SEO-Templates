/**
 * Local Business pack — single-location service businesses (home services,
 * healthcare practices, personal care, professional trades).
 *
 * Everything is assembled from sources that already exist; nothing is
 * re-authored:
 *   - identity + weights  → src/packs/catalog.ts (weights are the authored
 *                           defaults documented in docs/PACKS.md — never
 *                           redefined here)
 *   - checklist           → ./index.ts below (authored for this vertical:
 *                           NAP, citations, GBP alignment, local schema)
 *   - schema rules        → ./schema-rules.ts (pack form of the local
 *                           JSON-LD requirements: LocalBusiness, Service,
 *                           OpeningHoursSpecification, FAQPage, Review,
 *                           GeoCoordinates)
 *   - keyword matrix      → ./keywords.json (the 78-keyword dataset,
 *                           revalidated through zod)
 *   - brand guardrails    → ../generic-guardrails (the shared Generic entry;
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
import { LOCAL_BUSINESS_SCHEMA_RULES } from "./schema-rules";
import keywordsJson from "./keywords.json";

/**
 * The pack checklist an auditor actually runs against a single-location
 * site: NAP consistency first (the foundation of local pack eligibility),
 * then entity schema, then the pages and listings that carry local intent.
 */
export const LOCAL_BUSINESS_CHECKLIST: ChecklistItem[] = [
  {
    id: "local-business-nap-consistency",
    task: "Audit NAP consistency across site and citations",
    description:
      "Verify the business name, street address and phone number appear identically on the homepage, contact page and top directory listings; a single variant splits the entity and weakens local pack eligibility.",
    priority: "Critical",
  },
  {
    id: "local-business-localbusiness-schema",
    task: "Ship complete LocalBusiness JSON-LD",
    description:
      "Publish name, address, telephone and geo on the homepage entity block, then extend it with openingHoursSpecification and areaServed so engines can match the page to a map listing.",
    priority: "Critical",
  },
  {
    id: "local-business-service-area-pages",
    task: "Build or repair service-area location pages",
    description:
      "Ensure every served city or neighbourhood has one indexable page with genuinely unique local content — hours, landmarks, directions — rather than a templated copy with the city name swapped.",
    priority: "High",
  },
  {
    id: "local-business-gbp-alignment",
    task: "Align Google Business Profile with on-site data",
    description:
      "Match primary and secondary categories, opening hours, phone and website URL between the profile and the site so the profile and the page corroborate one another.",
    priority: "High",
  },
  {
    id: "local-business-citation-hygiene",
    task: "Resolve duplicate and stale listings",
    description:
      "Search phone number and address variants across map and directory platforms, then claim, correct or suppress zombie profiles that publish outdated hours or an old address.",
    priority: "High",
  },
  {
    id: "local-business-review-schema",
    task: "Markup genuine reviews with Review schema",
    description:
      "Publish Review and AggregateRating markup only where real, attributable customer reviews exist on the page; fabricated or unattributed review markup violates review policies and gets the rich result suppressed.",
    priority: "Medium",
  },
  {
    id: "local-business-geo-and-directions",
    task: "Add GeoCoordinates and arrival details to location pages",
    description:
      "Embed exact latitude and longitude plus parking, transit and landmark notes so map engines and assistants can describe precisely how to reach the door.",
    priority: "Medium",
  },
  {
    id: "local-business-emergency-landing",
    task: "Publish an emergency and same-day landing page",
    description:
      "Give urgent local demand one page that states after-hours coverage plainly, carries a click-to-call action above the fold, and is marked up with OpeningHoursSpecification.",
    priority: "Medium",
  },
  {
    id: "local-business-faq-answers",
    task: "Answer the recurring customer questions in FAQPage markup",
    description:
      "Cover hours, pricing range, parking, accessibility and booking policy with Question/Answer pairs — these are exactly the questions assistants quote back to searchers.",
    priority: "Medium",
  },
];

function buildLocalBusinessPack(): Pack {
  const meta = getPackMeta("local-business");
  if (!meta) {
    // catalog.ts always defines it; fail loudly rather than register a husk.
    throw new Error(
      'Pack "local-business" is missing from src/packs/catalog.ts'
    );
  }
  // Parsed through the schema so JSON import types cannot drift from the
  // validated KeywordStrategyMatrix shape (source: "illustrative" literal).
  const keywordMatrix = validateKeywordMatrix(keywordsJson);

  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    pageTypes: meta.pageTypes,
    // Authored defaults from the catalog — never hardcoded in this module.
    scoringWeights: meta.scoringWeights,
    checklist: LOCAL_BUSINESS_CHECKLIST,
    schemaRules: LOCAL_BUSINESS_SCHEMA_RULES,
    keywordMatrix,
    brandGuardrails: GENERIC_BRAND_GUARDRAILS,
    aiPrompts: [],
  };
}

export const localBusinessPack: Pack = buildLocalBusinessPack();

if (!getPack(localBusinessPack.id)) {
  registerPack(localBusinessPack);
}

export default localBusinessPack;
