import { describe, it, expect } from "vitest";
import {
  COGWHEEL_OPTIMAL_AUDIT_DATA,
  calculateSeoScores,
} from "../chrome-extension/src/data/cogwheelTemplates";

describe("Cogwheel SEO Templates - 100/100 Optimal Audit Evaluation", () => {
  it("scores 100/100 across all 4 radial gauges on Cogwheel-SEO-Templates", () => {
    const scores = calculateSeoScores(COGWHEEL_OPTIMAL_AUDIT_DATA);

    // Verify all 4 radial gauges
    expect(scores.overall).toBe(100);
    expect(scores.onPage).toBe(100);
    expect(scores.schemaTechnical).toBe(100);
    expect(scores.geoAiReadiness).toBe(100);

    // Verify Grade and Grade Color
    expect(scores.grade).toBe("A+");
    expect(scores.gradeColor).toBe("#10b981");

    // Verify quick wins are completely resolved (0 remaining)
    expect(scores.quickWins).toHaveLength(0);
    expect(scores.passedGates).toBe(10);
    expect(scores.totalGates).toBe(10);
  });

  it("verifies accurate pixel width calculations within Google SERP limits", () => {
    // Title within 580px desktop limit
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.titlePixelWidth).toBeLessThanOrEqual(580);
    // Meta Description within 920px limit
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.metaDescPixelWidth).toBeLessThanOrEqual(920);
    // Title char count within 45-65 chars
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.title.length).toBeGreaterThanOrEqual(45);
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.title.length).toBeLessThanOrEqual(65);
    // Meta char count within 120-160 chars
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.metaDesc.length).toBeGreaterThanOrEqual(120);
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.metaDesc.length).toBeLessThanOrEqual(160);
  });

  it("verifies rich schemas for Hotel and FAQPage GEO AI readiness", () => {
    const schemaTypes = COGWHEEL_OPTIMAL_AUDIT_DATA.schemas.map((s) => s["@type"]);
    expect(schemaTypes).toContain("Hotel");
    expect(schemaTypes).toContain("FAQPage");
    expect(schemaTypes).toContain("BreadcrumbList");
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.words).toBeGreaterThanOrEqual(450);
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.hasOgTitle).toBe(true);
    expect(COGWHEEL_OPTIMAL_AUDIT_DATA.hasOgImage).toBe(true);
  });
});
