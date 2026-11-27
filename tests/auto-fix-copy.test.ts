import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  FAQ_REQUIRES_VERIFIED_ANSWERS,
  buildHotelSchema,
  buildOrganizationSchema,
  buildSocialSnippet,
  withFlags,
} from "../chrome-extension/src/engine/auto-fix-copy";

describe("buildHotelSchema", () => {
  it("leaves description blank when the page has no meta description", () => {
    const { schema, blankFields } = buildHotelSchema({
      siteName: "Ocean Resort",
      canonicalUrl: "https://example.com/",
      metaDesc: "   ",
      profile: {},
    });

    expect(schema.description).toBe("");
    expect(blankFields).toContain("description — page has no meta description");
    // No invented contact or location facts.
    expect(schema).not.toHaveProperty("telephone");
    expect(schema).not.toHaveProperty("address");
    expect(schema).not.toHaveProperty("geo");
    expect(schema).not.toHaveProperty("checkinTime");
    expect(schema).not.toHaveProperty("checkoutTime");
    expect(schema).not.toHaveProperty("amenityFeature");
    expect(schema).not.toHaveProperty("priceRange");
    expect(blankFields).toContain("geo coordinates — no verified source");
    expect(blankFields).toContain("amenity features — no verified source");
  });

  it("uses the page's own meta description when there is one", () => {
    const { schema, blankFields } = buildHotelSchema({
      siteName: "Ocean Resort",
      canonicalUrl: "https://example.com/",
      metaDesc: "Oceanfront rooms two blocks from the pier.",
      profile: {},
    });
    expect(schema.description).toBe("Oceanfront rooms two blocks from the pier.");
    expect(blankFields).not.toContain("description — page has no meta description");
  });

  it("takes contact details from the saved client profile only", () => {
    const { schema, blankFields } = buildHotelSchema({
      siteName: "Ocean Resort",
      canonicalUrl: "https://example.com/",
      metaDesc: "Stay here.",
      profile: {
        phone: " +1 555 0100 ",
        address: "1 Beach Rd",
        city: "Gulf Shores",
        state: "AL",
        postalCode: "36542",
      },
    });

    expect(schema.telephone).toBe("+1 555 0100");
    expect(schema.address).toEqual({
      "@type": "PostalAddress",
      addressCountry: "US",
      streetAddress: "1 Beach Rd",
      addressLocality: "Gulf Shores",
      addressRegion: "AL",
      postalCode: "36542",
    });
    expect(blankFields).not.toContain("telephone — not in the client profile");
  });

  it("flags a partially filled profile instead of filling gaps with defaults", () => {
    const { schema, blankFields } = buildHotelSchema({
      siteName: "Ocean Resort",
      canonicalUrl: "https://example.com/",
      metaDesc: "Stay here.",
      profile: { city: "Gulf Shores" },
    });
    expect(schema.address).toMatchObject({ addressLocality: "Gulf Shores" });
    expect(blankFields).toContain("address.streetAddress — not in the client profile");
    expect(blankFields).toContain("telephone — not in the client profile");
  });
});

describe("buildOrganizationSchema", () => {
  it("keeps a missing description blank and flags it", () => {
    const { schema, blankFields } = buildOrganizationSchema({
      siteName: "Acme",
      canonicalUrl: "https://acme.test/",
      metaDesc: "",
    });
    expect(schema.description).toBe("");
    expect(blankFields).toContain("description — page has no meta description");
    expect(schema).not.toHaveProperty("sameAs");
  });

  it("carries real social links through", () => {
    const { schema } = buildOrganizationSchema({
      siteName: "Acme",
      canonicalUrl: "https://acme.test/",
      metaDesc: "Acme home",
      socialLinks: [{ url: "https://x.com/acme" }],
    });
    expect(schema.sameAs).toEqual(["https://x.com/acme"]);
  });
});

describe("buildSocialSnippet", () => {
  it("emits description and image tags only when the page has them", () => {
    const full = buildSocialSnippet({
      siteName: "Ocean Resort",
      title: "Ocean Resort | Gulf Shores",
      metaDesc: "Rooms by the water.",
      image: "https://example.com/hero.jpg",
      url: "https://example.com/",
    });
    expect(full.snippet).toContain('<meta property="og:description" content="Rooms by the water." />');
    expect(full.snippet).toContain('<meta property="og:image" content="https://example.com/hero.jpg" />');
    expect(full.snippet).toContain('content="summary_large_image"');
    expect(full.blankFields).toEqual([]);
  });

  it("omits og:description and og:image rather than inventing them", () => {
    const bare = buildSocialSnippet({
      siteName: "Ocean Resort",
      title: "",
      metaDesc: "",
      url: "https://example.com/",
    });
    expect(bare.snippet).not.toContain("og:description");
    expect(bare.snippet).not.toContain("og:image");
    expect(bare.snippet).not.toContain("twitter:image");
    // twitter:card downgrades to "summary" when there is no image to show.
    expect(bare.snippet).toContain('content="summary"');
    // Title falls back to the real site name, not marketing copy.
    expect(bare.snippet).toContain('<meta property="og:title" content="Ocean Resort" />');
    expect(bare.snippet).toContain('<meta name="twitter:title" content="Ocean Resort" />');
    expect(bare.blankFields).toEqual([
      "og:description — page has no meta description",
      "og:image — no image found on the page",
    ]);
  });
});

describe("withFlags", () => {
  it("lists what was left blank", () => {
    const text = withFlags("Injected schema.", ["telephone — not in the client profile"]);
    expect(text).toContain("Injected schema.");
    expect(text).toContain("Not populated (no verified source):");
    expect(text).toContain("• telephone — not in the client profile");
  });

  it("returns the base text untouched when nothing is blank", () => {
    expect(withFlags("Clean.", [])).toBe("Clean.");
  });
});

describe("FAQ copy guard", () => {
  it("refuses to invent amenity and policy answers", () => {
    expect(FAQ_REQUIRES_VERIFIED_ANSWERS).toContain("will not invent");
    expect(FAQ_REQUIRES_VERIFIED_ANSWERS).toContain("FAQ");
  });
});

describe("SidePanelApp auto-fix handler", () => {
  it("no longer ships hardcoded property copy as page data", async () => {
    const source = await readFile(
      new URL("../chrome-extension/src/sidepanel/SidePanelApp.tsx", import.meta.url),
      "utf8",
    );

    // Fabricated copy that used to be written into the page when a suggestion
    // was missing — each of these must stay gone.
    for (const invented of [
      "Premier hospitality destination",
      "Book direct at SpringHill Suites",
      "Discover official solutions, products, and direct benefits",
      "https://images.unsplash.com/photo-1542314831",
      "Beachfront Hotel Panama City Beach | SpringHill Suites",
      "complimentary daily hot buffet breakfast",
      "Marriott Bonvoy app",
      "14401 Front Beach Rd",
      "+1-850-230-6004",
    ]) {
      expect(source).not.toContain(invented);
    }

    // The handler must route through the sourced-copy helpers.
    expect(source).toContain("buildHotelSchema");
    expect(source).toContain("buildSocialSnippet");
    expect(source).toContain("FAQ_REQUIRES_VERIFIED_ANSWERS");
  });
});
