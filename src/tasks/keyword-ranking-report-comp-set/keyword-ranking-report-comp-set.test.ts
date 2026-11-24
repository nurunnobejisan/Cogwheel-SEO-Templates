import { describe, expect, it } from "vitest";
import { runKeywordRankingReportCompSetTask } from "@/tasks/keyword-ranking-report-comp-set";

describe("keyword-ranking-report-comp-set task", () => {
  it("tracks keyword ranks against compset with share of voice metrics", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        rankings: [
          {
            keyword: "downtown nashville luxury hotel",
            searchVolume: 5400,
            category: "Luxury",
            propertyRank: 4,
            propertyPreviousRank: 7,
            compsetRanks: [
              { domain: "nashvilleritz.com", rank: 1 },
              { domain: "grandhyattnashville.com", rank: 3 },
            ],
            serpFeatures: ["Local Pack", "People Also Ask"],
            bestCompetitor: "nashvilleritz.com",
            visibilityIndex: 82,
          },
          {
            keyword: "boutique hotel broadway nashville",
            searchVolume: 3200,
            category: "Boutique",
            propertyRank: 2,
            propertyPreviousRank: 2,
            compsetRanks: [
              { domain: "nashvilleritz.com", rank: 6 },
              { domain: "grandhyattnashville.com", rank: 5 },
            ],
            serpFeatures: ["Local Pack", "AI Overview"],
            bestCompetitor: "grandhyattnashville.com",
            visibilityIndex: 94,
          },
        ],
        summary: {
          top3Count: 1,
          top10Count: 2,
          averageRank: 3.0,
          propertyShareOfVoice: 42,
        },
        strategicInsights: [
          "Target property leads in Broadway boutique queries over Ritz-Carlton",
          "Closing rank gap on main luxury head term from #7 to #4",
        ],
      });

    const result = await runKeywordRankingReportCompSetTask(
      {
        property: {
          name: "The Hermitage Hotel Nashville",
          brand: "Independent Luxury",
          city: "Nashville",
          state: "TN",
          url: "https://thehermitagehotel.com",
        },
        compsetDomains: ["nashvilleritz.com", "grandhyattnashville.com"],
        trackedKeywords: [
          "downtown nashville luxury hotel",
          "boutique hotel broadway nashville",
        ],
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.totalKeywordsTracked).toBe(2);
    expect(result.output.summary.top3Count).toBe(1);
    expect(result.output.summary.propertyShareOfVoice).toBe(42);
    expect(result.output.rankings[0].visibilityIndex).toBe(82);
  });
});
