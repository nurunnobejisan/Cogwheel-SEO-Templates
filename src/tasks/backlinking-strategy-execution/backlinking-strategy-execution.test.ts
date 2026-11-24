import { describe, expect, it } from "vitest";
import { runBacklinkingStrategyExecutionTask } from "@/tasks/backlinking-strategy-execution";

describe("backlinking-strategy-execution task", () => {
  it("generates structured 90-day backlink acquisition sprint roadmap and target pipeline", async () => {
    const mockClaude = async () =>
      JSON.stringify({
        roadmapPhases: [
          {
            phaseName: "Sprint 1: Local Authority & Official Tourism",
            timelineWeeks: "Weeks 1-4",
            primaryDeliverable: "Audit and claim official CVB, chamber, and neighborhood business association listings.",
            targetAcquisitions: 4,
          },
        ],
        outreachPipeline: [
          {
            targetDomain: "visitscottsdale.com",
            contactPersona: "Scottsdale CVB Membership Director",
            pitchAngle: "Updated listing for newly opened Sonoran Desert spa suites.",
            status: "prospect",
            targetDestinationUrl: "https://scottsdaleritual.com",
            expectedLinkType: "partner_directory",
            followUpDate: "2026-12-01",
          },
        ],
        kpiTargets: {
          targetHighAuthorityLinks: 3,
          targetLocalCitations: 5,
          targetEditorialFeatures: 2,
        },
      });

    const result = await runBacklinkingStrategyExecutionTask(
      {
        property: {
          name: "Scottsdale Ritual Resort",
          brand: "Curio Collection by Hilton",
          city: "Scottsdale",
          state: "AZ",
          url: "https://scottsdaleritual.com",
        },
        targetAcquisitionCount: 10,
      },
      { callClaude: mockClaude },
    );

    expect(result.status).toBe("Done");
    expect(result.output.roadmapPhases).toHaveLength(1);
    expect(result.output.pipelineCount).toBe(1);
    expect(result.output.outreachPipeline[0].targetDomain).toBe("visitscottsdale.com");
    expect(result.output.kpiTargets.targetHighAuthorityLinks).toBe(3);
  });
});
