/**
 * Task 2.3 — six universal packs parity.
 *
 * The light catalog (`src/packs/catalog.ts`) and the full pack modules
 * (`src/packs/<id>/index.ts`) are two views of the same truth: the extension
 * imports the catalog, the server imports `src/packs/all.ts`. This suite
 * fails the moment they drift, and locks the shared matrix/guardrail/
 * checklist contract every pack must satisfy.
 */
import { describe, it, expect } from "vitest";
import { ALL_PACKS, findPack } from "../src/packs/all";
import { validatePack, KNOWN_PAGE_TYPES } from "../src/packs/index";
import { PACK_CATALOG } from "../src/packs/catalog";
import { GENERIC_BRAND_GUARDRAILS } from "../src/packs/generic-guardrails";

const EXPECTED_IDS = [
  "hotel",
  "ecommerce",
  "local-business",
  "saas",
  "publisher",
  "finance",
];

describe("Task 2.3 — six universal packs", () => {
  it("catalog and pack modules both cover exactly the six pack ids", () => {
    expect(PACK_CATALOG.map((p) => p.id)).toEqual(EXPECTED_IDS);
    expect(ALL_PACKS.map((p) => p.id)).toEqual(EXPECTED_IDS);
  });

  it("every pack validates against the registry contract", () => {
    for (const pack of ALL_PACKS) {
      const problems = validatePack(pack);
      expect(problems, `${pack.id}: ${problems.join("; ")}`).toEqual([]);
    }
  });

  it("catalog and pack modules never drift", () => {
    for (const meta of PACK_CATALOG) {
      const pack = findPack(meta.id);
      expect(pack, `missing pack module for "${meta.id}"`).toBeDefined();
      if (!pack) continue;
      expect(pack.id, meta.id).toBe(meta.id);
      expect(pack.name, meta.id).toBe(meta.name);
      expect(pack.description, meta.id).toBe(meta.description);
      expect(pack.pageTypes, meta.id).toEqual(meta.pageTypes);
      expect(pack.scoringWeights, meta.id).toEqual(meta.scoringWeights);
      // Page types stay inside the vocabulary the registry validates.
      for (const pageType of pack.pageTypes) {
        expect(KNOWN_PAGE_TYPES.has(pageType), `${meta.id}/${pageType}`).toBe(true);
      }
    }
  });

  it("every matrix is 78 rows across 6 categories × 13, all CPCs illustrative", () => {
    for (const pack of ALL_PACKS) {
      const { keywordMatrix } = pack;
      expect(keywordMatrix.keywords, pack.id).toHaveLength(78);
      expect(keywordMatrix.categories, pack.id).toHaveLength(6);

      const declared = new Set(keywordMatrix.categories);
      const ids = new Set<string>();
      for (const row of keywordMatrix.keywords) {
        const where = `${pack.id}/${row.id}`;
        expect(declared.has(row.category), where).toBe(true);
        expect(row.cpcEstimate.source, where).toBe("illustrative");
        expect(row.searchVolumeTier, where).toBeTruthy();
        ids.add(row.id);
      }
      expect(ids.size, `${pack.id} ids`).toBe(78);

      for (const category of keywordMatrix.categories) {
        expect(
          keywordMatrix.keywords.filter((k) => k.category === category),
          `${pack.id}/${category}`
        ).toHaveLength(13);
      }
      // Provenance sentence required by Task 4.1/4.4 (no invented numbers).
      expect(keywordMatrix.metadata.notes, pack.id).toContain(
        "not measured search data"
      );
    }
  });

  it("checklists carry unique ids and honest priorities", () => {
    for (const pack of ALL_PACKS) {
      expect(pack.checklist.length, pack.id).toBeGreaterThanOrEqual(6);
      const ids = new Set(pack.checklist.map((item) => item.id));
      expect(ids.size, `${pack.id} checklist ids`).toBe(pack.checklist.length);
      for (const item of pack.checklist) {
        expect(["Critical", "High", "Medium"], `${pack.id}/${item.id}`).toContain(
          item.priority
        );
      }
    }
  });

  it("guardrails: five franchise rulebooks + one shared Generic object", () => {
    for (const pack of ALL_PACKS) {
      if (pack.id === "hotel") {
        // Hotel carries its five brands PLUS the shared Generic rule.
        expect(Object.keys(pack.brandGuardrails).sort()).toEqual([
          "Generic",
          "Hilton",
          "Hyatt",
          "IHG",
          "Independent",
          "Marriott",
        ]);
        expect(pack.brandGuardrails.Generic).toBe(GENERIC_BRAND_GUARDRAILS.Generic);
      } else {
        // Every other pack references the identical shared object — no copies.
        expect(pack.brandGuardrails, pack.id).toBe(GENERIC_BRAND_GUARDRAILS);
      }
    }
  });

  it("every pack declares schema rules with actionable rationales", () => {
    for (const pack of ALL_PACKS) {
      expect(pack.schemaRules.length, pack.id).toBeGreaterThanOrEqual(4);
      for (const rule of pack.schemaRules) {
        const where = `${pack.id}/${rule.jsonLdType}`;
        expect(rule.rationale.length, where).toBeGreaterThan(20);
        expect(rule.required.length, where).toBeGreaterThan(0);
        expect(rule.pageTypes.length, where).toBeGreaterThan(0);
      }
    }
  });
});
