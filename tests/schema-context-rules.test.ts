/**
 * Task 3.3 — contextual schema validation rules.
 *
 * 1. Category/listing pages validate against CollectionPage/ItemList.
 * 2. A standalone Offer must attach to a parent Product/Hotel/Service.
 *
 * Rules are exercised directly through `evaluate()` so each assertion maps to
 * one rule; the runAudit integration is covered at the end.
 */
import { describe, expect, it } from "vitest";
import { createSnapshot, runAudit, validateAuditReport } from "../rules/index.ts";
import {
  categoryListingSchemaRule,
  offerParentEntityRule,
} from "../rules/universal/schema-context.ts";
import type { PageSnapshot, RuleContext } from "../rules/types.ts";

const NOW = "2026-01-01T00:00:00.000Z";

function ctx(snapshot: PageSnapshot): RuleContext {
  return { snapshot, mode: "universal", now: NOW };
}

describe("category/listing schema rule", () => {
  it("flags a listing URL with no listing structured data", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/categories/shoes",
      jsonLd: [{ "@type": "BreadcrumbList" }],
    });
    const issues = categoryListingSchemaRule.evaluate(ctx(snapshot));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueId).toBe("iss_category_listing_schema_missing");
    expect(issues[0].category).toBe("schema");
    expect(issues[0].severity).toBe("medium");
    expect(issues[0].context.recommendedAction).toContain("CollectionPage");
  });

  it.each([
    ["https://example.com/categories/shoes"],
    ["https://example.com/collections/summer"],
    ["https://example.com/tags/luxury"],
    ["https://example.com/c/deals"],
  ])("fires for listing path %s", (url) => {
    const issues = categoryListingSchemaRule.evaluate(
      ctx(createSnapshot({ url })),
    );
    expect(issues).toHaveLength(1);
  });

  it.each([
    ["https://example.com/products/shoes"],
    ["https://example.com/about"],
    ["https://example.com/"],
    ["https://example.com/blog/fashion-week"],
  ])("stays quiet for non-listing path %s", (url) => {
    const issues = categoryListingSchemaRule.evaluate(
      ctx(createSnapshot({ url })),
    );
    expect(issues).toHaveLength(0);
  });

  it("accepts CollectionPage on a listing page", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/categories/shoes",
      jsonLd: [{ "@type": "CollectionPage", name: "Shoes" }],
    });
    expect(categoryListingSchemaRule.evaluate(ctx(snapshot))).toHaveLength(0);
  });

  it("accepts ItemList on a listing page", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/collections/summer",
      jsonLd: [{ "@type": "ItemList", itemListElement: [] }],
    });
    expect(categoryListingSchemaRule.evaluate(ctx(snapshot))).toHaveLength(0);
  });
});

describe("offer parent-entity rule", () => {
  const ORPHAN_OFFER = {
    "@type": "Offer",
    price: "199.00",
    priceCurrency: "USD",
  };

  it("flags a standalone Offer with no parent entity", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/rooms",
      jsonLd: [ORPHAN_OFFER],
    });
    const issues = offerParentEntityRule.evaluate(ctx(snapshot));
    expect(issues).toHaveLength(1);
    expect(issues[0].issueId).toBe("iss_offer_parent_missing");
    expect(issues[0].severity).toBe("high");
    expect(issues[0].context.recommendedAction).toContain("itemOffered");
  });

  it.each(["Product", "Hotel", "Service"])(
    "accepts an Offer whose itemOffered is a %s",
    (type) => {
      const snapshot = createSnapshot({
        url: "https://example.com/rooms",
        jsonLd: [
          { "@type": "Offer", price: "199.00", itemOffered: { "@type": type } },
        ],
      });
      expect(offerParentEntityRule.evaluate(ctx(snapshot))).toHaveLength(0);
    },
  );

  it("accepts an Offer referenced by an entity's offers @id (graph layout)", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/rooms",
      jsonLd: [
        { "@type": "Product", "@id": "#widget", offers: { "@id": "#offer-1" } },
        { "@type": "Offer", "@id": "#offer-1", price: "199.00" },
      ],
    });
    expect(offerParentEntityRule.evaluate(ctx(snapshot))).toHaveLength(0);
  });

  it("ignores Offers nested inside an entity (not top-level nodes)", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/rooms",
      jsonLd: [
        {
          "@type": "Product",
          name: "Suite",
          offers: { "@type": "Offer", price: "199.00" },
        },
      ],
    });
    expect(offerParentEntityRule.evaluate(ctx(snapshot))).toHaveLength(0);
  });

  it("does not treat an unrelated entity @id as attachment", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/rooms",
      jsonLd: [
        { "@type": "Product", "@id": "#other", offers: { "@id": "#not-this" } },
        { "@type": "Offer", "@id": "#offer-1", price: "199.00" },
      ],
    });
    expect(offerParentEntityRule.evaluate(ctx(snapshot))).toHaveLength(1);
  });

  it("reports each orphaned Offer separately", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/shop",
      jsonLd: [ORPHAN_OFFER, { ...ORPHAN_OFFER, price: "299.00" }],
    });
    expect(offerParentEntityRule.evaluate(ctx(snapshot))).toHaveLength(2);
  });

  it("stays quiet when the page has no Offer at all", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/",
      jsonLd: [{ "@type": "WebSite" }],
    });
    expect(offerParentEntityRule.evaluate(ctx(snapshot))).toHaveLength(0);
  });
});

describe("runAudit integration", () => {
  it("emits both contextual schema issues in a real audit run", () => {
    const snapshot = createSnapshot({
      url: "https://example.com/categories/shoes",
      title: "Shoes — Example Store",
      metaDescription: "All the shoes.",
      canonical: "https://example.com/categories/shoes",
      headings: [{ level: 1, text: "Shoes" }],
      wordCount: 400,
      textContent: "Shoes for every occasion. Browse the collection.",
      jsonLd: [{ "@type": "Offer", price: "9.99" }],
      hasViewport: true,
    });
    const report = runAudit(snapshot, { now: NOW });
    const ids = report.issues.map((i) => i.issueId);
    expect(ids).toContain("iss_category_listing_schema_missing");
    expect(ids).toContain("iss_offer_parent_missing");
    expect(() => validateAuditReport(report)).not.toThrow();
  });
});
