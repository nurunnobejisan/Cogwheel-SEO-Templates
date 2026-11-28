/**
 * Phase F — AI/ops layer: no invented copy, anywhere.
 *
 * 1. `buildReadyToPasteSnippet` / `initialLiveFields` (engine/studio-export.ts)
 *    must emit only values sourced from the page, the client profile or the
 *    operator's own live fields.
 * 2. A source guard over every file that drafts copy so the removed
 *    placeholder literals (stock images, fake addresses, invented ratings,
 *    fabricated FAQ answers, API keys in URLs) can never come back.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildReadyToPasteSnippet,
  initialLiveFields,
} from "../chrome-extension/src/engine/studio-export";
import { BRAND_GUARDRAILS } from "../src/packs/hotel/brand-guardrails";
import type { ClientProfile, PageAuditData } from "../chrome-extension/src/types/extension";

function makePage(overrides: Partial<PageAuditData> = {}): PageAuditData {
  return {
    url: "https://seaside-inn.example.org/rooms",
    origin: "https://seaside-inn.example.org",
    pathname: "/rooms",
    protocol: "https:",
    hostname: "seaside-inn.example.org",
    title: "Rooms at Seaside Inn",
    metaDesc: "",
    canonical: "https://seaside-inn.example.org/rooms",
    h1Elements: ["Rooms"],
    h2Elements: [],
    h3Elements: [],
    totalImages: 0,
    imagesWithoutAlt: 0,
    oversizedImages: 0,
    links: { internal: 0, external: 0, nofollow: 0 },
    hasViewport: true,
    hasOgTitle: false,
    hasOgImage: false,
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    words: 300,
    schemas: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    id: "p1",
    name: "Seaside Inn",
    brand: "Independent",
    domain: "seaside-inn.example.org",
    city: "Rockport",
    state: "TX",
    primaryKeywords: [],
    usps: [],
    phone: "+1-555-0100",
    address: "9 Seaside Ave",
    postalCode: "78382",
    ...overrides,
  };
}

function extractJsonLd(snippet: string): unknown[] {
  const match = snippet.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
  if (!match) return [];
  const parsed = JSON.parse(match[1]) as { "@graph": unknown[] };
  return parsed["@graph"];
}

describe("initialLiveFields", () => {
  it("starts blank when there is no page and no profile", () => {
    expect(initialLiveFields()).toEqual({ title: "", meta: "", h1: "", geoAnswer: "" });
  });

  it("seeds title, meta and h1 from the page", () => {
    const page = makePage({ title: "Seaside Inn Rooms", metaDesc: "Cozy rooms by the bay." });
    const fields = initialLiveFields(page);
    expect(fields.title).toBe("Seaside Inn Rooms");
    expect(fields.meta).toBe("Cozy rooms by the bay.");
    expect(fields.h1).toBe("Rooms");
    expect(fields.geoAnswer).toBe("");
  });
});

describe("buildReadyToPasteSnippet", () => {
  const guardrail = BRAND_GUARDRAILS.Independent;

  it("uses only page/profile/live values and parses as JSON-LD", () => {
    const page = makePage({ siteCategory: "hospitality", ogImage: "https://cdn.example.org/hero.jpg" });
    const profile = makeProfile();
    const snippet = buildReadyToPasteSnippet({
      pageData: page,
      activeProfile: profile,
      liveTitle: "Seaside Inn | Rooms",
      liveMeta: "Rooms by the bay.",
      liveH1: "Rooms",
      liveGeoAnswer: "Seaside Inn has 24 rooms.",
      activeGuardrail: guardrail,
    });

    expect(snippet).toContain("<title>Seaside Inn | Rooms</title>");
    expect(snippet).toContain('<meta property="og:image" content="https://cdn.example.org/hero.jpg" />');

    const graph = extractJsonLd(snippet);
    const hotel = graph.find((n) => (n as { "@type": string })["@type"] === "Hotel") as Record<string, unknown>;
    expect(hotel).toBeDefined();
    expect(hotel.name).toBe("Rooms");
    expect(hotel.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "9 Seaside Ave",
      addressLocality: "Rockport",
      addressRegion: "TX",
      postalCode: "78382",
      addressCountry: "US",
    });
    expect(hotel.telephone).toBe("+1-555-0100");
    // Never invents price or rating claims.
    expect(hotel).not.toHaveProperty("priceRange");
    expect(hotel).not.toHaveProperty("starRating");
  });

  it("omits unsourced properties instead of substituting placeholders", () => {
    const page = makePage({ siteCategory: "hospitality", ogImage: "" });
    const profile = makeProfile({
      phone: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
    });
    const snippet = buildReadyToPasteSnippet({
      pageData: page,
      activeProfile: profile,
      liveTitle: "",
      liveMeta: "",
      liveH1: "",
      liveGeoAnswer: "",
      activeGuardrail: guardrail,
    });

    const graph = extractJsonLd(snippet);
    const hotel = graph.find((n) => (n as { "@type": string })["@type"] === "Hotel") as Record<string, unknown>;
    expect(hotel).toBeDefined();
    expect(hotel).not.toHaveProperty("address");
    expect(hotel).not.toHaveProperty("telephone");
    expect(hotel).not.toHaveProperty("image");
    expect(snippet).not.toContain("og:image");
    expect(snippet).not.toContain("og:title");
    expect(snippet).toContain("No verified GEO knowledge block");

    for (const banned of [
      "12513",
      "Panama City",
      "32407",
      "850-230",
      "Unsplash",
      "photo-1505740420928",
      "99.00",
      '"ratingValue"',
      "example.com/page",
      "Official Site",
    ]) {
      expect(snippet).not.toContain(banned);
    }
  });

  it("emits ecommerce offers only when the page provides a price", () => {
    const noPrice = buildReadyToPasteSnippet({
      pageData: makePage({ siteCategory: "ecommerce" }),
      activeProfile: makeProfile(),
      liveTitle: "t",
      liveMeta: "",
      liveH1: "h",
      liveGeoAnswer: "",
      activeGuardrail: guardrail,
    });
    expect(noPrice).not.toContain('"offers"');

    const priced = buildReadyToPasteSnippet({
      pageData: makePage({
        siteCategory: "ecommerce",
        ecommerce: { isEcommerce: true, price: "$149.00", currency: "USD" },
      }),
      activeProfile: makeProfile(),
      liveTitle: "t",
      liveMeta: "",
      liveH1: "h",
      liveGeoAnswer: "",
      activeGuardrail: guardrail,
    });
    const graph = extractJsonLd(priced);
    const product = graph.find((n) => (n as { "@type": string })["@type"] === "Product") as Record<string, unknown>;
    expect((product.offers as Record<string, unknown>).price).toBe("149.00");
    expect((product.offers as Record<string, unknown>).priceCurrency).toBe("USD");
  });
});

describe("source guard: invented copy cannot return", () => {
  const guardedFiles = [
    "chrome-extension/src/engine/custom-model-client.ts",
    "chrome-extension/src/components/TemplateStudio.tsx",
    "chrome-extension/src/engine/studio-export.ts",
  ];

  const banned = [
    "SpringHill Suites Panama City Beachfront",
    "Beachfront Resort & Spa",
    "12513 Front Beach",
    "marriott.com/hotel",
    "?key=${",
    "official hospitality destination",
    "lowest rate guarantee",
    "photo-1505740420928",
    "example.com/hotel",
    "example.com/page",
    "+1-555-019-2834",
    "+1-850-230-6004",
    "Pool, Wi-Fi, Breakfast",
    "ratingValue",
    "priceRange",
    "Check-in begins at 4:00 PM",
  ];

  it.each(guardedFiles)("no banned placeholder survives in %s", (file) => {
    const source = readFileSync(path.join(__dirname, "..", file), "utf8");
    for (const literal of banned) {
      expect(source, `${file} must not contain ${JSON.stringify(literal)}`).not.toContain(literal);
    }
  });
});
