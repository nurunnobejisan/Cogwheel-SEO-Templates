import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculatePixelWidth,
  smartTrimTitle,
  analyzeSerpSnippet,
  DEFAULT_SERP_LIMITS
} from "../validators/serpOptimizer.ts";

describe("Day 5: SERP Pixel-Width Optimizer", () => {
  it("accurately differentiates wide and narrow character widths", () => {
    const wideString = "WWWWWWWWWW"; // 10 W's
    const narrowString = "iiiiiiiiii"; // 10 i's

    const widePx = calculatePixelWidth(wideString);
    const narrowPx = calculatePixelWidth(narrowString);

    assert(widePx > narrowPx * 3, `Expected ${widePx} to be significantly greater than ${narrowPx}`);
  });

  it("detects desktop title overflow beyond 580px ceiling", () => {
    const normalTitle = "Best Boutique Hotel in Downtown Denver | The Curtis";
    const overlyLongTitle = "The Absolute Most Exclusive Luxury Resort & Spa Hotel Located Right in the Heart of Historic Downtown Florence Alabama with Waterfront River Views";

    const normalAnalysis = analyzeSerpSnippet(normalTitle, "A great description for testing purposes that is long enough.");
    const overflowAnalysis = analyzeSerpSnippet(overlyLongTitle, "A great description for testing purposes that is long enough.");

    assert.strictEqual(normalAnalysis.title.desktopOverflow, false);
    assert.strictEqual(overflowAnalysis.title.desktopOverflow, true);
    assert(overflowAnalysis.warnings.some((w) => w.includes("desktop SERP width")));
  });

  it("smart trims titles at word boundaries without breaking mid-word", () => {
    const longTitle = "Luxury Hotel Suites in Downtown Denver with Complimentary Breakfast and Valet Parking";
    const trimmed = smartTrimTitle(longTitle, 300);

    assert(calculatePixelWidth(trimmed) <= 300);
    assert(trimmed.endsWith("..."));
    // Ensure it didn't cut inside a word like "Down..." or "Lux..."
    assert(!trimmed.includes("Down ..."));
  });

  it("removes brand suffix before cutting important keyword phrases", () => {
    const title = "Executive Penthouse Suites in Historic Downtown | The Grand Hotel Resort & Spa";
    const trimmed = smartTrimTitle(title, 450, " | The Grand Hotel Resort & Spa");

    // It should strip the long brand suffix first
    assert(!trimmed.includes("The Grand Hotel Resort & Spa"));
    assert(trimmed.includes("Executive Penthouse Suites"));
  });

  it("warns when meta descriptions are too short or exceed maximum ceiling", () => {
    const shortDesc = "Short description.";
    const validDesc = "Book direct at The Curtis Denver for luxury boutique accommodations in downtown Denver with on-site dining, modern suites, and complimentary high-speed Wi-Fi.";
    const longDesc = "A".repeat(200);

    const shortAnalysis = analyzeSerpSnippet("Title", shortDesc);
    assert.strictEqual(shortAnalysis.metaDescription.isTooShort, true);

    const validAnalysis = analyzeSerpSnippet("Title", validDesc);
    assert.strictEqual(validAnalysis.metaDescription.isTooShort, false);
    assert.strictEqual(validAnalysis.metaDescription.isTooLong, false);

    const longAnalysis = analyzeSerpSnippet("Title", longDesc);
    assert.strictEqual(longAnalysis.metaDescription.isTooLong, true);
  });
});
