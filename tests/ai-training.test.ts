import { describe, expect, it } from "vitest";
import {
  addTrainingRule,
  deleteTrainingRule,
  formatTrainingContext,
  listTrainingRules,
  toggleTrainingRule,
} from "@/core/training";

describe("AI Training Rules Store", () => {
  it("seeds Michael's soft-brand vanity site rule and global grounding rule", async () => {
    const rules = await listTrainingRules();
    expect(rules.some((r) => r.id === "seed-vanity-site-rule")).toBe(true);
    expect(rules.some((r) => r.id === "seed-grounded-facts")).toBe(true);

    const reportContext = await formatTrainingContext("seo-only-visibility-report");
    expect(reportContext).toContain("vanity site");
    expect(reportContext).toContain("Strictly Grounded Property Claims");
  });

  it("seeds Cogwheel keyword research rules from client deliverable training data", async () => {
    const rules = await listTrainingRules("keyword-research");
    expect(rules.some((r) => r.id === "seed-kw-beachfront-oceanfront-bucketing")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-low-kd-amenity-threshold")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-local-geo-anchoring")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-small-market-metro-feeder")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-specialty-venue-hierarchy")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-cogwheel-3step-rationale")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-neighborhood-geo-anchoring")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-landmark-proximity-anchoring")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-colloquial-vernacular-matching")).toBe(true);
    expect(rules.some((r) => r.id === "seed-kw-existing-rank-momentum")).toBe(true);

    const kwContext = await formatTrainingContext("keyword-research");
    expect(kwContext).toContain("Beachfront, Oceanfront & Coastal Keyword Bucketing");
    expect(kwContext).toContain("Secondary & Amenity Page Low-KD (< 45)");
    expect(kwContext).toContain("Local/City Geo-Anchoring Over State-Wide Generics");
    expect(kwContext).toContain("Cogwheel Client Rationale Structure");
    expect(kwContext).toContain("Metropolitan Cultural/Historic Neighborhood Geo-Anchoring");
    expect(kwContext).toContain("High-Intent Landmark & Demand Generator Proximity Anchoring");
    expect(kwContext).toContain("Colloquial & Regional Vernacular Abbreviation Matching");
  });

  it("supports adding, toggling, and deleting custom training rules", async () => {
    const created = await addTrainingRule({
      taskId: "title-meta",
      title: "Brand Suffix Style",
      ruleText: "Always keep property name before city in title tags.",
      exampleGood: "The Nines Portland | Luxury Hotel Downtown",
    });

    let titleContext = await formatTrainingContext("title-meta");
    expect(titleContext).toContain("Brand Suffix Style");

    await toggleTrainingRule(created.id, false);
    titleContext = await formatTrainingContext("title-meta");
    expect(titleContext).not.toContain("Brand Suffix Style");

    const removed = await deleteTrainingRule(created.id);
    expect(removed).toBe(true);
  });
});

