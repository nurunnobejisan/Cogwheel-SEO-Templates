import { describe, expect, it } from "vitest";
import { runFinalSeoGeoProjectReportTask } from "@/tasks/final-seo-geo-project-report";

describe("final-seo-geo-project-report task", () => {
  it("compiles the complete end-of-engagement executive deliverable report", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        executiveSummary: "Over the 12-month engagement, SEO Studio transformed the hotel's search footprint, capturing 42 top-10 keyword rankings and resolving 100% of critical technical defects.",
        overallProjectScore: 95,
        deliverableMilestones: [
          {
            taskCategory: "On Page",
            taskName: "Keyword Research & 78-Matrix Mapping",
            status: "verified_live",
            primaryImpact: "Captured 12 new primary revenue keywords for dining and weddings.",
          },
          {
            taskCategory: "Technical",
            taskName: "Full-Stack Technical Audit & Remediation",
            status: "completed",
            primaryImpact: "Clean canonicalization and sub-2.5s LCP Core Web Vital achievement.",
          },
          {
            taskCategory: "Reporting",
            taskName: "Monthly & Quarterly AI/GEO Presentations",
            status: "completed",
            primaryImpact: "Delivered 12 monthly decks and 4 quarterly executive reviews to ownership.",
          },
        ],
        quantifiableResults: {
          keywordsInTop10: 42,
          technicalIssuesResolvedPercent: 100,
          organicTrafficGrowthPercent: 38.5,
          aiEngineMentionRatePercent: 62,
        },
        ongoingMaintenanceChecklist: [
          "Quarterly review of schema structured data against Schema.org releases",
          "Monthly check of NAP consistency on Google Maps and Apple Maps",
          "Continuous GEO monitoring of top banquet and meeting prompts",
        ],
        strategicRoadmapNext12Months: [
          "Expand localized event landing pages for downtown music festival partnerships",
          "Launch dedicated corporate retreat micro-experience hub",
        ],
      });

    const result = await runFinalSeoGeoProjectReportTask(
      {
        property: {
          name: "The Austin Heritage Hotel",
          brand: "Tapestry Collection by Hilton",
          city: "Austin",
          state: "TX",
          url: "https://austinheritage.com",
        },
        engagementStartDate: "2026-01-01",
        engagementEndDate: "2026-12-31",
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.overallProjectScore).toBe(95);
    expect(result.output.deliverableMilestones).toHaveLength(3);
    expect(result.output.quantifiableResults.keywordsInTop10).toBe(42);
    expect(result.output.ongoingMaintenanceChecklist).toHaveLength(3);
  });
});
