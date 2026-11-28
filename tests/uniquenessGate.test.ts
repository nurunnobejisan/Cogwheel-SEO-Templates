import { describe, it } from "node:test";
import assert from "node:assert";
import {
  cleanContent,
  countWords,
  generateNgrams,
  calculateJaccardSimilarity,
  auditContentUniqueness,
  shouldRenderSection
} from "../validators/uniquenessGate.ts";

describe("Day 6: Anti-Thin-Content Gate & Uniqueness Scorer", () => {
  it("cleans content and removes common boilerplate phrases", () => {
    const raw = `
      <h1>Downtown Hotel</h1>
      <p>Enjoy our luxury rooms in Denver.</p>
      <footer>All rights reserved. Privacy Policy. Powered by SEO Studio.</footer>
    `;
    const cleaned = cleanContent(raw, ["all rights reserved", "privacy policy", "powered by seo studio"]);
    assert(!cleaned.includes("rights reserved"));
    assert(!cleaned.includes("privacy policy"));
    assert(cleaned.includes("luxury rooms in denver"));
  });

  it("calculates accurate Jaccard similarity using n-grams", () => {
    const text1 = "boutique hotel in downtown denver colorado with rooftop dining and cocktail lounge";
    const text2 = "boutique hotel in downtown denver colorado with rooftop dining and craft brewery";
    const text3 = "beachfront resort and spa in miami florida with ocean view balcony";

    const ngrams1 = generateNgrams(text1, 3);
    const ngrams2 = generateNgrams(text2, 3);
    const ngrams3 = generateNgrams(text3, 3);

    const sim12 = calculateJaccardSimilarity(ngrams1, ngrams2);
    const sim13 = calculateJaccardSimilarity(ngrams1, ngrams3);

    assert(sim12 > 0.5, `Expected high similarity between related texts, got ${sim12}`);
    assert.strictEqual(sim13, 0.0, "Expected zero similarity between completely different texts");
  });

  it("flags thin content when non-boilerplate word count is below threshold", () => {
    const pages = [
      {
        id: "page-thin",
        url: "https://example.com/thin/",
        content: "<p>Short page description with very few words.</p>"
      },
      {
        id: "page-substantial",
        url: "https://example.com/substantial/",
        content: "<p>" + "This is a detailed and comprehensive guide about luxury hospitality. ".repeat(40) + "</p>"
      }
    ];

    const audit = auditContentUniqueness(pages, { minUniqueWordCount: 100 });
    const thinResult = audit.results.find((r) => r.id === "page-thin");
    const subResult = audit.results.find((r) => r.id === "page-substantial");

    assert(thinResult);
    assert.strictEqual(thinResult.isThinContent, true);
    assert.strictEqual(thinResult.passed, false);

    assert(subResult);
    assert.strictEqual(subResult.isThinContent, false);
    assert.strictEqual(subResult.passed, true);
  });

  it("flags duplicate pages when similarity exceeds 70% threshold", () => {
    const baseContent = "The Grand Hotel offers upscale suites in the heart of downtown with valet parking, rooftop pool, and fine dining. ".repeat(25);
    const nearlyIdenticalContent = baseContent + "Special weekend discounts apply.";

    const pages = [
      { id: "page-original", url: "https://example.com/page-1/", content: baseContent },
      { id: "page-clone", url: "https://example.com/page-2/", content: nearlyIdenticalContent }
    ];

    const audit = auditContentUniqueness(pages, { maxSimilarityThreshold: 0.70 });
    assert.strictEqual(audit.allPassed, false);
    assert(audit.comparisons.some((c) => c.isDuplicate));
  });

  it("conditional section guard prevents rendering empty or meaningless data structures", () => {
    assert.strictEqual(shouldRenderSection(null), false);
    assert.strictEqual(shouldRenderSection(""), false);
    assert.strictEqual(shouldRenderSection([]), false);
    assert.strictEqual(shouldRenderSection([{ name: "" }]), false);
    assert.strictEqual(shouldRenderSection([{ name: "Rooftop Pool" }]), true);
  });
});
