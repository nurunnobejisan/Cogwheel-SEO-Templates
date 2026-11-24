import { describe, expect, it } from "vitest";
import { runEmailOutreachFormattingTask } from "@/tasks/email-outreach-formatting";

describe("email-outreach-formatting task", () => {
  it("generates personalized outreach emails for requested hotel personas", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        templates: [
          {
            persona: "wedding_planner",
            subjectLines: [
              "Private Courtyard Wedding Previews at The Savannah Mansion",
              "Exclusive 2027 Wedding Venue Dates: The Savannah Mansion",
            ],
            openingHook: "Knowing your discerning eye for historical Southern ballroom venues...",
            bodyCopy: "We have recently unveiled our restored 1890s glasshouse conservatory for intimate weddings...",
            valueProposition: "Priority hold dates and complimentary VIP tasting for your registered clients.",
            callToAction: "Would you have 10 minutes next Tuesday for a walkthrough and tasting?",
            followUpTouchpoints: [
              {
                dayOffset: 4,
                followUpSubject: "Quick photo gallery of our glasshouse conservatory",
                followUpAngle: "Sharing 4 new ceremony setup photography examples.",
              },
            ],
          },
        ],
        outreachBestPractices: [
          "Personalize first sentence with reference to a recent event they organized",
          "Never send generic attachments on cold initial contact",
        ],
      });

    const result = await runEmailOutreachFormattingTask(
      {
        property: {
          name: "The Savannah Mansion",
          brand: "Tapestry Collection by Hilton",
          city: "Savannah",
          state: "GA",
          url: "https://savannahmansion.com",
        },
        targetPersonas: ["wedding_planner"],
        linkableAssetHook: "Restored 1890s botanical glasshouse conservatory wedding venue",
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.templatesCount).toBe(1);
    expect(result.output.templates[0].persona).toBe("wedding_planner");
    expect(result.output.templates[0].subjectLines).toHaveLength(2);
  });
});
