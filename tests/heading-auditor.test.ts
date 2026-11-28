import { describe, expect, it } from "vitest";
import {
  auditHeadingOutline,
  detectNonSemanticHeading,
  extractDomain,
  getHeadingExcelPath,
  getHeadingOptimizedJsonPath,
  loadSiteHeadingOptimized,
  toTitleCase,
} from "../src/scoring/heading-auditor";

describe("HeadingAuditor TypeScript Engine", () => {
  it("converts strings to proper title case", () => {
    expect(toTitleCase("WELCOME TO EXAMPLE HOTEL")).toBe("Welcome to the Nines");
    expect(toTitleCase("OUR LUXURY AMENITIES IN PORTLAND")).toBe("Our Luxury Amenities in Portland");
    expect(toTitleCase("steakhouse")).toBe("The Steakhouse");
  });

  it("detects non-semantic stat counters and metrics", () => {
    expect(detectNonSemanticHeading("331 Guest Rooms").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("14,000 Sq Ft Event Space").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("150+ Rooms").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("Guest Rooms").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("Square Feet").isNonSemantic).toBe(true);
  });

  it("detects non-semantic badges, testimonials, and footer headers", () => {
    expect(detectNonSemanticHeading("1 King Bed").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("City View").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading('"Best hotel stay in Portland"').isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("What Our Guests Say").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("Explore").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("Reach Us").isNonSemantic).toBe(true);
    expect(detectNonSemanticHeading("Quick Links").isNonSemantic).toBe(true);
  });

  it("allows legitimate semantic headings to pass", () => {
    expect(detectNonSemanticHeading("Luxury Accommodations & Suites").isNonSemantic).toBe(false);
    expect(detectNonSemanticHeading("Downtown Portland Dining").isNonSemantic).toBe(false);
    expect(detectNonSemanticHeading("Art Collection & Heritage").isNonSemantic).toBe(false);
  });

  it("audits page heading hierarchy and repairs multiple H1 and skipped levels", () => {
    const rawHeadings = [
      { level: "H2", text: "OVERVIEW" }, // Inverted H2
      { level: "H1", text: "WELCOME TO EXAMPLE HOTEL" },
      { level: "H3", text: "Deluxe King Room" }, // Skipped level H1 -> H3
      { level: "H1", text: "PORTLAND LUXURY HOTEL" }, // Duplicate H1
      { level: "H3", text: "1 King Bed" }, // Badge
      { level: "H2", text: "331 Guest Rooms" }, // Stat
      { level: "H2", text: "Explore" }, // Footer
    ];

    const audit = auditHeadingOutline(rawHeadings, {
      pageUrl: "https://example-hotel.com/",
      primaryKeyword: "Example Hotel Portland",
      pageTitle: "Luxury Hotel in Downtown Portland | Example Hotel",
      brandName: "Example Hotel",
      category: "HOME",
    });

    expect(audit.h1CountBefore).toBe(2);
    expect(audit.h1CountAfter).toBe(1);
    expect(audit.issuesFound).toContain("multiple_h1");
    expect(audit.issuesFound).toContain("inverted_hierarchy");
    expect(audit.issuesFound).toContain("skipped_level");
    expect(audit.issuesFound).toContain("non_semantic_badge");
    expect(audit.issuesFound).toContain("non_semantic_stat");
    expect(audit.issuesFound).toContain("non_semantic_footer");

    // Single H1 established
    const h1Items = audit.headings.filter((h) => h.newHeadingLevel === "H1");
    expect(h1Items.length).toBe(1);
    expect(h1Items[0].newHeadline).toContain("Example Hotel Portland");

    // Duplicate H1 demoted to H2
    const demotedH1 = audit.headings.filter(
      (h) => h.oldHeadingLevel === "H1" && h.newHeadingLevel === "H2"
    );
    expect(demotedH1.length).toBe(1);

    // Inverted H2, badge, stat, and footer demoted to TEXT
    const textItems = audit.headings.filter((h) => h.newHeadingLevel === "TEXT");
    expect(textItems.length).toBeGreaterThanOrEqual(4);
  });

  it("resolves deliverable paths correctly", () => {
    const excelPath = getHeadingExcelPath("https://thenines.com");
    const jsonPath = getHeadingOptimizedJsonPath("https://thenines.com");

    expect(excelPath).toContain("output/thenines.com/03-heading-structure-optimization.xlsx");
    expect(jsonPath).toContain("output/thenines.com/site-heading-optimized.json");
  });
});
