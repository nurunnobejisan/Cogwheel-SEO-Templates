/**
 * Publisher pack — contextual JSON-LD requirements (docs/PACKS.md).
 *
 * Declarative rules layered on top of the runtime ruleset in `rules/`.
 * Each rule names the page types where it applies so a requirement can fire
 * on an `article` without penalising the `home` page. `rationale` is
 * surfaced verbatim in audit output — write it for the operator who has to
 * act on it.
 *
 * Covers the JSON-LD types a news or content site actually ships:
 * NewsArticle / Article / BlogPosting for stories, Person for bylines,
 * FAQPage for citable answer blocks and BreadcrumbList for taxonomy paths.
 */
import type { PackSchemaRule } from "../types";

export const PUBLISHER_SCHEMA_RULES: PackSchemaRule[] = [
  {
    jsonLdType: "NewsArticle",
    pageTypes: ["article"],
    required: [
      "headline",
      "datePublished",
      "dateModified",
      "author",
      "publisher",
      "image",
      "mainEntityOfPage",
    ],
    recommended: ["description", "articleSection", "keywords", "inLanguage"],
    rationale:
      "Top Stories and news carousels reject a story missing its headline, publication date, author, publisher or image, so validate the block before promoting the page — a broken NewsArticle silently removes the article from every news surface while the site still looks fine in the browser.",
  },
  {
    jsonLdType: "Article",
    pageTypes: ["article", "other"],
    required: ["headline", "datePublished", "author", "publisher"],
    recommended: ["dateModified", "image", "description", "mainEntityOfPage"],
    rationale:
      "Article markup is the baseline every content page should ship; without a headline, publication date, author and publisher the page loses eligibility for rich results and cannot establish who made the claim or when it was made — both facts answer engines look for before citing a source.",
  },
  {
    jsonLdType: "BlogPosting",
    pageTypes: ["article"],
    required: ["headline", "datePublished", "author"],
    recommended: ["publisher", "image", "wordCount", "inLanguage"],
    rationale:
      "Guides, op-eds and lifestyle posts typically publish as BlogPosting rather than NewsArticle; the author and datePublished properties are what let answer engines attach a named, dated source to the claim when they quote the post, so treat them as mandatory even on evergreen pages.",
  },
  {
    jsonLdType: "Person",
    pageTypes: ["other", "home"],
    required: ["name", "url"],
    recommended: ["jobTitle", "image", "sameAs", "worksFor", "knowsAbout"],
    rationale:
      "Author and staff pages must declare a Person entity with a self-referencing url and sameAs links to external profiles; this is the E-E-A-T signal search and answer engines use to weigh the expertise behind a byline, and a missing entity leaves the outlet's writers invisible to entity-based ranking.",
  },
  {
    jsonLdType: "FAQPage",
    pageTypes: ["article", "other"],
    required: ["mainEntity"],
    recommended: ["name"],
    rationale:
      "FAQPage earns its keep only when each Question appears in visible copy and repeats in mainEntity; engines cite the pairing verbatim, so shipping markup for questions readers never see misrepresents the page and invites a manual action — drop the block instead of publishing an empty shell.",
  },
  {
    jsonLdType: "BreadcrumbList",
    pageTypes: ["article", "category"],
    required: ["itemListElement"],
    recommended: ["position", "name"],
    rationale:
      "Breadcrumbs replace the raw URL as the displayed path in results and AI citations; itemListElement must mirror the visible trail so category and article pages read as part of the publication's taxonomy rather than isolated URLs competing with the hubs that should be ranking instead.",
  },
];
