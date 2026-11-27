/**
 * The one-click Unified Packet (`AutomationBulkRunner` → `engine/unified-packet`).
 *
 * Guards the Phase E sub-item fix: packet variables come from the template's
 * own defaults overlaid with profile/page-sourced values — never invented
 * copy — and every `{{...}}` token resolves (three of the five sections used
 * to ship unresolved tokens).
 */
import { describe, expect, it } from "vitest";
import {
  PACKET_TEMPLATE_IDS,
  buildUnifiedPacket,
  collectPacketSources,
} from "../chrome-extension/src/engine/unified-packet";
import {
  SEO_STUDIO_TEMPLATES,
  resolveTemplateContent,
} from "../chrome-extension/src/data/seoStudioTemplates";
import type { ClientProfile, PageAuditData } from "../chrome-extension/src/types/extension";

const profile: ClientProfile = {
  id: "p1",
  name: "The Curtis Denver",
  brand: "The Curtis",
  domain: "thecurtis.com",
  city: "Denver",
  state: "CO",
  primaryKeywords: ["boutique hotels denver"],
  usps: ["pop art rooms"],
  phone: "+1-303-571-0000",
  address: "250 Curtis St",
  postalCode: "80202",
};

const page = {
  url: "https://thecurtis.com/rooms",
  origin: "https://thecurtis.com",
  pathname: "/rooms",
  protocol: "https:",
  hostname: "thecurtis.com",
  title: "The Curtis Denver | Boutique Hotel",
  metaDesc: "Current meta description",
  canonical: "https://thecurtis.com/rooms",
  h1Elements: [],
  h2Elements: [],
  h3Elements: [],
  totalImages: 0,
  imagesWithoutAlt: 0,
  oversizedImages: 0,
  words: 500,
  schemas: [],
  links: { internal: 0, external: 0, nofollow: 0 },
  hasViewport: true,
  hasOgTitle: true,
  hasOgImage: true,
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
} as PageAuditData;

/** Copy the old builder invented as fallbacks — none of it may ever appear. */
const INVENTED_COPY = [
  "Luxury Beachfront Hotel",
  "Panama City Beachfront Hotel",
  "+1-850-230-6004",
  "12513 Front Beach Road",
  "32407",
  "https://example.com",
  "Enjoy luxury accommodations",
  "Direct beach access, resort-style pools",
  "Beachfront Hotels Panama City Beach",
  "Early check-in is available upon request",
  "EV vehicle chargers",
];

function unresolvedTokens(text: string): string[] {
  return Array.from(new Set(text.match(/\{\{[a-zA-Z0-9_]+\}\}/g) ?? []));
}

describe("collectPacketSources", () => {
  it("takes exactly the profile/page-sourced values, with no invented keys", () => {
    expect(collectPacketSources(profile, page)).toEqual({
      hotelName: "The Curtis Denver",
      cityName: "Denver",
      stateCode: "CO",
      targetKeyword: "boutique hotels denver",
      phoneNumber: "+1-303-571-0000",
      streetAddress: "250 Curtis St",
      postalCode: "80202",
      canonicalUrl: "https://thecurtis.com/rooms",
      originUrl: "https://thecurtis.com",
    });
  });

  it("returns nothing at all when there is no profile and no page", () => {
    expect(collectPacketSources()).toEqual({});
    expect(collectPacketSources(undefined, undefined)).toEqual({});
  });

  it("derives hotelName from the audited page title when no profile is set", () => {
    const sources = collectPacketSources(undefined, page);
    expect(sources.hotelName).toBe("The Curtis Denver");
    expect(sources).not.toHaveProperty("cityName");
  });
});

describe("buildUnifiedPacket", () => {
  it("renders all five sections with no unresolved tokens, even with no sources", () => {
    const packet = buildUnifiedPacket({}, "1/1/2026");
    expect(unresolvedTokens(packet)).toEqual([]);
    for (const heading of [
      "## 1. On-Page Title Tag & Meta Description",
      "## 2. H1 Headline & Above-the-Fold USP Banner",
      "## 3. Validated JSON-LD Schema (@graph Hotel + Breadcrumbs)",
      "## 4. On-Page FAQ & Amenities Section",
      "## 5. GEO & AI Citation Optimization Prompt",
    ]) {
      expect(packet).toContain(heading);
    }
    // Unsourced variables keep template sample text, and the packet says so.
    expect(packet).toContain("sample text");
  });

  it("keeps the JSON-LD section parseable with template defaults", () => {
    const packet = buildUnifiedPacket({}, "1/1/2026");
    const jsonBlock = packet.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "";
    expect(jsonBlock).not.toBe("");
    expect(() => JSON.parse(jsonBlock)).not.toThrow();
  });

  it("uses profile/page values and never the old invented copy", () => {
    const packet = buildUnifiedPacket(collectPacketSources(profile, page), "1/1/2026");
    expect(packet).toContain("**Property:** The Curtis Denver (Denver, CO)");
    expect(packet).toContain("**Target URL:** https://thecurtis.com/rooms");
    expect(packet).toContain("**Primary Target Keyword:** boutique hotels denver");
    for (const invented of INVENTED_COPY) {
      expect(packet).not.toContain(invented);
    }
    // Sample values remain where no source exists (e.g. a sample hero image),
    // so the packet must label them instead of passing them off as the
    // property's own copy.
    expect(packet).toContain("sample text");
  });

  it("drops the sample label once every packet variable is supplied", () => {
    const everyKey: Record<string, string> = {};
    for (const id of PACKET_TEMPLATE_IDS) {
      const template = SEO_STUDIO_TEMPLATES.find((t) => t.id === id);
      expect(template, `packet template ${id} must exist`).toBeDefined();
      for (const key of Object.keys(template!.defaultVariables)) {
        everyKey[key] = `value-${key}`;
      }
    }
    const packet = buildUnifiedPacket(everyKey, "1/1/2026");
    expect(packet).not.toContain("sample text");
    expect(unresolvedTokens(packet)).toEqual([]);
  });
});

describe("resolveTemplateContent (delegates to the shared renderer)", () => {
  it("resolves {{key}}, ${key} and {key} forms", () => {
    expect(resolveTemplateContent("A {{name}} B ${name} C {name}", { name: "X" })).toBe(
      "A X B X C X"
    );
  });

  it("keeps the visible [key] marker for blank values", () => {
    expect(resolveTemplateContent("Hello {{name}}!", { name: "" })).toBe("Hello [name]!");
  });
});
