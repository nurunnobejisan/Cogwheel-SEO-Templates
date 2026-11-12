/**
 * Hilton copy rules (consumed by Phase 3 `/api/generate-hc` + Content Studio).
 * Encoded now so the spec has a single source of truth. See SPEC.md §7.
 */

export const HALF_AND_HALF_BRANDS = [
  "Canopy",
  "Curio",
  "Graduate",
  "Motto",
  "Tapestry",
  "Tempo",
  "Outset",
] as const;

export const HILTON_BRANDS = [
  "Waldorf Astoria",
  "LXR",
  "Conrad",
  "Canopy",
  "Signia",
  "Hilton",
  "Curio",
  "DoubleTree",
  "Tapestry",
  "Embassy Suites",
  "Tempo",
  "Motto",
  "Graduate",
  "Outset",
  "Hilton Garden Inn",
  "Hampton",
  "Tru",
  "Spark",
  "Homewood Suites",
  "Home2 Suites",
  "LivSmart Studios",
  "Hilton Grand Vacations",
] as const;

export type HiltonSectionId =
  | "home-headline"
  | "home-description"
  | "usp-callout"
  | "half-and-half"
  | "location"
  | "dining-main"
  | "dining-outlet"
  | "rooms"
  | "suites"
  | "hotel-info"
  | "offers"
  | "gallery"
  | "events";

export type SectionMode = "generate" | "strict-edit" | "boilerplate" | "factual-only" | "flag";

export interface SectionRule {
  id: HiltonSectionId;
  label: string;
  mode: SectionMode;
  maxChars?: number;
  /** For "approximately N chars" targets. */
  targetChars?: number;
  targetTolerance?: number;
  /** Grandfathered limit (Dining Outlets). */
  grandfatheredMaxChars?: number;
  requiredUsps?: number;
  maxLinks?: number;
  maxSpotlights?: number;
  requiresKeyword?: boolean;
  requiresAdaLegal?: boolean;
  requiresJsNote?: boolean;
  notes: string;
}

export const SECTION_RULES: Record<HiltonSectionId, SectionRule> = {
  "home-headline": { id: "home-headline", label: "Home Headline", mode: "generate", maxChars: 50, requiresKeyword: true, notes: "≤ 50 characters." },
  "home-description": {
    id: "home-description",
    label: "Home Description",
    mode: "strict-edit",
    maxChars: 350,
    requiresKeyword: true,
    notes: "≤ 350 characters. Strict edit mode: additions as **bold**, removals as ~~strikethrough~~.",
  },
  "usp-callout": { id: "usp-callout", label: "USP Callout", mode: "generate", targetChars: 350, targetTolerance: 0.1, notes: "≈ 350 characters." },
  "half-and-half": { id: "half-and-half", label: "Half & Half", mode: "flag", notes: "Yes only for Canopy, Curio, Graduate, Motto, Tapestry, Tempo, Outset." },
  location: { id: "location", label: "Location", mode: "generate", maxChars: 150, requiresKeyword: true, notes: "≤ 150 characters." },
  "dining-main": { id: "dining-main", label: "Dining Main", mode: "generate", maxChars: 300, requiredUsps: 2, requiresKeyword: true, notes: "≤ 300 characters + 2 USPs." },
  "dining-outlet": {
    id: "dining-outlet",
    label: "Dining Outlet",
    mode: "generate",
    maxChars: 300,
    grandfatheredMaxChars: 400,
    maxLinks: 1,
    notes: "≤ 300 characters (400 if grandfathered), max 1 link.",
  },
  rooms: { id: "rooms", label: "Rooms", mode: "generate", requiredUsps: 2, requiresKeyword: true, requiresAdaLegal: true, requiresJsNote: true, notes: "Keyword + 2 USPs + Hilton ADA legal copy + JS note." },
  suites: { id: "suites", label: "Suites", mode: "generate", requiredUsps: 2, requiresKeyword: true, requiresAdaLegal: true, requiresJsNote: true, notes: "Keyword + 2 USPs + Hilton ADA legal copy + JS note." },
  "hotel-info": { id: "hotel-info", label: "Hotel Info", mode: "boilerplate", notes: "Fixed boilerplate." },
  offers: { id: "offers", label: "Offers", mode: "boilerplate", notes: "Fixed boilerplate." },
  gallery: { id: "gallery", label: "Gallery", mode: "boilerplate", notes: "Fixed boilerplate." },
  events: { id: "events", label: "Events", mode: "factual-only", maxSpotlights: 3, notes: "Factual error fixes + up to 3 spotlight focus points only. No rewrites." },
};

export function isHalfAndHalfEligible(brand: string): boolean {
  const b = brand.toLowerCase();
  return HALF_AND_HALF_BRANDS.some((x) => b.includes(x.toLowerCase()));
}

/** All LLM calls must use this temperature. */
export const LLM_TEMPERATURE = 0.2;

