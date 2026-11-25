/**
 * Curated SEO Knowledge Base (Phase 2)
 *
 * The single source of truth injected into the LLM system prompt so fixes are
 * grounded in official guidance rather than model hallucination. Content
 * summarises the authoritative sources named in the roadmap:
 *   - Google Search Quality Rater Guidelines (E-E-A-T)
 *   - Google Search Central documentation
 *   - Schema.org specifications
 *   - Core Web Vitals guidance
 *   - High-converting metadata templates
 *
 * Summaries are paraphrased; canonical URLs are cited on each chunk.
 */

import type { RagChunk } from "../types.ts";

export const SEED_KNOWLEDGE: RagChunk[] = [
  {
    id: "kc-title-tag",
    title: "Title tag best practice",
    text:
      "A title tag should be unique, descriptive and 40-60 characters (about 580px) so it is not truncated on desktop. Lead with the primary topic or keyword, then the brand, typically separated by a pipe. Avoid keyword stuffing and duplicate titles across URLs; duplicates cause cannibalization and dilute click-through rate.",
    source: "Google Search Central",
    url: "https://developers.google.com/search/docs/appearance/title-link",
    tags: ["metadata", "title", "iss_title_missing", "iss_title_too_long", "iss_title_too_short"],
  },
  {
    id: "kc-meta-description",
    title: "Meta description best practice",
    text:
      "A meta description is a 120-160 character summary that appears under the title in search results. Include the page's core entity and a call to action. Google may rewrite it, but a well-written description improves click-through rate. Missing descriptions force Google to generate a snippet automatically.",
    source: "Google Search Central",
    url: "https://developers.google.com/search/docs/appearance/snippet",
    tags: ["metadata", "meta_description", "iss_meta_desc_missing", "iss_meta_desc_too_long"],
  },
  {
    id: "kc-heading-structure",
    title: "Heading structure (H1-H6)",
    text:
      "Use exactly one H1 that describes the page's primary topic, then nest H2-H6 in logical order without skipping levels. Headings should describe the content below them, not be used purely for visual styling. Empty headings waste semantic signal.",
    source: "Google Search Central",
    url: "https://developers.google.com/search/docs/appearance/structured-data",
    tags: ["metadata", "headings", "iss_h1_missing", "iss_h1_multiple", "iss_heading_hierarchy_skip"],
  },
  {
    id: "kc-canonical",
    title: "Canonical URLs",
    text:
      "Every indexable page should declare a self-referential canonical (or point to the master version when intentionally consolidating). A canonical pointing to a different URL tells Google to index the target instead, and mismatches are a common cause of de-indexing.",
    source: "Google Search Central",
    url: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
    tags: ["technical", "canonical", "iss_canonical_missing", "iss_canonical_mismatch"],
  },
  {
    id: "kc-indexability",
    title: "Indexability and robots directives",
    text:
      "noindex removes a URL from the index; nofollow discards link signals. Verify robots meta directives and X-Robots-Tag headers before launch. A missing viewport meta tag harms mobile-first indexing and mobile usability.",
    source: "Google Search Central",
    url: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
    tags: ["technical", "indexability", "iss_noindex", "iss_viewport_missing"],
  },
  {
    id: "kc-core-web-vitals",
    title: "Core Web Vitals thresholds",
    text:
      "Core Web Vitals are LCP (largest contentful paint, good <= 2.5s), INP (interaction to next paint, good <= 200ms) and CLS (cumulative layout shift, good <= 0.1). Reserve image dimensions and use next-gen formats (WebP/AVIF) with responsive srcsets to protect LCP and CLS.",
    source: "web.dev (Core Web Vitals)",
    url: "https://web.dev/articles/vitals",
    tags: ["media", "cwv", "iss_img_missing_dimensions", "iss_img_oversized"],
  },
  {
    id: "kc-image-alt",
    title: "Image alt text",
    text:
      "Provide concise descriptive alt text for informative images (roughly 5-15 words). Decorative images may use alt=\"\". Missing or empty alt on informative images breaks accessibility (WCAG) and loses image-search relevance.",
    source: "WCAG 2.1 / Google Image best practices",
    url: "https://www.w3.org/WAI/tutorials/images/",
    tags: ["accessibility", "alt_text", "images", "iss_img_alt_missing"],
  },
  {
    id: "kc-links",
    title: "Link integrity",
    text:
      "Broken internal links (404/5xx) waste crawl budget and harm users; add 301 redirects to the closest live equivalent. Keep redirect chains to a single hop. External links that open a new tab should carry rel=\"noopener noreferrer\".",
    source: "Google Search Central",
    url: "https://developers.google.com/search/docs/crawling-indexing/links-crawlable",
    tags: ["technical", "links", "iss_broken_internal_link", "iss_redirect_chain", "iss_external_link_rel"],
  },
  {
    id: "kc-lodgingbusiness-schema",
    title: "Schema.org LodgingBusiness",
    text:
      "Hospitality properties should mark up LodgingBusiness (or a sub-type such as Hotel or Resort) with required properties name, address and telephone, plus recommended priceRange, amenityFeature, starRating and geo. Add Booking-specific actions and keep NAP consistent with Google Business Profile.",
    source: "Schema.org",
    url: "https://schema.org/LodgingBusiness",
    tags: ["schema", "hospitality", "iss_hotel_schema_missing", "iss_hotel_schema_property_missing"],
  },
  {
    id: "kc-product-schema",
    title: "Schema.org Product",
    text:
      "Product markup requires name and offers (with price and priceCurrency); recommended: image, description, brand, sku, aggregateRating and review. Product structured data drives rich results such as price, availability and ratings.",
    source: "Schema.org",
    url: "https://schema.org/Product",
    tags: ["schema", "iss_structured_data_missing"],
  },
  {
    id: "kc-organization-schema",
    title: "Schema.org Organization and WebSite",
    text:
      "Organization markup with name, url, logo and sameAs (social profiles) establishes the brand entity. Pair it with WebSite plus a SearchAction to enable sitelinks search box. BreadcrumbList markup clarifies site hierarchy in results.",
    source: "Schema.org",
    url: "https://schema.org/Organization",
    tags: ["schema", "iss_structured_data_missing"],
  },
  {
    id: "kc-faq-schema",
    title: "Schema.org FAQPage",
    text:
      "FAQPage markup exposes question/answer pairs in rich results when the content is genuinely visible on the page. Each Question needs a name and an acceptedAnswer with text. Do not mark up content that is not shown to users.",
    source: "Schema.org",
    url: "https://schema.org/FAQPage",
    tags: ["schema", "iss_structured_data_missing"],
  },
  {
    id: "kc-eeat",
    title: "E-E-A-T and helpful content",
    text:
      "Quality raters assess Experience, Expertise, Authoritativeness and Trust. Demonstrate first-hand experience, cite credible sources, show author credentials, and keep the primary content genuinely helpful for the user's query. Thin, scaled or unhelpful content is demoted by the helpful content system.",
    source: "Google Search Quality Rater Guidelines",
    url: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
    tags: ["content", "iss_thin_content", "iss_readability_low", "iss_keyword_stuffing"],
  },
  {
    id: "kc-geo-ai-search",
    title: "Generative Engine Optimization (GEO)",
    text:
      "AI answer engines favour clear entity definitions, concise 40-60 word factual summaries, structured data and consistent facts across the web. Add direct answers under headings, expose machine-readable facts via schema, and keep NAP and brand claims identical across sources to increase citation likelihood.",
    source: "Google Search Central / GEO guidance",
    url: "https://developers.google.com/search/docs/appearance/ai-features",
    tags: ["geo", "content", "schema", "iss_structured_data_missing"],
  },
  {
    id: "kc-social-meta",
    title: "Social sharing meta tags",
    text:
      "Open Graph (og:title, og:description, og:image at 1200x630) controls link previews on Facebook, LinkedIn and messaging apps. Twitter/X uses twitter:card (summary_large_image) with twitter:title, twitter:description and twitter:image. Missing social tags produce poor, low-trust previews.",
    source: "Open Graph protocol / X Cards",
    url: "https://ogp.me/",
    tags: ["technical", "iss_og_title_missing", "iss_og_description_missing", "iss_og_image_missing", "iss_twitter_card_missing"],
  },
];

/** Convenience helper: ids of every seeded chunk. */
export function seedKnowledgeIds(): string[] {
  return SEED_KNOWLEDGE.map((chunk) => chunk.id);
}
