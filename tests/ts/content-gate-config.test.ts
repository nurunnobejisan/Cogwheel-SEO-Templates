import assert from "node:assert/strict";
import test from "node:test";

import contentGate from "../../shared/engine/content-gate.json";
import { DEFAULT_UNIQUENESS_CONFIG } from "../../validators/uniquenessGate.ts";

test("TypeScript thin-content defaults come from the shared config", () => {
  const expectedSimilarity = process.env.MAX_SIMILARITY_THRESHOLD
    ? parseFloat(process.env.MAX_SIMILARITY_THRESHOLD)
    : contentGate.maxSimilarityThreshold;
  const expectedMinWords = process.env.MIN_UNIQUE_WORD_COUNT
    ? parseInt(process.env.MIN_UNIQUE_WORD_COUNT, 10)
    : contentGate.minUniqueWordCount;

  assert.equal(DEFAULT_UNIQUENESS_CONFIG.maxSimilarityThreshold, expectedSimilarity);
  assert.equal(DEFAULT_UNIQUENESS_CONFIG.minUniqueWordCount, expectedMinWords);
  assert.equal(DEFAULT_UNIQUENESS_CONFIG.ngramSize, contentGate.ngramSize);
  assert.deepEqual(
    DEFAULT_UNIQUENESS_CONFIG.boilerplatePhrases,
    [...contentGate.boilerplatePhrases],
  );
});

test("shared config keeps the historically verified values", () => {
  assert.equal(contentGate.maxSimilarityThreshold, 0.7);
  assert.equal(contentGate.minUniqueWordCount, 250);
  assert.equal(contentGate.ngramSize, 3);
  assert.equal(contentGate.boilerplatePhrases.length, 8);
});
