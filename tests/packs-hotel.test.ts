/**
 * Task 2.2 — Hotel pack extraction tests.
 *
 * Locks the done-criterion: hotel brand guardrails, schema rules, OTA config
 * and templates are modularized into `src/packs/hotel/`, the pack validates
 * against the registry, and the extension keeps byte-identical access to the
 * guardrails through its old import path.
 */
import { describe, it, expect } from "vitest";
import hotelPack, { HOTEL_CHECKLIST } from "../src/packs/hotel";
import { validatePack, getPack } from "../src/packs";
import {
  TEMPLATES_DATA,
  getTemplateBySlug,
} from "../src/packs/hotel/templates";
import {
  BRAND_GUARDRAILS,
  validateBrandCompliance as movedValidateBrandCompliance,
} from "../src/packs/hotel/brand-guardrails";
import { GENERIC_BRAND_GUARDRAILS } from "../src/packs/generic-guardrails";
import * as extensionBrandGuardrails from "../chrome-extension/src/utils/brandGuardrails";
import { getPackMeta } from "../src/packs/catalog";
import { KNOWN_PAGE_TYPES } from "../src/packs/index";
import otaConfig from "../data/ota-config.json";

describe("Task 2.2 — hotel pack modularized into src/packs/hotel/", () => {
  it("registers a valid pack at import time", () => {
    expect(validatePack(hotelPack)).toEqual([]);
    expect(getPack("hotel")).toBe(hotelPack);
  });

  it("takes its scoring weights from data/ota-config.json (single source)", () => {
    expect(hotelPack.scoringWeights).toEqual(otaConfig.scoringWeights);
    expect(hotelPack.scoringWeights.onPage).toBe(0.35);
    // Catalog and pack must not drift.
    expect(getPackMeta("hotel")?.scoringWeights).toEqual(hotelPack.scoringWeights);
  });

  it("derives its checklist from the Critical items of the template catalog", () => {
    const expected = TEMPLATES_DATA.flatMap((t) => t.checklist).filter(
      (i) => i.priority === "Critical"
    );
    expect(HOTEL_CHECKLIST.length).toBeGreaterThan(0);
    expect(HOTEL_CHECKLIST).toEqual(expected);
    expect(HOTEL_CHECKLIST.every((i) => i.priority === "Critical")).toBe(true);
    // Ids are unique so the derived list can be keyed safely in the UI.
    expect(new Set(HOTEL_CHECKLIST.map((i) => i.id)).size).toBe(HOTEL_CHECKLIST.length);
  });

  it("keeps the template catalog behaviour intact after the move", () => {
    expect(TEMPLATES_DATA.length).toBe(12);
    const tmpl = getTemplateBySlug("technical-seo", TEMPLATES_DATA[0].slug);
    expect(tmpl).toBeDefined();
    expect(tmpl?.checklist.length).toBeGreaterThan(0);
  });

  it("loads the 78-keyword matrix through the validated schema", () => {
    const { keywordMatrix } = hotelPack;
    expect(keywordMatrix.keywords).toHaveLength(78);
    expect(keywordMatrix.categories).toHaveLength(6);
    expect(keywordMatrix.metadata.notes).toContain("not measured search data");
    // Every row's category is declared by the matrix itself.
    const declared = new Set(keywordMatrix.categories);
    expect(
      keywordMatrix.keywords.every((k) => declared.has(k.category))
    ).toBe(true);
    // Task 4.1: every CPC figure is explicitly labelled illustrative.
    expect(
      keywordMatrix.keywords.every((k) => k.cpcEstimate.source === "illustrative")
    ).toBe(true);
  });

  it("carries the five hotel brand guardrails plus the Generic rule", () => {
    expect(Object.keys(hotelPack.brandGuardrails).sort()).toEqual([
      "Generic",
      "Hilton",
      "Hyatt",
      "IHG",
      "Independent",
      "Marriott",
    ]);
    for (const rule of Object.values(hotelPack.brandGuardrails)) {
      if (rule.name === "Generic") {
        // Editorial guardrail: no franchise suffix, but flagged claims.
        expect(rule.forbiddenTerms.length).toBeGreaterThan(0);
        continue;
      }
      expect(rule.mandatorySuffix).toBeTruthy();
      expect(rule.forbiddenTerms.length).toBeGreaterThan(0);
    }
    // Single source: the Generic entry IS the shared one.
    expect(hotelPack.brandGuardrails.Generic).toBe(GENERIC_BRAND_GUARDRAILS.Generic);
  });

  it("re-exports the identical guardrails through the old extension path", () => {
    // Phase B pattern: assert function/object identity, not a copy.
    expect(extensionBrandGuardrails.BRAND_GUARDRAILS).toBe(BRAND_GUARDRAILS);
    expect(extensionBrandGuardrails.validateBrandCompliance).toBe(
      movedValidateBrandCompliance
    );
    const result = extensionBrandGuardrails.validateBrandCompliance("Marriott", {
      title: "Marriott Downtown",
      metaDesc: "Stay at Marriott Downtown.",
      h1: "Marriott Downtown",
    });
    expect(result.brand).toBe("Marriott");
  });

  it("defines contextual schema rules with actionable rationales", () => {
    expect(hotelPack.schemaRules.length).toBeGreaterThan(0);
    for (const rule of hotelPack.schemaRules) {
      expect(rule.rationale.length).toBeGreaterThan(20);
      expect(rule.required.length).toBeGreaterThan(0);
      for (const pt of rule.pageTypes) {
        expect(KNOWN_PAGE_TYPES.has(pt)).toBe(true);
      }
    }
    // The Offer-parent clause from Task 3.3 is present in pack form.
    const offerRule = hotelPack.schemaRules.find((r) => r.jsonLdType === "Offer");
    expect(offerRule?.required).toContain("itemOffered");
  });
});
