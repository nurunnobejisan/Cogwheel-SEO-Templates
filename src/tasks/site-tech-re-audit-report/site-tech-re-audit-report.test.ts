import { describe, expect, it } from "vitest";
import { runSiteTechReAuditReportTask } from "@/tasks/site-tech-re-audit-report";

describe("site-tech-re-audit-report task", () => {
  it("computes issue resolution rate and tracks regression deltas", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        metrics: {
          resolvedCount: 3,
          persistentCount: 1,
          regressionCount: 0,
          resolutionRatePercent: 75,
        },
        issueDeltas: [
          {
            url: "https://orlandoresort.com/dining/steakhouses",
            issueType: "missing_meta_description",
            status: "resolved",
            previousEvidence: "Meta description was empty",
            currentEvidence: "Meta description present with 152 chars",
            impact: "Medium",
            resolutionVerification: "Verified valid snippet tag with primary dining keyword.",
          },
          {
            url: "https://orlandoresort.com/amenities/spa",
            issueType: "broken_internal_links",
            status: "persistent",
            previousEvidence: "Link to booking engine returned 404",
            currentEvidence: "Still returning 404 status code",
            impact: "High",
            resolutionVerification: "Engineering ticket pending deployment.",
          },
        ],
        overallHealthStatus: "significant_improvement",
        executiveSummary: "Property resolved 75% of baseline technical defects including all duplicate canonicals.",
        nextActionChecklist: [
          "Deploy fix for spa booking link 404 redirect",
        ],
      });

    const result = await runSiteTechReAuditReportTask(
      {
        property: {
          name: "Orlando Luxury Resort",
          brand: "Waldorf Astoria",
          city: "Orlando",
          state: "FL",
          url: "https://orlandoresort.com",
        },
        baselineDate: "2026-10-15",
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.metrics.resolutionRatePercent).toBe(75);
    expect(result.output.overallHealthStatus).toBe("significant_improvement");
    expect(result.output.issueDeltas).toHaveLength(2);
  });
});
