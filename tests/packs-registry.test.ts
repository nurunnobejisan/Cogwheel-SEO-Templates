/**
 * Task 2.1 — Pack core interface & registry tests.
 *
 * Locks the done-criterion from docs/TASKS.md: the Pack type exposes all
 * nine required fields, the registry validates weights/ids/page types, and
 * duplicate registration fails loudly.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerPack,
  unregisterPack,
  getPack,
  listPacks,
  validatePack,
  Pack,
} from "../src/packs";
import type { PackAiPrompt, PackSchemaRule } from "../src/packs/types";
import type { KeywordStrategyMatrix, AllBrandGuardrails } from "../src/schemas/validation";

const guardrails: AllBrandGuardrails = {
  Marriott: {
    name: "Marriott",
    loyaltyProgram: "Marriott Bonvoy",
    maxTitleChars: 60,
    maxMetaChars: 160,
    maxH1Chars: 70,
    brandPillColor: "#FFC72C",
    forbiddenTerms: [
      { term: "cheap", reason: "dilutes brand positioning", replacement: "value" },
    ],
  },
};

const keywordMatrix: KeywordStrategyMatrix = {
  metadata: {
    version: "1.0.0",
    datasetName: "fixture-matrix",
    totalKeywords: 1,
    lastUpdated: "2026-11-27",
    author: "tests",
    targetIndustries: ["hospitality"],
    categorySummary: { "Brand/Direct Booking": 1 },
  },
  categories: ["Brand/Direct Booking"],
  keywords: [
    {
      id: "kw-1",
      keyword: "marriott panama city beach",
      category: "Brand/Direct Booking",
      subCategory: "Brand",
      searchIntent: "Transactional",
      searchVolumeTier: "Medium",
      cpcEstimate: { value: "3.20", source: "illustrative" },
      targetPageType: "home",
      recommendedSchema: "Hotel",
      geoEngineRelevance: ["ChatGPT", "Gemini"],
      targetEntityPrompt: "Which hotel is best for a beachfront stay?",
      competitiveContext: "OTA metasearch",
    },
  ],
};

const schemaRules: PackSchemaRule[] = [
  {
    jsonLdType: "Hotel",
    pageTypes: ["home", "location"],
    required: ["name", "address", "telephone"],
    recommended: ["starRating", "amenityFeature"],
    rationale: "Hotel rich results require name, address and telephone.",
  },
];

const aiPrompts: PackAiPrompt[] = [
  {
    id: "meta-title",
    purpose: "metadata",
    system: "You write search-optimized metadata.",
    template: "Write a title for {{pageUrl}} targeting {{primaryKeyword}}.",
  },
  {
    id: "geo-entity",
    purpose: "geo",
    system: "You write GEO entity blocks.",
    template: "Describe the entity behind {{brandName}}.",
  },
];

function fixturePack(overrides: Partial<Pack> = {}): Pack {
  return {
    id: "hotel",
    name: "Hotel & Hospitality",
    description: "Scoring, schema and keywords for hotel and hospitality sites.",
    pageTypes: ["home", "location", "booking"],
    scoringWeights: { onPage: 0.5, schema: 0.3, geoAi: 0.2 },
    checklist: [
      {
        id: "canonical-hotel",
        task: "Set a self-referencing canonical",
        description: "Each bookable room URL points at itself.",
        priority: "Critical",
      },
    ],
    schemaRules,
    keywordMatrix,
    brandGuardrails: guardrails,
    aiPrompts,
    ...overrides,
  };
}

describe("Task 2.1 — Pack interface", () => {
  it("exposes all nine fields required by the done-criterion", () => {
    const pack = fixturePack();
    const requiredKeys = [
      "id",
      "name",
      "pageTypes",
      "scoringWeights",
      "checklist",
      "schemaRules",
      "keywordMatrix",
      "brandGuardrails",
      "aiPrompts",
    ];
    for (const key of requiredKeys) {
      expect(pack, `missing field ${key}`).toHaveProperty(key);
    }
  });
});

describe("Task 2.1 — Pack validation", () => {
  it("accepts a well-formed pack", () => {
    expect(validatePack(fixturePack())).toEqual([]);
  });

  it("rejects weights that do not sum to 1", () => {
    const problems = validatePack(
      fixturePack({ scoringWeights: { onPage: 0.5, schema: 0.5, geoAi: 0.5 } })
    );
    expect(problems.some((p) => p.includes("scoringWeights must sum to 1"))).toBe(true);
  });

  it("rejects non-slug ids", () => {
    const problems = validatePack(fixturePack({ id: "Hotel_Pack!" }));
    expect(problems.some((p) => p.includes("kebab-case"))).toBe(true);
  });

  it("rejects empty pageTypes and unknown page types", () => {
    expect(validatePack(fixturePack({ pageTypes: [] })).some((p) => p.includes("pageTypes"))).toBe(
      true
    );
    // Cast needed: the point of the test is that the runtime guard catches
    // values the type system cannot (e.g. data arriving from JSON).
    const bad = fixturePack({ pageTypes: ["pricing" as never] });
    expect(validatePack(bad).some((p) => p.includes('unknown pageType "pricing"'))).toBe(true);
  });

  it("rejects empty checklist, empty keywords and empty guardrails", () => {
    expect(validatePack(fixturePack({ checklist: [] })).some((p) => p.includes("checklist"))).toBe(
      true
    );
    const emptyMatrix: KeywordStrategyMatrix = { ...keywordMatrix, keywords: [] };
    expect(
      validatePack(fixturePack({ keywordMatrix: emptyMatrix })).some((p) =>
        p.includes("keywordMatrix")
      )
    ).toBe(true);
    expect(
      validatePack(fixturePack({ brandGuardrails: {} })).some((p) => p.includes("brandGuardrails"))
    ).toBe(true);
  });

  it("rejects duplicate aiPrompt ids", () => {
    const problems = validatePack(fixturePack({ aiPrompts: [aiPrompts[0], aiPrompts[0]] }));
    expect(problems.some((p) => p.includes('duplicate aiPrompt id "meta-title"'))).toBe(true);
  });
});

describe("Task 2.1 — Pack registry", () => {
  beforeEach(() => {
    unregisterPack("hotel");
    unregisterPack("ecommerce");
  });

  it("registers and retrieves a pack by id", () => {
    const pack = fixturePack();
    registerPack(pack);

    expect(getPack("hotel")).toBe(pack);
    expect(listPacks().map((p) => p.id)).toContain("hotel");
  });

  it("throws with the full problem list for an invalid pack", () => {
    expect(() => registerPack(fixturePack({ id: "Not A Slug" }))).toThrow(/kebab-case/);
    expect(getPack("Not A Slug")).toBeUndefined();
  });

  it("throws on duplicate registration instead of silently shadowing", () => {
    registerPack(fixturePack());
    expect(() => registerPack(fixturePack())).toThrow(/already registered/);
  });

  it("keeps registry scoped per id so multiple packs coexist", () => {
    registerPack(fixturePack());
    registerPack(
      fixturePack({
        id: "ecommerce",
        name: "Ecommerce & Retail",
        pageTypes: ["product", "category"],
      })
    );

    expect(listPacks()).toHaveLength(2);
    expect(getPack("ecommerce")?.name).toBe("Ecommerce & Retail");
  });
});
