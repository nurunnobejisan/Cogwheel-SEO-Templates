/**
 * Light pack catalog (docs/TASKS.md Tasks 2.4 / 4.1).
 *
 * The full `Pack` objects live in `src/packs/<id>/index.ts` and each carries
 * a 78-keyword matrix (~60 KB of JSON). The extension's pack selector and
 * auto-suggest heuristics must not pay that cost, so this module holds the
 * projection every surface can afford: identity, page types, scoring weights
 * and the schema/URL/keyword signals used to suggest a pack.
 *
 * Hotel `scoringWeights` come straight from `data/ota-config.json` — the
 * OTA-delivered weights the extension already ships — so the repo has exactly
 * one definition of them. The five universal packs' weights are authored
 * defaults (documented in docs/PACKS.md), never presented as measured.
 *
 * This file must stay importable from the extension: no keyword matrices,
 * no registry, no side effects.
 */
import type { ScoringWeights } from "../schemas/validation";
import type { PackPageType } from "./types";
import otaConfig from "../../data/ota-config.json";

/** Heuristics used by `suggestPack()` — all matched case-insensitively. */
export interface PackSignals {
  /** JSON-LD `@type` values (or substrings) that point at this vertical. */
  schemaTypes: string[];
  /** URL path substrings, e.g. `"pricing"` or `"locations"`. */
  urlPatterns: string[];
  /** Topic words expected in title/H1/body copy. */
  keywords: string[];
}

/** The cheap half of a `Pack`: everything except the keyword matrix. */
export interface PackMeta {
  /** Stable slug used in settings, URLs and `src/packs/<id>/` directories. */
  id: string;
  /** Human-readable vertical name shown in the pack selector. */
  name: string;
  /** One-line summary shown under the name in the selector. */
  description: string;
  /** Page types this vertical's scoring and rules are tuned for. */
  pageTypes: PackPageType[];
  /** `{ onPage, schema, geoAi }` — must sum to 1 (checked by validatePack). */
  scoringWeights: ScoringWeights;
  /** Signals that suggest this pack for a given page (Task 2.4). */
  signals: PackSignals;
}

/** Pack used until the operator picks another one (extension settings). */
export const DEFAULT_PACK_ID = "hotel";

export const PACK_CATALOG: readonly PackMeta[] = [
  {
    id: "hotel",
    name: "Hotel & Hospitality",
    description:
      "Direct-booking scoring, franchise brand guardrails, and reservation schema for hotels and resorts.",
    pageTypes: ["home", "location", "booking", "contact"],
    scoringWeights: otaConfig.scoringWeights,
    signals: {
      schemaTypes: ["hotel", "lodgingbusiness", "resort", "accommodation"],
      urlPatterns: ["hotel", "rooms", "suites", "booking", "resort", "stay"],
      keywords: ["hotel", "room", "suite", "resort", "check-in", "stay"],
    },
  },
  {
    id: "ecommerce",
    name: "Ecommerce & Retail",
    description:
      "Product, offer and collection-page scoring for stores and marketplaces.",
    pageTypes: ["home", "product", "category", "contact"],
    scoringWeights: { onPage: 0.35, schema: 0.4, geoAi: 0.25 },
    signals: {
      schemaTypes: ["product", "offer", "brand", "collectionpage"],
      urlPatterns: ["product", "products", "shop", "store", "cart", "collection"],
      keywords: ["buy", "price", "cart", "add to", "shop", "shipping", "in stock"],
    },
  },
  {
    id: "local-business",
    name: "Local Business",
    description:
      "NAP consistency, service-area pages, and local pack visibility for single-location businesses.",
    pageTypes: ["home", "location", "contact", "article"],
    scoringWeights: { onPage: 0.4, schema: 0.3, geoAi: 0.3 },
    signals: {
      schemaTypes: ["localbusiness", "plumber", "electrician", "dentist", "restaurant", "homeandconstructionbusiness"],
      urlPatterns: ["locations", "location", "services", "service", "hours", "directions"],
      keywords: ["near me", "address", "hours", "phone", "directions", "appointment"],
    },
  },
  {
    id: "saas",
    name: "SaaS & Software",
    description:
      "Pricing, docs and integration scoring for product-led software sites.",
    pageTypes: ["home", "product", "article", "contact"],
    scoringWeights: { onPage: 0.4, schema: 0.25, geoAi: 0.35 },
    signals: {
      schemaTypes: ["softwareapplication", "webapplication", "mobileapplication"],
      urlPatterns: ["pricing", "features", "integrations", "docs", "api", "demo", "signup"],
      keywords: ["pricing", "free trial", "demo", "integration", "api", "dashboard", "subscription"],
    },
  },
  {
    id: "publisher",
    name: "Publisher & Media",
    description:
      "Article structure, E-E-A-T and syndication scoring for news and content sites.",
    pageTypes: ["home", "article", "category", "contact"],
    scoringWeights: { onPage: 0.3, schema: 0.3, geoAi: 0.4 },
    signals: {
      schemaTypes: ["article", "newsarticle", "blogposting", "publication"],
      urlPatterns: ["blog", "news", "article", "press", "insights"],
      keywords: ["blog", "news", "article", "read", "subscribe", "editorial"],
    },
  },
  {
    id: "finance",
    name: "Finance & Insurance",
    description:
      "YMYL-trust, product disclosure and structured-data scoring for financial sites.",
    pageTypes: ["home", "product", "article", "contact"],
    scoringWeights: { onPage: 0.35, schema: 0.4, geoAi: 0.25 },
    signals: {
      schemaTypes: ["financialproduct", "bank", "creditcard", "loan", "insuranceagency"],
      urlPatterns: ["rates", "loans", "accounts", "invest", "credit", "mortgage"],
      keywords: ["rate", "apr", "credit", "loan", "invest", "fee", "balance"],
    },
  },
];

/** Looks up one catalog entry; undefined for unknown ids. */
export function getPackMeta(id: string): PackMeta | undefined {
  return PACK_CATALOG.find((pack) => pack.id === id);
}
