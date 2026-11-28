/**
 * Canonical GEO engine registry.
 *
 * The four scorers below answer different questions and keep their own
 * formulas. They are not interchangeable copies: collapsing their numbers
 * would change what the UI and reports say. This namespace gives each one a
 * single provenance label so a "measured" number can never be mixed with a
 * simulated one.
 *
 * Re-exports keep every existing import path working.
 */

import type { DataProvenance } from "@/core/data-policy";

export const GEO_ENGINE_REGISTRY = {
  pageCitability: {
    concept: "On-page citability from fetched HTML facts (schema, headings, words, links, statistics)",
    implementation: "rules/geo/citability.ts",
    provenance: "estimated",
    formula: "weighted heuristic: 25 structured / 25 answers / 15 entity / 15 depth / 20 citations",
  },
  hotelFactCitationReadiness: {
    concept: "Hotel-fact citation readiness from extracted property facts",
    implementation: "python/analyzer/geo_scorer.py",
    provenance: "estimated",
    formula: "0.40 fact density / 0.35 Q&A formatting / 0.25 entity completeness",
  },
  keywordPageConfidence: {
    concept: "Keyword-to-page confidence from supplied keyword and matrix data",
    implementation: "src/lib/engine/geo-seo.ts",
    provenance: "estimated",
    formula: "base 70 + volume/KD/secondary adjustments - flag penalty",
  },
  simulatedEngineVisibility: {
    concept: "Simulated AI-engine citation visibility (opt-in demo data only)",
    implementation: "src/core/open-seo/ai-visibility.ts",
    provenance: "simulated",
    formula: "mentioned engines / engines, averaged across prompts",
  },
} as const;

export type GeoEngineKey = keyof typeof GEO_ENGINE_REGISTRY;

export function geoEngineProvenance(key: GeoEngineKey): DataProvenance {
  return GEO_ENGINE_REGISTRY[key].provenance;
}

export { buildCitabilityScore } from "../../../../rules/geo/citability.ts";
export { analyzeGeoSeo, classifyIntent, isBrandedKeyword } from "../geo-seo.ts";
export { evaluateAiVisibility } from "../../../core/open-seo/ai-visibility.ts";
