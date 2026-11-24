import { describe, expect, it } from "vitest";
import { runInternalKickoffStrategyListTask } from "@/tasks/internal-kickoff-strategy-list";

describe("internal-kickoff-strategy-list task", () => {
  it("generates off-page strategy list with linkable assets and outreach targets", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        executiveOffPageVision: "Establish authoritative regional backlinks via bespoke culinary partnerships and heritage architectural preservation features.",
        linkableAssets: [
          {
            assetTitle: "Chef's Sustainable Foraged Tasting Menu Guide",
            uniqueHook: "Hyper-local sourcing within 30 miles of the Blue Ridge Mountains.",
            targetAudiences: ["Food & Wine editors", "Regional lifestyle bloggers"],
            pitchAngle: "Zero-waste luxury dining trend feature.",
            estimatedLinkEquity: "Tier-1 Editorial",
          },
        ],
        outreachCategories: [
          {
            categoryName: "Regional Lifestyle & Travel",
            description: "High-domain authority Southeast lifestyle publications.",
            exampleOutlets: ["Southern Living", "Garden & Gun", "Atlanta Magazine"],
            approachStrategy: "Exclusive press preview invitation for executive chef seasonal launch.",
          },
        ],
        immediateNextSteps: [
          "Curate press media kit with high-res photography",
          "Assemble list of 25 regional travel editors",
        ],
      });

    const result = await runInternalKickoffStrategyListTask(
      {
        property: {
          name: "The Blue Ridge Manor",
          brand: "Curio Collection by Hilton",
          city: "Asheville",
          state: "NC",
          url: "https://blueridgemanor.com",
          amenities: ["Rooftop Observatory", "Artisanal Apiary"],
          diningInfo: ["Foraged Culinary Kitchen"],
        },
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.linkableAssets).toHaveLength(1);
    expect(result.output.linkableAssets[0].estimatedLinkEquity).toBe("Tier-1 Editorial");
    expect(result.output.outreachCategories[0].exampleOutlets).toContain("Southern Living");
  });
});
