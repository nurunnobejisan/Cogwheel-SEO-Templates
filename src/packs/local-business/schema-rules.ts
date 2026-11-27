/**
 * Local Business pack — contextual JSON-LD requirements.
 *
 * Declarative rules layered on top of the runtime ruleset. Each rule names
 * the page types where it applies so a requirement can fire on
 * `home`/`location` without penalising an `article`. `rationale` is surfaced
 * verbatim in audit output — write it for the operator who has to act on it.
 *
 * These types are what local search results and AI assistants actually read
 * for a single-location business: entity identity (LocalBusiness), what it
 * sells (Service), when it is open (OpeningHoursSpecification), proof
 * (Review), and the geographic/breadcrumb context that lets an engine place
 * the answer on a map.
 */
import type { PackSchemaRule } from "../types";

export const LOCAL_BUSINESS_SCHEMA_RULES: PackSchemaRule[] = [
  {
    jsonLdType: "LocalBusiness",
    pageTypes: ["home", "location", "contact"],
    required: ["name", "address", "telephone", "geo"],
    recommended: ["url", "openingHoursSpecification", "priceRange", "areaServed"],
    rationale:
      "LocalBusiness is the entity anchor for local pack and map eligibility; an entity missing name, address, telephone or geo coordinates cannot be matched to a listing, so the business silently loses local result participation.",
  },
  {
    jsonLdType: "Service",
    pageTypes: ["home", "location", "other"],
    required: ["name", "provider", "areaServed"],
    recommended: ["serviceType", "description", "url"],
    rationale:
      "A Service block tells engines which offering and which coverage area a page represents; without provider and areaServed the offering floats free of the business and the city it serves, weakening service-area targeting.",
  },
  {
    jsonLdType: "OpeningHoursSpecification",
    pageTypes: ["contact", "location"],
    required: ["dayOfWeek", "opens", "closes"],
    recommended: ["validFrom", "validTo"],
    rationale:
      "Hours disputes are the most common local data mismatch; publishing dayOfWeek, opens and closes as structured data lets map apps and assistants state open-or-closed status correctly instead of falling back to a stale directory entry.",
  },
  {
    jsonLdType: "FAQPage",
    pageTypes: ["article", "other", "contact"],
    required: ["mainEntity"],
    recommended: ["name", "description"],
    rationale:
      "FAQPage without Question/mainEntity pairs cannot be cited in AI answers; drop the markup instead of shipping an empty shell, and pair each Question with an acceptedAnswer an assistant can quote verbatim.",
  },
  {
    jsonLdType: "Review",
    pageTypes: ["other", "home"],
    required: ["itemReviewed", "author", "reviewRating"],
    recommended: ["reviewBody", "datePublished"],
    rationale:
      "Review markup must describe a real, attributable review of the business or its service; publishing it without itemReviewed, author or a rating value risks review-policy violations while contributing nothing an engine can display.",
  },
  {
    jsonLdType: "GeoCoordinates",
    pageTypes: ["location", "contact"],
    required: ["latitude", "longitude"],
    recommended: ["elevation"],
    rationale:
      "Coordinates are how map results pin the business and how navigation apps route to it; an address string alone is ambiguous when streets share a name across towns, so publish exact latitude and longitude alongside the postal address.",
  },
];
