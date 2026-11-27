/**
 * Hotel pack — contextual JSON-LD requirements (docs/TASKS.md Task 2.2).
 *
 * Declarative rules layered on top of the runtime ruleset in `rules/hotel/`.
 * Each rule names the page types where it applies so a requirement can fire
 * on `home`/`location` without penalising an `article`. `rationale` is
 * surfaced verbatim in audit output — write it for the operator who has to
 * act on it.
 *
 * The Offer-parent and CollectionPage clauses mirror
 * `rules/universal/schema-context.ts` (Task 3.3) in pack form, so the pack
 * can recommend the same fix the rules engine enforces.
 */
import type { PackSchemaRule } from "../types";

export const HOTEL_SCHEMA_RULES: PackSchemaRule[] = [
  {
    jsonLdType: "Hotel",
    pageTypes: ["home", "location", "booking"],
    required: ["name", "address", "telephone", "url"],
    recommended: ["starRating", "amenityFeature", "priceRange", "geo"],
    rationale:
      "Hotel rich results require name, address and telephone; missing any of them drops the listing from hotel carousels.",
  },
  {
    jsonLdType: "Offer",
    pageTypes: ["booking", "product"],
    required: ["priceCurrency", "price", "url", "itemOffered"],
    recommended: ["availability", "validFrom"],
    rationale:
      "A standalone Offer is rejected by validators — attach itemOffered to a parent entity (Hotel/LodgingBusiness/Product) so crawlers can price the stay.",
  },
  {
    jsonLdType: "FAQPage",
    pageTypes: ["article", "other"],
    required: ["mainEntity"],
    recommended: [],
    rationale:
      "FAQPage without Question/mainEntity pairs cannot be cited in AI answers; drop the markup instead of shipping an empty shell.",
  },
  {
    jsonLdType: "BreadcrumbList",
    pageTypes: ["category", "location"],
    required: ["itemListElement"],
    recommended: ["position"],
    rationale:
      "Breadcrumbs replace the raw URL as the display path in results; itemListElement drives that path.",
  },
  {
    jsonLdType: "AggregateRating",
    pageTypes: ["home", "product"],
    required: ["ratingValue", "reviewCount"],
    recommended: ["bestRating"],
    rationale:
      "Publish AggregateRating only when genuine review data exists — markup without real reviews violates review policies.",
  },
];
