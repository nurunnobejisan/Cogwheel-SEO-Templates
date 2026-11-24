import { describe, expect, it } from "vitest";
import { runCompetitorsBacklinkAnalysisTask } from "@/tasks/competitors-backlink-analysis";

describe("competitors-backlink-analysis task", () => {
  it("evaluates competitor backlink gaps and authority opportunities", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        backlinkShareOfVoice: {
          propertyEstimatedRefDomains: 140,
          compsetAverageRefDomains: 310,
          estimatedBacklinkGap: 170,
        },
        referringDomainGaps: [
          {
            domain: "visitcharleston.com",
            domainAuthority: 68,
            category: "Official Tourism",
            competitorLinksCount: 3,
            competitorsLinking: ["competitorresort.com"],
            propertyHasLink: false,
            acquisitionDifficulty: "Easy",
            recommendedAnchorText: "luxury boutique hotel in Charleston historic district",
            targetPageRecommendation: "https://thehotel.com",
          },
        ],
        highValueDirectoryCitations: [
          "Historic Hotels of America",
          "Southern Living Hotel Directory",
        ],
        strategicRecommendations: [
          "Claim official Visit Charleston partner listing page",
        ],
      });

    const result = await runCompetitorsBacklinkAnalysisTask(
      {
        property: {
          name: "The Historic Charleston Inn",
          brand: "Curio Collection by Hilton",
          city: "Charleston",
          state: "SC",
          url: "https://thehotel.com",
        },
        compsetDomains: ["competitorresort.com"],
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.backlinkShareOfVoice.estimatedBacklinkGap).toBe(170);
    expect(result.output.referringDomainGaps[0].domain).toBe("visitcharleston.com");
    expect(result.output.referringDomainGaps[0].acquisitionDifficulty).toBe("Easy");
  });
});
