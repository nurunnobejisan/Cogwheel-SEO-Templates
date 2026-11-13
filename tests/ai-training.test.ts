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

