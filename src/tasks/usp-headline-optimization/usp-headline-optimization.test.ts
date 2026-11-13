import { describe, expect, it } from "vitest";
import { buildSectionCopyPrompt } from "./prompt";
import { HILTON_SECTION_IDS, uspHeadlineInputSchema } from "./schema";
import { collectSectionFlags, validateSingleSection } from "./validator";

describe("tasks/usp-headline-optimization", () => {
  it("registers all 13 Hilton content sections and validates schema", () => {
    expect(HILTON_SECTION_IDS).toHaveLength(13);
    const parsed = uspHeadlineInputSchema.safeParse({
      property: {
        name: "Hotel X Gainesville",
        brand: "Tapestry Collection by Hilton",
        city: "Gainesville",
        state: "FL",
        allowedLocations: [],
        excludedLocations: [],
      },
      matrix: [],
      discoveryNotes: { demandGenerators: "UF Campus", usps: ["Rooftop pool", "Pet friendly"] },
      liveCopy: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("builds section prompt with character limit and strict diff instructions", () => {
    const { system, prompt } = buildSectionCopyPrompt({
      sectionId: "home-headline",
      property: {
        name: "Hotel X",
        url: "https://hotelx.example.com",
        brand: "Tapestry",
        city: "Gainesville",
        state: "FL",
        notes: "",
        petFriendly: true,
        attractions: [],
        rationaleStyle: "catbird",
        templateDocUrl: "",
        allowedLocations: [],
        excludedLocations: [],
      },
      keyword: "boutique hotel gainesville",
      demandGenerators: "UF",
      usps: ["Rooftop pool"],
      liveCopy: "Old Headline",
      grandfatheredOutlet: false,
    });

    expect(system).toContain("STRICT DIFF MODE");
    expect(system).toContain("<= 50 characters");
    expect(prompt).toContain("Old Headline");
  });

  it("collects section validation failures into Flag Summary", () => {
    const bad = validateSingleSection({
      sectionId: "home-headline",
      text: "A".repeat(80),
      keyword: "missing-kw",
    });
    expect(bad.valid).toBe(false);

    const outcome = collectSectionFlags({
      sections: { "home-headline": "A".repeat(80) },
      validation: { "home-headline": bad },
      retries: { "home-headline": 2 },
    });
    expect(outcome.flags.length).toBeGreaterThan(0);
    expect(outcome.flags[0].section).toBe("home-headline");
  });
});
