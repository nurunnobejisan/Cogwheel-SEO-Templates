import { describe, expect, it } from "vitest";
import { runAiSeoVisibilityReportTask } from "@/tasks/ai-seo-visibility-report";

describe("ai-seo-visibility-report task", () => {
  it("synthesizes quarterly organic search and AI engine citation visibility", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        executiveOverview: "Property achieved a 34% increase in organic impressions and established top-tier citation inclusion across 48% of tested generative queries.",
        combinedScore: 84,
        organicSeoTrends: {
          top3KeywordsCount: 14,
          top10KeywordsCount: 39,
          organicClicksEstimate: 12400,
          primaryGrowthDriver: "New historical destination content hub and restored ballroom wedding pages.",
        },
        geoPlatformMetrics: [
          {
            platform: "chatgpt_search",
            brandMentionRatePercent: 52,
            directCitationRatePercent: 44,
            topCitedUrl: "https://savannahresort.com/weddings/glasshouse",
            competitorComparisonText: "Outperformed local compset average citation rate of 28%.",
          },
          {
            platform: "google_ai_overviews",
            brandMentionRatePercent: 60,
            directCitationRatePercent: 56,
            topCitedUrl: "https://savannahresort.com/",
            competitorComparisonText: "Included in primary carousel for 'luxury historical hotels savannah'.",
          },
        ],
        topAiCitationsEarned: [
          {
            queryPrompt: "What are the best boutique hotels for weddings in Savannah?",
            platform: "chatgpt_search",
            citationUrl: "https://savannahresort.com/weddings/glasshouse",
            evidenceSnippet: "Direct citation highlighting restored 1890s glasshouse conservatory.",
          },
        ],
        strategicActionsNextQuarter: [
          "Deploy FAQPage structured data on all room showcase pages to expand AI Overview triggers",
          "Publish local culinary guide featuring executive chef partners",
        ],
      });

    const result = await runAiSeoVisibilityReportTask(
      {
        property: {
          name: "The Savannah Resort & Spa",
          brand: "Curio Collection by Hilton",
          city: "Savannah",
          state: "GA",
          url: "https://savannahresort.com",
        },
        quarterPeriod: "Q1 2027 Executive Review",
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.combinedScore).toBe(84);
    expect(result.output.organicSeoTrends.top3KeywordsCount).toBe(14);
    expect(result.output.geoPlatformMetrics).toHaveLength(2);
    expect(result.output.topAiCitationsEarned[0].platform).toBe("chatgpt_search");
  });
});
