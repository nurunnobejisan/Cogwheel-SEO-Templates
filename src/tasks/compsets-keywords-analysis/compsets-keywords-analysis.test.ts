import { describe, expect, it } from "vitest";
import { runCompsetsKeywordsAnalysisTask } from "@/tasks/compsets-keywords-analysis";

describe("compsets-keywords-analysis task", () => {
  it("runs competitive keyword gap analysis and returns structured opportunity scores", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        gaps: [
          {
            keyword: "boutique hotel downtown austin",
            searchVolume: 2400,
            keywordDifficulty: 38,
            intent: "commercial",
            competitorDomain: "competitorhotel.com",
            competitorEstimatedRank: 3,
            propertyCurrentRank: 18,
            opportunityScore: 88,
            strategicRationale: "High local conversion intent with manageable KD under 40.",
          },
          {
            keyword: "wedding venue austin hill country",
            searchVolume: 1600,
            keywordDifficulty: 32,
            intent: "transactional",
            competitorDomain: "competitorhotel.com",
            competitorEstimatedRank: 2,
            propertyCurrentRank: null,
            opportunityScore: 92,
            strategicRationale: "High banquet & catering revenue opportunity.",
          },
        ],
        marketSummary: "Target property lags behind compset in venue and luxury query visibility.",
        topImmediateWins: [
          "Launch dedicated Austin wedding venue landing page with Schema",
          "Optimize downtown boutique metadata to target top 5 placement",
        ],
      });

    const result = await runCompsetsKeywordsAnalysisTask(
      {
        property: {
          name: "The Austin Heritage Hotel",
          brand: "Tapestry Collection by Hilton",
          city: "Austin",
          state: "TX",
          url: "https://austinheritage.com",
        },
        compsetDomains: ["competitorhotel.com", "austinluxuryresort.com"],
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.totalGaps).toBe(2);
    expect(result.output.averageOpportunityScore).toBe(90);
    expect(result.output.topImmediateWins).toHaveLength(2);
    expect(result.output.gaps[0].keyword).toBe("boutique hotel downtown austin");
  });

  it("throws validation error on missing required compset domains", async () => {
    await expect(
      runCompsetsKeywordsAnalysisTask({
        property: {
          name: "Test Hotel",
          city: "Miami",
          state: "FL",
        },
        compsetDomains: [],
      }),
    ).rejects.toThrow("Invalid request");
  });
});
