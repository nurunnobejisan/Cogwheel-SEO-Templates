/**
 * SaaS pack — contextual JSON-LD requirements (docs/PACKS.md authoring contract).
 *
 * Declarative rules layered on top of the universal runtime ruleset. Each rule
 * names the page types where it applies so a requirement can fire on
 * `product`/`home` without penalising an `article`. `rationale` is surfaced
 * verbatim in audit output — write it for the operator who has to act on it.
 *
 * SaaS markup leans on SoftwareApplication for product identity, FAQPage for
 * buyer questions (pricing, refunds, integrations), Article/HowTo for docs and
 * guides, Review for genuine customer feedback, and BreadcrumbList for result
 * display paths.
 */
import type { PackSchemaRule } from "../types";

export const SAAS_SCHEMA_RULES: PackSchemaRule[] = [
  {
    jsonLdType: "SoftwareApplication",
    pageTypes: ["home", "product"],
    required: ["name", "description", "url", "applicationCategory"],
    recommended: [
      "applicationSuite",
      "operatingSystem",
      "offers",
      "featureList",
      "aggregateRating",
      "screenshot",
    ],
    rationale:
      "SoftwareApplication is how Google and answer engines identify the product itself; without name, description, url and applicationCategory the node is dropped from software rich results and cannot anchor pricing or review markup that depends on it.",
  },
  {
    jsonLdType: "FAQPage",
    pageTypes: ["product", "article", "other"],
    required: ["mainEntity"],
    recommended: ["name", "url"],
    rationale:
      "Buyer questions about pricing, refunds and integrations only surface in AI answers when wrapped as Question/mainEntity pairs; shipping a FAQPage shell with no pairs wastes the opportunity and can be rejected outright by validators.",
  },
  {
    jsonLdType: "Article",
    pageTypes: ["article"],
    required: ["headline", "datePublished", "author"],
    recommended: ["image", "description", "mainEntityOfPage"],
    rationale:
      "Blog posts, comparison pages and changelogs compete as editorial content; a headline, publication date and named author are what let crawlers date the piece and attribute it, which is also what generative engines weigh when citing it.",
  },
  {
    jsonLdType: "HowTo",
    pageTypes: ["article", "other", "product"],
    required: ["name", "step"],
    recommended: ["estimatedTime", "totalTime", "supply", "tool"],
    rationale:
      "Setup, migration and webhook guides earn how-to presentation only when the steps are machine-readable; name plus step elements are the floor, and omitting them means the guide renders as plain text in every answer surface.",
  },
  {
    jsonLdType: "Review",
    pageTypes: ["product", "other"],
    required: ["itemReviewed", "reviewRating"],
    recommended: ["author", "datePublished", "reviewBody"],
    rationale:
      "Review markup without an itemReviewed entity or a rating value is invalid, and publishing ratings the product cannot substantiate violates review policies — attach the node to genuine on-site customer feedback only.",
  },
  {
    jsonLdType: "BreadcrumbList",
    pageTypes: ["category", "product", "article"],
    required: ["itemListElement"],
    recommended: ["position", "name", "item"],
    rationale:
      "Deep comparison and docs hierarchies collapse into raw URLs in results unless breadcrumb markup replaces them; itemListElement is what reconstructs the category-to-page path for both search listings and AI citations.",
  },
];
