import { describe, it, expect } from "vitest";
import {
  calculatePixelWidth,
  getTitlePixelStatus,
  getMetaDescPixelStatus,
  TITLE_PIXEL_LIMIT,
  META_DESC_PIXEL_LIMIT,
} from "../chrome-extension/src/utils/pixelCalculator";
import {
  BRAND_GUARDRAILS,
  validateBrandCompliance,
  BrandGuardrail,
} from "../chrome-extension/src/utils/brandGuardrails";
import {
  generateJsonLdPackage,
} from "../chrome-extension/src/utils/auditExporters";
import { isNewerVersion } from "../chrome-extension/src/background/auto-updater";
import { PageAuditData, ClientProfile } from "../chrome-extension/src/types/extension";

describe("SEO & GEO Studio — Comprehensive Unit Test Suite", () => {
  // ==========================================================================
  // 1. EXACT SERP PIXEL-WIDTH CALCULATIONS & THRESHOLD TRIGGERS
  // ==========================================================================
  describe("1. SERP Pixel-Width Engine", () => {
    it("differentiates narrow vs. wide characters accurately", () => {
      // Narrow characters
      const narrowCharI = calculatePixelWidth("i");
      const narrowCharL = calculatePixelWidth("l");
      const narrowCharPipe = calculatePixelWidth("|");
      const narrowCharDot = calculatePixelWidth(".");
      expect(narrowCharI).toBe(4);
      expect(narrowCharL).toBe(4);
      expect(narrowCharPipe).toBe(4);
      expect(narrowCharDot).toBe(4);

      // Wide uppercase & lowercase characters
      const wideCharW = calculatePixelWidth("W");
      const wideCharM = calculatePixelWidth("M");
      const wideCharm = calculatePixelWidth("m");
      const wideCharDash = calculatePixelWidth("—"); // em-dash
      expect(wideCharW).toBe(17);
      expect(wideCharM).toBe(16);
      expect(wideCharm).toBe(15);
      expect(wideCharDash).toBe(16);

      // Ten wide 'W' characters vs ten narrow 'i' characters
      const tenWide = calculatePixelWidth("WWWWWWWWWW"); // 10 * 17 = 170px
      const tenNarrow = calculatePixelWidth("iiiiiiiiii"); // 10 * 4 = 40px
      expect(tenWide).toBe(170);
      expect(tenNarrow).toBe(40);
      expect(tenWide).toBe(tenNarrow * 4.25);
    });

    it("calculates mixed hospitality titles with exact character arithmetic", () => {
      // "Hotel | Miami"
      // H(13) + o(10) + t(6) + e(9) + l(4) + space(5) + |(4) + space(5) + M(16) + i(4) + a(9) + m(15) + i(4) = 104px
      const sample = "Hotel | Miami";
      expect(calculatePixelWidth(sample)).toBe(104);
    });

    it("handles null, undefined, and empty string gracefully", () => {
      expect(calculatePixelWidth("")).toBe(0);
      expect(calculatePixelWidth(null)).toBe(0);
      expect(calculatePixelWidth(undefined)).toBe(0);

      const emptyTitle = getTitlePixelStatus("");
      expect(emptyTitle.pixelWidth).toBe(0);
      expect(emptyTitle.isOver).toBe(false);
      expect(emptyTitle.status).toBe("Optimal");
    });

    it("triggers Title 580px pixel limit boundary conditions precisely", () => {
      // Construct exact string at 580px
      // 34 'W' characters = 34 * 17 = 578px + one 'i' (4px) = 582px (over)
      // 34 * 17 = 578px + one space (5px) = 583px
      // 34 * 17 = 578px + two '.' (4+4=8) = 586px
      // Let's create an exact 580px string: 58 '0' characters (each 10px) = 580px
      const exactly580 = "0".repeat(58);
      expect(calculatePixelWidth(exactly580)).toBe(580);

      const status580 = getTitlePixelStatus(exactly580);
      expect(status580.pixelWidth).toBe(580);
      expect(status580.isOver).toBe(false);
      expect(status580.status).toBe("Optimal");

      // Exactly 581px: 58 '0's (580px) + one '1' (7px) = 587px (> 580px)
      // Or 57 '0's (570px) + 'W' (17px) = 587px
      // Let's create 581px: 57 '0's (570px) + 'T' (11px) = 581px!
      const exactly581 = "0".repeat(57) + "T";
      expect(calculatePixelWidth(exactly581)).toBe(581);

      const status581 = getTitlePixelStatus(exactly581);
      expect(status581.pixelWidth).toBe(581);
      expect(status581.isOver).toBe(true);
      expect(status581.status).toBe("Pixel Over Budget");
    });

    it("triggers Meta Description 920px pixel limit boundary conditions precisely", () => {
      // Exactly 920px: 92 '0' characters (each 10px) = 920px
      const exactly920 = "0".repeat(92);
      expect(calculatePixelWidth(exactly920)).toBe(920);

      const status920 = getMetaDescPixelStatus(exactly920);
      expect(status920.pixelWidth).toBe(920);
      expect(status920.isOver).toBe(false);
      expect(status920.status).toBe("Optimal");

      // Exactly 921px: 91 '0's (910px) + 'T' (11px) = 921px!
      const exactly921 = "0".repeat(91) + "T";
      expect(calculatePixelWidth(exactly921)).toBe(921);

      const status921 = getMetaDescPixelStatus(exactly921);
      expect(status921.pixelWidth).toBe(921);
      expect(status921.isOver).toBe(true);
      expect(status921.status).toBe("Pixel Over Budget");
    });
  });

  // ==========================================================================
  // 2. BRAND GUARDRAILS VALIDATION ACROSS 5 HOTEL BRANDS
  // ==========================================================================
  describe("2. Hotel Brand Guardrails Validation", () => {
    describe("Marriott Brand Standards", () => {
      it("passes valid brand-compliant Marriott content", () => {
        const result = validateBrandCompliance("Marriott", {
          title: "Beachfront Hotel Panama City | Marriott Bonvoy",
          metaDesc: "Book direct for oceanfront suites, complimentary hot breakfast, and lowest rates.",
          h1: "SpringHill Suites Panama City Beachfront",
          requireSuffix: true,
        });
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      it("catches prohibited terms ('free breakfast', 'marriott rewards', 'best hotel')", () => {
        const result = validateBrandCompliance("Marriott", {
          title: "The Best Hotel in Miami | Marriott Rewards",
          metaDesc: "Enjoy our free breakfast and cheapest rate on the beach.",
          h1: "SpringHill Suites Resort",
        });
        expect(result.valid).toBe(false);
        const forbiddenTerms = result.violations.map((v) => v.term);
        expect(forbiddenTerms).toContain("best hotel");
        expect(forbiddenTerms).toContain("marriott rewards");
        expect(forbiddenTerms).toContain("free breakfast");
        expect(forbiddenTerms).toContain("cheapest rate");
      });

      it("flags missing mandatory 'Marriott Bonvoy' suffix", () => {
        const result = validateBrandCompliance("Marriott", {
          title: "SpringHill Suites Panama City Beachfront Official Site",
          requireSuffix: true,
        });
        expect(result.valid).toBe(false);
        expect(result.violations.some((v) => v.type === "missing_suffix")).toBe(true);
      });

      it("flags title exceeding 60 characters", () => {
        const longTitle = "SpringHill Suites by Marriott Panama City Beachfront Resort & Spa Florida";
        const result = validateBrandCompliance("Marriott", {
          title: longTitle,
        });
        expect(result.valid).toBe(false);
        expect(result.violations.some((v) => v.type === "max_chars" && v.field === "title")).toBe(true);
      });
    });

    describe("Hilton Brand Standards", () => {
      it("passes valid brand-compliant Hilton content", () => {
        const result = validateBrandCompliance("Hilton", {
          title: "Downtown Miami Hotel Suites | Hilton Honors",
          metaDesc: "Enjoy complimentary Wi-Fi and flexible cancellation with Hilton Price Match Guarantee.",
          h1: "Hilton Miami Downtown",
          requireSuffix: true,
        });
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      it("catches forbidden terms ('free wifi', 'hilton hhonors', 'best rates in town')", () => {
        const result = validateBrandCompliance("Hilton", {
          title: "Hilton HHonors Hotel | Best Rates In Town",
          metaDesc: "Get free wifi and free cancellation when booking today.",
          h1: "Hilton Downtown",
        });
        expect(result.valid).toBe(false);
        const terms = result.violations.map((v) => v.term);
        expect(terms).toContain("hilton hhonors");
        expect(terms).toContain("best rates in town");
        expect(terms).toContain("free wifi");
        expect(terms).toContain("free cancellation");
      });

      it("flags missing mandatory 'Hilton Honors' suffix", () => {
        const result = validateBrandCompliance("Hilton", {
          title: "Hilton Miami Downtown Official Site",
          requireSuffix: true,
        });
        expect(result.valid).toBe(false);
        expect(result.violations.some((v) => v.type === "missing_suffix")).toBe(true);
      });
    });

    describe("IHG Brand Standards", () => {
      it("passes valid brand-compliant IHG content", () => {
        const result = validateBrandCompliance("IHG", {
          title: "Boutique Hotel in Chicago | IHG One Rewards",
          metaDesc: "Experience Kimpton hospitality in Chicago with daily dining perks and direct booking guarantees.",
          h1: "Kimpton Gray Hotel Chicago",
          requireSuffix: true,
        });
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      it("catches legacy 'ihg rewards club' and unverified superlatives", () => {
        const result = validateBrandCompliance("IHG", {
          title: "The Best Hotel in Chicago | IHG Rewards Club",
          metaDesc: "Includes free breakfast for all guests.",
        });
        expect(result.valid).toBe(false);
        const terms = result.violations.map((v) => v.term);
        expect(terms).toContain("ihg rewards club");
        expect(terms).toContain("best hotel");
        expect(terms).toContain("free breakfast");
      });
    });

    describe("Hyatt Brand Standards", () => {
      it("passes valid brand-compliant Hyatt content", () => {
        const result = validateBrandCompliance("Hyatt", {
          title: "Grand Hyatt San Francisco | World of Hyatt",
          metaDesc: "Stay in Union Square with city skyline views and exclusive Hyatt Member Rates.",
          h1: "Grand Hyatt San Francisco",
          requireSuffix: true,
        });
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      it("catches retired 'gold passport' and prohibited discount terminology", () => {
        const result = validateBrandCompliance("Hyatt", {
          title: "Gold Passport Luxury Resort in San Francisco",
          metaDesc: "Book the cheapest rooms with free cancellation online.",
        });
        expect(result.valid).toBe(false);
        const terms = result.violations.map((v) => v.term);
        expect(terms).toContain("gold passport");
        expect(terms).toContain("cheapest rooms");
        expect(terms).toContain("free cancellation");
      });
    });

    describe("Independent Luxury Hotel Standards", () => {
      it("passes valid independent hotel content", () => {
        const result = validateBrandCompliance("Independent", {
          title: "The Coachman Hotel Lake Tahoe | Official Site",
          metaDesc: "Boutique South Lake Tahoe hotel near Heavenly Village with fire pits, craft beer, and direct booking perks.",
          h1: "The Coachman Hotel",
          requireSuffix: true,
        });
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      it("catches cheap positioning and unenforceable liability claims", () => {
        const result = validateBrandCompliance("Independent", {
          title: "Cheapest Hotel In South Lake Tahoe",
          metaDesc: "100% satisfaction guaranteed for all room bookings.",
        });
        expect(result.valid).toBe(false);
        const terms = result.violations.map((v) => v.term);
        expect(terms).toContain("cheapest hotel in");
        expect(terms).toContain("100% satisfaction guaranteed");
      });
    });
  });

  // ==========================================================================
  // 3. JSON-LD SCHEMA GENERATION & PLACEHOLDER INTEGRITY
  // ==========================================================================
  describe("3. JSON-LD Schema Generation & Graph Integrity", () => {
    const mockAuditData: PageAuditData = {
      url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
      origin: "https://www.marriott.com",
      pathname: "/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
      protocol: "https:",
      hostname: "www.marriott.com",
      title: "SpringHill Suites Panama City Beachfront | Marriott Bonvoy",
      metaDesc: "Oceanfront suites on Gulf Coast with complimentary hot breakfast.",
      canonical: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
      h1Elements: ["SpringHill Suites Panama City Beachfront"],
      h2Elements: ["Suites", "Amenities"],
      h3Elements: ["Gulf View"],
      totalImages: 15,
      imagesWithoutAlt: 0,
      oversizedImages: 0,
      words: 650,
      schemas: [],
      links: { internal: 30, external: 5, nofollow: 1 },
      hasViewport: true,
      hasOgTitle: true,
      hasOgImage: true,
      ogTitle: "SpringHill Suites Panama City Beachfront",
      ogDescription: "Oceanfront hotel suites with pool and lazy river.",
      ogImage: "https://cache.marriott.com/exterior.jpg",
    };

    const mockProfile: ClientProfile = {
      id: "curtis-denver",
      name: "The Curtis Denver - a DoubleTree by Hilton",
      brand: "Hilton",
      domain: "thecurtis.com",
      city: "Denver",
      state: "CO",
      primaryKeywords: ["Denver Downtown Hotel"],
      usps: ["Pop culture theme", "Downtown location"],
      phone: "+1-303-571-0300",
      address: "1405 Curtis Street",
      postalCode: "80202",
    };

    it("generates valid Schema.org @graph without any undefined or null strings", () => {
      const output = generateJsonLdPackage(mockAuditData, mockProfile);

      // Verify wrapper
      expect(output).toContain('<script type="application/ld+json">');
      expect(output).toContain("</script>");

      // Verify zero undefined leaks
      expect(output).not.toContain("undefined");
      expect(output).not.toContain("null,");

      // Verify zero unreplaced mustache variables
      expect(output).not.toMatch(/\{\{[A-Za-z0-9_-]+\}\}/);
    });

    it("parses output into valid JSON-LD graph matching Schema.org specifications", () => {
      const output = generateJsonLdPackage(mockAuditData, mockProfile);

      // Extract raw JSON from script tags
      const jsonMatch = output.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(jsonMatch).not.toBeNull();

      const rawJson = jsonMatch![1].trim();
      const parsed = JSON.parse(rawJson);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(Array.isArray(parsed["@graph"])).toBe(true);

      const graph = parsed["@graph"] as Array<Record<string, unknown>>;
      const hotelSchema = graph.find((item) => item["@type"] === "Hotel");
      const faqSchema = graph.find((item) => item["@type"] === "FAQPage");

      expect(hotelSchema).toBeDefined();
      expect(hotelSchema!["name"]).toBe(mockProfile.name);
      expect(hotelSchema!["telephone"]).toBe(mockProfile.phone);

      const address = hotelSchema!["address"] as Record<string, string>;
      expect(address["streetAddress"]).toBe(mockProfile.address);
      expect(address["addressLocality"]).toBe(mockProfile.city);
      expect(address["addressRegion"]).toBe(mockProfile.state);
      expect(address["postalCode"]).toBe(mockProfile.postalCode);

      expect(faqSchema).toBeDefined();
      const mainEntity = faqSchema!["mainEntity"] as Array<Record<string, unknown>>;
      expect(mainEntity.length).toBeGreaterThanOrEqual(2);
      expect(mainEntity[0]["@type"]).toBe("Question");
    });
  });

  // ==========================================================================
  // 4. SEMVER COMPARISON LOGIC IN AUTO-UPDATER SERVICE WORKER
  // ==========================================================================
  describe("4. SemVer Comparison Logic in Auto-Updater", () => {
    it("handles major version progression", () => {
      expect(isNewerVersion("2.7.0", "3.0.0")).toBe(true);
      expect(isNewerVersion("1.9.9", "2.0.0")).toBe(true);
      expect(isNewerVersion("3.0.0", "2.7.0")).toBe(false);
    });

    it("handles minor version progression", () => {
      expect(isNewerVersion("2.6.1", "2.7.0")).toBe(true);
      expect(isNewerVersion("2.7.0", "2.8.0")).toBe(true);
      expect(isNewerVersion("2.7.0", "2.6.9")).toBe(false);
    });

    it("handles patch version progression", () => {
      expect(isNewerVersion("2.7.0", "2.7.1")).toBe(true);
      expect(isNewerVersion("2.7.1", "2.7.2")).toBe(true);
      expect(isNewerVersion("2.7.2", "2.7.1")).toBe(false);
    });

    it("handles multi-digit SemVer segments correctly", () => {
      expect(isNewerVersion("2.9.0", "2.10.0")).toBe(true);
      expect(isNewerVersion("2.10.0", "2.9.0")).toBe(false);
      expect(isNewerVersion("2.7.9", "2.7.10")).toBe(true);
      expect(isNewerVersion("2.7.10", "2.7.9")).toBe(false);
    });

    it("handles version prefix 'v' and differing component lengths", () => {
      expect(isNewerVersion("v2.6.1", "v2.7.0")).toBe(true);
      expect(isNewerVersion("2.6.1", "v2.7.0")).toBe(true);
      expect(isNewerVersion("v2.7.0", "2.7.0")).toBe(false);
      expect(isNewerVersion("2.7", "2.7.1")).toBe(true);
      expect(isNewerVersion("2.7.1", "2.7")).toBe(false);
    });

    it("returns false for identical versions", () => {
      expect(isNewerVersion("2.7.0", "2.7.0")).toBe(false);
      expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
      expect(isNewerVersion("v2.7.0", "v2.7.0")).toBe(false);
    });
  });
});
