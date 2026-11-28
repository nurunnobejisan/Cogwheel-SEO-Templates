import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeGeoSeo,
  buildCitabilityScore,
  evaluateAiVisibility,
  GEO_ENGINE_REGISTRY,
  geoEngineProvenance,
} from "../../src/lib/engine/geo/index.ts";
import { analyzeGeoSeo as directGeoSeo } from "../../src/lib/engine/geo-seo.ts";
import { evaluateAiVisibility as directVisibility } from "../../src/core/open-seo/ai-visibility.ts";
import { buildCitabilityScore as directCitability } from "../../rules/geo/citability.ts";

test("the registry labels four distinct GEO concepts", () => {
  assert.deepEqual(Object.keys(GEO_ENGINE_REGISTRY), [
    "pageCitability",
    "hotelFactCitationReadiness",
    "keywordPageConfidence",
    "simulatedEngineVisibility",
  ]);
  assert.equal(geoEngineProvenance("pageCitability"), "estimated");
  assert.equal(geoEngineProvenance("hotelFactCitationReadiness"), "estimated");
  assert.equal(geoEngineProvenance("keywordPageConfidence"), "estimated");
  assert.equal(geoEngineProvenance("simulatedEngineVisibility"), "simulated");

  for (const entry of Object.values(GEO_ENGINE_REGISTRY)) {
    assert.ok(entry.concept.length > 0);
    assert.ok(entry.implementation.length > 0);
    assert.ok(entry.formula.length > 0);
  }
});

test("canonical re-exports keep the original functions", () => {
  assert.equal(buildCitabilityScore, directCitability);
  assert.equal(analyzeGeoSeo, directGeoSeo);
  assert.equal(evaluateAiVisibility, directVisibility);
});

test("AI visibility stays honest when simulation is disabled", () => {
  const previous = process.env.ALLOW_SIMULATED_DATA;
  delete process.env.ALLOW_SIMULATED_DATA;
  try {
    const result = evaluateAiVisibility("example.com", "Example Hotel", [
      { prompt: "best hotel in example city" },
    ]);
    assert.equal(result.overallVisibilityScore, 0);
    assert.equal(result.totalPromptsAudited, 0);
    assert.equal(result.dataAvailable, false);
    assert.deepEqual(result.prompts, []);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_SIMULATED_DATA;
    else process.env.ALLOW_SIMULATED_DATA = previous;
  }
});
