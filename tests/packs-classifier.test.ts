/**
 * Task 3.1 — rule-based page-type classifier with confidence.
 *
 * Covers the eight `PackPageType` labels, the confidence model (strength ×
 * margin), ambiguity being reported honestly, and determinism.
 */
import { describe, expect, it } from "vitest";
import { createSnapshot } from "../rules/index.ts";
import { classifyPageType } from "../src/packs/classifier.ts";
import type { PackPageType } from "../src/packs/types.ts";

const ALL_TYPES: PackPageType[] = [
  "home",
  "product",
  "category",
  "article",
  "location",
  "booking",
  "contact",
  "other",
];

describe("classifyPageType", () => {
  it("labels the site root as home with high confidence", () => {
    const snap = createSnapshot({
      url: "https://example.com/",
      title: "Example — Home",
      jsonLd: [{ "@type": "WebSite" }],
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("home");
    expect(r.confidence).toBeGreaterThan(60);
  });

  it("labels a contact path as contact", () => {
    const snap = createSnapshot({
      url: "https://example.com/contact",
      title: "Contact us",
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("contact");
    expect(r.confidence).toBeGreaterThan(50);
  });

  it("labels a booking path as booking", () => {
    const snap = createSnapshot({ url: "https://example.com/booking" });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("booking");
    expect(r.confidence).toBeGreaterThan(40);
  });

  it("detects a booking engine from script signatures", () => {
    const snap = createSnapshot({
      url: "https://example.com/stay",
      scriptSrcs: ["https://cdn.example.com/synxis-engine.js"],
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("booking");
    expect(r.signals.join(" ")).toContain("booking-engine script");
  });

  it("detects reservation widgets in the DOM", () => {
    const snap = createSnapshot({
      url: "https://example.com/rooms",
      reservationWidgets: true,
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("booking");
    expect(r.signals.join(" ")).toContain("reservation widget");
  });

  it("labels Article JSON-LD as article", () => {
    const snap = createSnapshot({
      url: "https://example.com/something",
      jsonLd: [{ "@type": "BlogPosting" }],
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("article");
  });

  it("labels an editorial path as article", () => {
    const snap = createSnapshot({ url: "https://example.com/blog/tips" });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("article");
  });

  it("labels a listing path as category", () => {
    const snap = createSnapshot({ url: "https://example.com/categories/shoes" });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("category");
  });

  it("labels CollectionPage JSON-LD as category", () => {
    const snap = createSnapshot({
      url: "https://example.com/browse",
      jsonLd: [{ "@type": "CollectionPage" }],
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("category");
  });

  it("labels Product JSON-LD as product", () => {
    const snap = createSnapshot({
      url: "https://example.com/item",
      jsonLd: [{ "@type": "Product" }],
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("product");
  });

  it("treats a hotel room list (/rooms) as product inventory", () => {
    const snap = createSnapshot({ url: "https://example.com/rooms" });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("product");
  });

  it("labels a location path as location", () => {
    const snap = createSnapshot({ url: "https://example.com/neighborhood" });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("location");
  });

  it("returns other at confidence 0 when nothing matches", () => {
    const snap = createSnapshot({
      url: "https://example.com/xqz",
      title: "Random",
      textContent: "Some body copy with no signals at all.",
    });
    const r = classifyPageType(snap);
    expect(r.pageType).toBe("other");
    expect(r.confidence).toBe(0);
    expect(r.signals).toEqual([]);
  });

  it("only ever emits a PackPageType and an integer 0-100 confidence", () => {
    const cases = [
      createSnapshot({ url: "https://example.com/" }),
      createSnapshot({ url: "https://example.com/contact" }),
      createSnapshot({ url: "https://example.com/xqz" }),
      createSnapshot({ url: "https://example.com/blog" }),
    ];
    for (const snap of cases) {
      const r = classifyPageType(snap);
      expect(ALL_TYPES).toContain(r.pageType);
      expect(Number.isInteger(r.confidence)).toBe(true);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("lowers confidence when two page types are level-pegging", () => {
    // Same article evidence twice, once on a page with a competing contact
    // path. The margin term must pull confidence down on the ambiguous one.
    const clean = createSnapshot({
      url: "https://example.com/blog/tips",
      jsonLd: [{ "@type": "Article" }],
    });
    const ambiguous = createSnapshot({
      url: "https://example.com/blog/contact",
      jsonLd: [{ "@type": "Article" }],
    });
    const c = classifyPageType(clean);
    const a = classifyPageType(ambiguous);
    expect(c.pageType).toBe("article");
    expect(a.confidence).toBeLessThan(c.confidence);
  });

  it("breaks exact score ties deterministically by fixed order", () => {
    // An editorial path (article, 30) and a listing path (category, 30) are
    // an exact tie; the fixed PAGE_TYPE_ORDER decides it, every time.
    const snap = createSnapshot({ url: "https://example.com/blog/tags" });
    const first = classifyPageType(snap);
    const second = classifyPageType(snap);
    expect(first.pageType).toBe(second.pageType);
    // A tie also scores below a clean winner: margin is 0.5 on a tie, 1.0
    // when nothing competes.
    const cleanArticle = classifyPageType(
      createSnapshot({ url: "https://example.com/blog", jsonLd: [{ "@type": "Article" }] }),
    );
    expect(cleanArticle.pageType).toBe("article");
    expect(first.confidence).toBeLessThan(cleanArticle.confidence);
  });

  it("is deterministic — identical snapshots classify identically", () => {
    const build = () =>
      createSnapshot({
        url: "https://example.com/blog/deals",
        title: "Deals",
        jsonLd: [{ "@type": "Article" }],
      });
    expect(classifyPageType(build())).toEqual(classifyPageType(build()));
  });

  it("records every firing signal with its type prefix", () => {
    const snap = createSnapshot({
      url: "https://example.com/contact",
      title: "Contact",
      textContent: "Email us at info@example.com or call +1 555 123 4567.",
    });
    const r = classifyPageType(snap);
    expect(r.signals.length).toBeGreaterThan(0);
    for (const s of r.signals) {
      expect(s).toMatch(/^(home|product|category|article|location|booking|contact|other): /);
    }
  });

  it("scores are exposed per type", () => {
    const snap = createSnapshot({ url: "https://example.com/contact" });
    const r = classifyPageType(snap);
    expect(r.scores.contact).toBeGreaterThan(0);
  });
});
