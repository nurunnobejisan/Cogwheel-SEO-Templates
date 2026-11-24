import { describe, expect, it } from "vitest";
import { ENTERPRISE_AI_AGENTS, getAgentById, getAgentsByCategory } from "@/core/agents/agent-registry";
import { initializePipeline, UNIFIED_26_STEP_PIPELINE } from "@/core/workflow/pipeline-orchestrator";

describe("Enterprise AI Agent Swarm & Workflow Orchestrator", () => {
  it("defines all 13 specialized AI agents with distinct roles and inputs", () => {
    expect(ENTERPRISE_AI_AGENTS).toHaveLength(13);

    const agentNames = ENTERPRISE_AI_AGENTS.map((a) => a.name);
    expect(agentNames).toContain("Website Audit Agent");
    expect(agentNames).toContain("Keyword Research Agent");
    expect(agentNames).toContain("Keyword Mapping Agent");
    expect(agentNames).toContain("On-Page SEO Agent");
    expect(agentNames).toContain("Technical SEO Agent");
    expect(agentNames).toContain("Content Optimization Agent");
    expect(agentNames).toContain("Schema Validation Agent");
    expect(agentNames).toContain("Local SEO Agent");
    expect(agentNames).toContain("Competitor Analysis Agent");
    expect(agentNames).toContain("Backlink Analysis Agent");
    expect(agentNames).toContain("GEO Research Agent");
    expect(agentNames).toContain("Reporting Agent");
    expect(agentNames).toContain("Quality Assurance Agent");

    for (const agent of ENTERPRISE_AI_AGENTS) {
      expect(agent.requiredInputs.length).toBeGreaterThan(0);
      expect(agent.outputDeliverable.length).toBeGreaterThan(5);
      expect(agent.systemPromptGoal.length).toBeGreaterThan(10);
    }
  });

  it("filters agents by category and retrieves by ID", () => {
    const techAgents = getAgentsByCategory("Technical");
    expect(techAgents.length).toBeGreaterThanOrEqual(3);

    const geoAgent = getAgentById("agent-geo-research");
    expect(geoAgent).toBeDefined();
    expect(geoAgent?.name).toBe("GEO Research Agent");
  });

  it("initializes the 26-step unified end-to-end SEO pipeline", () => {
    expect(UNIFIED_26_STEP_PIPELINE).toHaveLength(26);

    const pipeline = initializePipeline({
      name: "The Austin Heritage Hotel",
      brand: "Tapestry Collection by Hilton",
      city: "Austin",
      state: "TX",
      allowedLocations: ["Downtown Austin"],
      excludedLocations: ["San Antonio"],
    });

    expect(pipeline.totalSteps).toBe(26);
    expect(pipeline.steps[0].id).toBe("step-create-client");
    expect(pipeline.steps[25].id).toBe("step-export-client-deliverables");
    expect(pipeline.steps.filter((s) => s.requiresHumanApproval).length).toBeGreaterThanOrEqual(3);
  });
});
