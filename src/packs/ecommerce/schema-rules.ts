/**
 * Ecommerce pack — contextual JSON-LD requirements (docs/PACKS.md).
 *
 * Declarative rules layered on top of the runtime ruleset in `rules/`.
 * Each rule names the page types where it applies so a Product requirement
 * fires on `product` without penalising an `article`. `rationale` is
 * surfaced verbatim in audit output — write it for the operator who has to
 * act on it.
 *
 * Covers the six JSON-LD types ecommerce SEO lives or dies by: Product,
 * Offer, Brand, CollectionPage, Review and BreadcrumbList.
 */
import type { PackSchemaRule } from "../types";

export const ECOMMERCE_SCHEMA_RULES: PackSchemaRule[] = [
  {
    jsonLdType: "Product",
    pageTypes: ["product", "category"],
    required: ["name", "image", "brand", "offers", "sku"],
    recommended: ["description", "gtin13", "mpn", "aggregateRating", "review"],
    rationale:
      "Product structured data is what unlocks price, stock and review rich results on shopping queries; without name, image, brand, sku and an offers block the listing falls back to plain text and loses the visual shelf space competitors occupy.",
  },
  {
    jsonLdType: "Offer",
    pageTypes: ["product", "category"],
    required: ["priceCurrency", "price", "url", "availability"],
    recommended: ["itemCondition", "shippingDetails", "seller", "priceValidUntil"],
    rationale:
      "An Offer without price, currency, availability and a URL cannot be surfaced as a priced shopping result; operators must keep this markup in sync with the rendered price or Google suppresses the merchant listing for the mismatch.",
  },
  {
    jsonLdType: "Brand",
    pageTypes: ["home", "product", "category"],
    required: ["name", "url"],
    recommended: ["logo", "description", "sameAs", "foundingDate"],
    rationale:
      "Declaring the Brand entity on the pages that sell its products ties every SKU to one recognisable maker, which is what answer engines look for when they decide which store to name in a recommendation response.",
  },
  {
    jsonLdType: "CollectionPage",
    pageTypes: ["category"],
    required: ["name", "url", "itemListElement"],
    recommended: ["itemList", "breadcrumb", "description"],
    rationale:
      "Category pages are the workhorses of store traffic, and CollectionPage markup with a populated itemListElement tells crawlers which products belong to the collection instead of leaving them to infer it from link order alone.",
  },
  {
    jsonLdType: "Review",
    pageTypes: ["product", "article"],
    required: ["itemReviewed", "author", "datePublished", "reviewBody"],
    recommended: ["reviewRating", "publisher"],
    rationale:
      "Review markup only earns rich results and engine citations when it points at a real reviewed entity with a genuine author and date; shipping self-serving or empty review blocks risks a manual action against the whole domain.",
  },
  {
    jsonLdType: "BreadcrumbList",
    pageTypes: ["category", "product", "other"],
    required: ["itemListElement"],
    recommended: ["name", "item", "position"],
    rationale:
      "Breadcrumbs replace the raw URL as the display path in results and in AI answer citations; itemListElement that mirrors the visible navigation keeps that path readable instead of showing shoppers an opaque string of slugs.",
  },
];
