import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculatePixelWidth,
  smartTrimTitle,
  analyzeSerpSnippet,
  DEFAULT_SERP_LIMITS
} from "../../validators/serpOptimizer.ts";

describe("Vitest/TS: SERP Pixel-Width Truncation & Optimization", () => {
  it("strictly enforces 580px desktop ceiling and 920px mobile ceiling", () => {
    assert.strictEqual(DEFAULT_SERP_LIMITS.desktopTitleMaxPx, 580);
    assert.strictEqual(DEFAULT_SERP_LIMITS.mobileTitleMaxPx, 920);
  });

  it("identifies desktop overflow at > 580px while allowing mobile fit under 920px", () => {
    // Approx 650px title: exceeds desktop (580px) but fits mobile (920px)
    const midTitle = "Luxury Boutique Hotel in Downtown Denver Colorado with Rooftop Lounge & Spa";
    const width = calculatePixelWidth(midTitle);

    assert(width > 580, `Width ${width}px should exceed 580px desktop limit`);
    assert(width < 920, `Width ${width}px should be within 920px mobile limit`);

    const analysis = analyzeSerpSnippet(midTitle, "A great hotel description with enough character length.");
    assert.strictEqual(analysis.title.desktopOverflow, true);
    assert.strictEqual(analysis.title.mobileOverflow, false);
  });

  it("truncates titles cleanly at word boundaries with ellipsis", () => {
    const longTitle = "Historic Downtown Denver Accommodations with Valet Parking and Mountain Views";
    const trimmed = smartTrimTitle(longTitle, 400);

    assert(calculatePixelWidth(trimmed) <= 400);
    assert(trimmed.endsWith("..."));
    // Ensure no broken words
    const words = trimmed.replace("...", "").trim().split(/\s+/);
    assert.strictEqual(words[words.length - 1], "Accommodations");
  });

  it("peels off brand suffix before cutting primary keyword phrases", () => {
    const brand = " | The Curtis Denver - DoubleTree by Hilton";
    const title = "Exclusive Executive Penthouse Suites" + brand;
    const trimmed = smartTrimTitle(title, 450, brand);

    assert(!trimmed.includes("DoubleTree by Hilton"));
    assert(trimmed.includes("Exclusive Executive Penthouse Suites"));
  });
});
