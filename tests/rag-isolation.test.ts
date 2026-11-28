import { describe, expect, it } from "vitest";
import { chunkDocument, createEmptyKnowledgeBase, createRagPipeline } from "../ai/rag";

describe("WP6 — per-client RAG retrieval isolation", () => {
  it("isolates client chunks by propertyId while always allowing shared docs", async () => {
    const kb = createEmptyKnowledgeBase(128);
    kb.upsert([
      {
        id: "shared-hotel-guide",
        title: "Google Hotel Schema Guide",
        text: "Hotel structured data requires Hotel or LodgingBusiness with address and checkin time.",
        source: "google-search-central",
        tags: ["schema", "hotel"],
      },
      {
        id: "prop-a-hotel-note",
        title: "Alpha Resort Property Playbook",
        text: "Hotel structured data secret notes for Alpha Resort downtown suites and parking.",
        source: "client-vault",
        tags: ["schema", "hotel"],
        propertyId: "prop-alpha",
      },
      {
        id: "prop-b-hotel-note",
        title: "Beta Inn Property Playbook",
        text: "Hotel structured data confidential notes for Beta Inn beachfront villas.",
        source: "client-vault",
        tags: ["schema", "hotel"],
        propertyId: "prop-beta",
      },
    ]);

    const alphaResults = kb.search("Hotel structured data", { topK: 10, propertyId: "prop-alpha" });
    const alphaIds = alphaResults.map((c) => c.id);
    expect(alphaIds).toContain("shared-hotel-guide");
    expect(alphaIds).toContain("prop-a-hotel-note");
    expect(alphaIds).not.toContain("prop-b-hotel-note");

    const betaResults = await kb.searchAsync("Hotel structured data", {
      topK: 10,
      propertyId: "prop-beta",
    });
    const betaIds = betaResults.map((c) => c.id);
    expect(betaIds).toContain("shared-hotel-guide");
    expect(betaIds).toContain("prop-b-hotel-note");
    expect(betaIds).not.toContain("prop-a-hotel-note");

    const unscopedResults = kb.search("Hotel structured data", { topK: 10 });
    const unscopedIds = unscopedResults.map((c) => c.id);
    expect(unscopedIds).toContain("shared-hotel-guide");
    expect(unscopedIds).not.toContain("prop-a-hotel-note");
    expect(unscopedIds).not.toContain("prop-b-hotel-note");

    const blankScopeResults = kb.search("Hotel structured data", { topK: 10, propertyId: "   " });
    expect(blankScopeResults.map((c) => c.id)).toEqual(["shared-hotel-guide"]);
  });

  it("propagates optional propertyId through chunkDocument and createRagPipeline", () => {
    const clientChunks = chunkDocument({
      id: "client-doc",
      title: "Private SEO Notes",
      text: "Private canonical fix instructions for Client Delta Hotel.",
      source: "client-vault",
      propertyId: "prop-delta",
    });
    expect(clientChunks).toHaveLength(1);
    expect(clientChunks[0]?.propertyId).toBe("prop-delta");

    const pipeline = createRagPipeline({ extraChunks: clientChunks });
    const deltaIds = pipeline.knowledgeBase
      .search("Client Delta Hotel canonical", { topK: 10, propertyId: "prop-delta" })
      .map((c) => c.id);
    expect(deltaIds).toContain("client-doc#1");

    const otherIds = pipeline.knowledgeBase
      .search("Client Delta Hotel canonical", { topK: 10, propertyId: "prop-other" })
      .map((c) => c.id);
    expect(otherIds).not.toContain("client-doc#1");

    const publicIds = pipeline.knowledgeBase
      .search("Client Delta Hotel canonical", { topK: 10 })
      .map((c) => c.id);
    expect(publicIds).not.toContain("client-doc#1");
  });
});
