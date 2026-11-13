import { describe, expect, it } from "vitest";
import { buildDeterministicRationales, buildRationalePrompt, parseRationales } from "./prompt";
import { keywordResearchInputSchema, type ResolvedKeywordRun } from "./schema";
import { runPreGenerationChecks, validateKeywordResearchDraft } from "./validator";

const SAMPLE_RUN: ResolvedKeywordRun = {
  property: {
    name: "Hotel X Gainesville",
    url: "https://hotelx.example.com",
    brand: "Tapestry Collection by Hilton",
    city: "Gainesville",
    state: "FL",
    notes: "Near UF campus",
    allowedLocations: ["UF"],
    excludedLocations: [],
  },
  pages: [
    { id: "home", path: "/", title: "Home", buckets: ["hotel"], active: true },
  ],
  template: "A",
  matrix: [
    {
      pageId: "home",
      path: "/",
      title: "Home",
      primary: { id: "kw:1", keyword: "hotel gainesville fl", volume: 1200, kd: 32 },
      secondary: null,
      alternatives: [],
      exceptionCandidate: null,
      flags: [],
      status: "approved",
    },
  ],
  pool: [
    {
      id: "kw:1",
      keyword: "hotel gainesville fl",
      volume: 1200,
      kd: 32,
      cpc: 2.5,
      intent: "commercial",
      sourceGroup: "Hotel",
      sourceFiles: ["hotel.csv"],
      flags: [],
      bucketId: "hotel",
      bucketName: "Hotel",
      bucketSource: "keyword",
      role: "primary",
      pageId: "home",
    },
  ],
};

describe("tasks/keyword-research", () => {
  it("validates direct payload schema", () => {
    const parsed = keywordResearchInputSchema.safeParse({
      property: SAMPLE_RUN.property,
      pages: SAMPLE_RUN.pages,
      template: "A",
      allocation: { pool: SAMPLE_RUN.pool },
      matrix: SAMPLE_RUN.matrix,
    });
    expect(parsed.success).toBe(true);
  });

  it("builds prompt and parses rationales JSON", () => {
    const { system, prompt } = buildRationalePrompt(SAMPLE_RUN);
    expect(system).toContain("STRICT GROUNDING RULE");
    expect(prompt).toContain("hotel gainesville fl");

    const parsed = parseRationales('```json\n{"rationales":[{"pageId":"home","title":"Home","text":"Grounded rationale."}]}\n```', SAMPLE_RUN.matrix);
    expect(parsed).toEqual([{ pageId: "home", title: "Home", text: "Grounded rationale." }]);
  });

  it("enforces approved matrix in pre-check and validates draft completeness", () => {
    expect(runPreGenerationChecks(SAMPLE_RUN).ok).toBe(true);

    const pendingRun: ResolvedKeywordRun = {
      ...SAMPLE_RUN,
      matrix: [{ ...SAMPLE_RUN.matrix[0], status: "pending" }],
    };
    expect(runPreGenerationChecks(pendingRun).ok).toBe(false);

    const det = buildDeterministicRationales(SAMPLE_RUN.matrix);
    expect(validateKeywordResearchDraft(SAMPLE_RUN, { rationales: det, usedAi: false }).valid).toBe(true);
    expect(validateKeywordResearchDraft(SAMPLE_RUN, { rationales: [{ pageId: "home", title: "Home", text: "  " }], usedAi: true }).valid).toBe(false);
  });
});
