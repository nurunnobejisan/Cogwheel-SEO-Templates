/**
 * Task 2.4 — pack auto-suggestion engine tests.
 *
 * Locks the heuristics half of the done-criterion: "heuristics auto-suggest
 * pack based on schema types, URL patterns, and keywords".
 */
import { describe, it, expect } from "vitest";
import { suggestPack } from "../src/packs/suggest";
import { PACK_CATALOG, DEFAULT_PACK_ID, getPackMeta } from "../src/packs/catalog";

describe("Task 2.4 — suggestPack heuristics", () => {
  it("suggests the hotel pack for a hotel page", () => {
    const result = suggestPack({
      url: "https://example.com/rooms/suite-overview",
      schemaTypes: ["Hotel", "LodgingBusiness"],
      text: "Marriott-style suite with check-in at 3pm — book your stay",
    });
    expect(result?.packId).toBe("hotel");
    expect(result?.confidence).toBeGreaterThan(0);
    expect(result?.confidence).toBeLessThanOrEqual(100);
    expect(result?.reasons.length).toBeGreaterThan(0);
  });

  it("suggests the ecommerce pack for a product page", () => {
    const result = suggestPack({
      url: "https://shop.example.com/product/blue-runner",
      schemaTypes: ["Product", "Offer"],
      text: "Add to cart — free shipping on orders over $50",
    });
    expect(result?.packId).toBe("ecommerce");
  });

  it("returns null when nothing matches (no evidence is not a suggestion)", () => {
    expect(
      suggestPack({ url: "https://example.com/about", schemaTypes: [], text: "" })
    ).toBeNull();
    expect(suggestPack({ url: "not a url at all", text: "zzz" })).toBeNull();
  });

  it("scores documented weights: one schema hit = 25 confidence", () => {
    const result = suggestPack({
      url: "https://example.com/x",
      schemaTypes: ["SoftwareApplication"],
      text: "",
    });
    expect(result?.packId).toBe("saas");
    expect(result?.confidence).toBe(25);
  });

  it("every catalog entry suggests itself from its own first signals", () => {
    for (const meta of PACK_CATALOG) {
      const [schema] = meta.signals.schemaTypes;
      const [path] = meta.signals.urlPatterns;
      const result = suggestPack({
        url: `https://example.com/${path}`,
        schemaTypes: [schema],
        text: meta.signals.keywords.join(" "),
      });
      expect(result, `${meta.id} should suggest itself`).not.toBeNull();
      expect(
        result?.packId,
        `${meta.id} got suggested as ${result?.packId}`
      ).toBe(meta.id);
    }
  });

  it("catalog has a stable default pack", () => {
    expect(getPackMeta(DEFAULT_PACK_ID)?.id).toBe("hotel");
    expect(PACK_CATALOG[0].id).toBe(DEFAULT_PACK_ID);
  });

  it("is case-insensitive and tolerant of unparseable URLs", () => {
    const result = suggestPack({
      url: "/PRODUCT/Widget",
      schemaTypes: ["PRODUCT"],
      text: "ADD TO CART",
    });
    expect(result?.packId).toBe("ecommerce");
  });
});
