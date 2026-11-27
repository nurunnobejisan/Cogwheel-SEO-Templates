/**
 * Publisher & Media pack — article structure, E-E-A-T and syndication
 * scoring for news and content sites (docs/PACKS.md, catalog id "publisher").
 *
 * Assembled from sources that already existed in the repo; nothing here is
 * re-authored from measurements:
 *   - identity + weights  → src/packs/catalog.ts via getPackMeta("publisher");
 *                           the weights are the authored defaults documented
 *                           in docs/PACKS.md, never measured scores
 *   - checklist           → ./index.ts (authored for this vertical: the
 *                           checks a publisher SEO auditor runs on a news
 *                           or content site)
 *   - schema rules        → ./schema-rules.ts (NewsArticle/Article/
 *                           BlogPosting/Person/FAQPage/BreadcrumbList)
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
import { PUBLISHER_SCHEMA_RULES } from "./schema-rules";
import keywordsJson from "./keywords.json";

/**
 * Vertical audit checklist — authored for publishers so the audit side
 * panel surfaces the checks that actually move article, author and
 * category pages. Priorities are Critical/High/Medium per ChecklistItem.
 */
export const PUBLISHER_CHECKLIST: ChecklistItem[] = [
  {
    id: "publisher-article-jsonld",
    task: "Validate NewsArticle / Article JSON-LD on every story",
    description:
      "Confirm each story URL emits markup with headline, datePublished, dateModified, author, publisher and image, and that the structured-data tester reports no errors for the required properties before the piece is promoted.",
    priority: "Critical",
  },
  {
    id: "publisher-byline-authorship",
    task: "Verify bylines resolve to a Person entity with credentials",
    description:
      "Check that every bylined article links to an author page carrying Person markup with name, url, sameAs and job title, and that the credentials shown support the beat the article covers.",
    priority: "Critical",
  },
  {
    id: "publisher-paywall-indexability",
    task: "Confirm paywalled stories stay crawlable and correctly marked",
    description:
      "Inspect robots directives and markup on subscriber-only stories to ensure the full headline, summary and visible preview remain accessible to crawlers, and that any paywall or subscription markup matches the page readers actually receive.",
    priority: "Critical",
  },
  {
    id: "publisher-date-freshness",
    task: "Reconcile visible dates with datePublished and dateModified",
    description:
      "Compare the published and updated dates shown to readers against the JSON-LD values, requiring dateModified to advance whenever material edits land so freshness signals never contradict the rendered page.",
    priority: "High",
  },
  {
    id: "publisher-breadcrumb-parity",
    task: "Align BreadcrumbList markup with visible navigation",
    description:
      "Verify the breadcrumb trail in JSON-LD matches the on-page breadcrumbs and the URL hierarchy so results and AI citations present the story as part of the publication's section taxonomy rather than an orphaned URL.",
    priority: "High",
  },
  {
    id: "publisher-syndication-canonicals",
    task: "Audit canonicals on syndicated and republished stories",
    description:
      "Identify articles distributed to partner sites or aggregated feeds and confirm each variant points a self-referencing or upstream canonical at the originating story so link equity and citation credit consolidate on one source.",
    priority: "High",
  },
  {
    id: "publisher-faq-citability",
    task: "Mark up explainer FAQs that AI engines can cite",
    description:
      "Ensure FAQ blocks on guides and explainers repeat their visible questions inside FAQPage mainEntity JSON-LD, and remove markup for questions the page never answers so answer engines can quote the page accurately.",
    priority: "Medium",
  },
  {
    id: "publisher-liveblog-updates",
    task: "Keep LiveBlogPosting coverage current and timestamped",
    description:
      "Check that live blog entries carry LiveBlogPosting markup with accurate datePublished stamps for each update, and that the feed stops claiming a live status once coverage has genuinely concluded.",
    priority: "Medium",
  },
];

function buildPublisherPack(): Pack {
  const meta = getPackMeta("publisher");
  if (!meta) {
    // catalog.ts always defines it; fail loudly rather than register a husk.
    throw new Error('Pack "publisher" is missing from src/packs/catalog.ts');
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
    checklist: PUBLISHER_CHECKLIST,
    schemaRules: PUBLISHER_SCHEMA_RULES,
    keywordMatrix,
    brandGuardrails: GENERIC_BRAND_GUARDRAILS,
    aiPrompts: [],
  };
}

export const publisherPack: Pack = buildPublisherPack();

if (!getPack(publisherPack.id)) {
  registerPack(publisherPack);
}

export default publisherPack;
