import { describe, expect, it } from "vitest";
import { runGoogleMapCitationTask } from "@/tasks/google-map-citation";

describe("google-map-citation task", () => {
  it("audits NAP consistency, Google Business Profile categories, and directory listings", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        napConsistencyScore: 88,
        gbpCategoryRecommendation: {
          primaryCategory: "Boutique Hotel",
          secondaryCategories: ["Wedding Venue", "Fine Dining Restaurant"],
          categoryRationale: "Emphasize boutique lodging experience with dual revenue streams for ballroom weddings.",
        },
        citationDirectoryAudits: [
          {
            directoryName: "Google Maps",
            domain: "google.com/maps",
            domainAuthority: 100,
            status: "verified_consistent",
            currentName: "The Charleston Grand Hotel",
            currentAddress: "123 Meeting St, Charleston, SC 29401",
            currentPhone: "(843) 555-0199",
            fixAction: "Add seasonal high-res exterior photos and updated breakfast hours.",
          },
          {
            directoryName: "Yelp",
            domain: "yelp.com",
            domainAuthority: 92,
            status: "nap_discrepancy",
            currentName: "Charleston Grand Hotel LLC",
            currentAddress: "123 Meeting Street",
            currentPhone: "(843) 555-0199",
            fixAction: "Remove 'LLC' suffix from business name to match official GBP title.",
          },
        ],
        napDiscrepancies: [
          {
            directory: "Yelp",
            discrepancyType: "name",
            foundValue: "Charleston Grand Hotel LLC",
            expectedValue: "The Charleston Grand Hotel",
          },
        ],
        immediateFixChecklist: [
          "Submit business name correction on Yelp to remove 'LLC'",
          "Claim TripAdvisor listing and update website link with UTM campaign tracking",
        ],
      });

    const result = await runGoogleMapCitationTask(
      {
        property: {
          name: "The Charleston Grand Hotel",
          brand: "Curio Collection by Hilton",
          address: "123 Meeting St",
          city: "Charleston",
          state: "SC",
          zip: "29401",
          phone: "(843) 555-0199",
          url: "https://luxuryhotelcharleston.com",
        },
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.napConsistencyScore).toBe(88);
    expect(result.output.gbpCategoryRecommendation.primaryCategory).toBe("Boutique Hotel");
    expect(result.output.napDiscrepancies).toHaveLength(1);
    expect(result.output.citationDirectoryAudits).toHaveLength(2);
  });
});
