import { describe, expect, it } from "vitest";
import { parseDiffSegments, stripDiffMarkers, validateSection } from "@/lib/hilton-validator";

describe("hilton-validator", () => {
  it("parses diff markers and computes final live character count", () => {
    const raw = "Welcome to ~~old~~ **new** Hotel X in Gainesville.";
    expect(parseDiffSegments(raw)).toEqual([
      { text: "Welcome to ", kind: "plain" },
      { text: "old", kind: "removed" },
      { text: " ", kind: "plain" },
      { text: "new", kind: "added" },
      { text: " Hotel X in Gainesville.", kind: "plain" },
    ]);
    expect(stripDiffMarkers(raw)).toBe("Welcome to new Hotel X in Gainesville.");
  });

  it("enforces hard character limits and keyword + 2 USPs presence", () => {
    const headline = validateSection({
      sectionId: "home-headline",
      text: "A".repeat(55),
      keyword: "gainesville hotel",
    });
    expect(headline.valid).toBe(false);
    expect(headline.overLimit).toBe(true);
    expect(headline.keywordPresent).toBe(false);

    const dining = validateSection({
      sectionId: "dining-main",
      text: "Enjoy **gainesville restaurants** with rooftop views and craft cocktails.",
      keyword: "gainesville restaurants",
      usps: ["Rooftop views", "Craft cocktails"],
    });
    expect(dining.valid).toBe(true);

    const outletGrandfathered = validateSection({
      sectionId: "dining-outlet",
      text: "A".repeat(350),
      grandfathered: true,
    });
    expect(outletGrandfathered.overLimit).toBe(false);
  });
});

