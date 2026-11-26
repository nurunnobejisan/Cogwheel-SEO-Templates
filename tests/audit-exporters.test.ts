import { describe, it, expect } from "vitest";
import {
  generateExecutiveHtmlReport,
  generateJsonLdPackage,
  generatePortfolioCsv,
  detectHotelBrand,
  escapeCsvCell,
  escapeHtml,
} from "../chrome-extension/src/utils/auditExporters";
import { PageAuditData, ScoreBreakdown, ClientProfile } from "../chrome-extension/src/types/extension";

describe("Audit Exporters Engine", () => {
  const mockPageData: PageAuditData = {
    url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    origin: "https://www.marriott.com",
    pathname: "/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    protocol: "https:",
    hostname: "www.marriott.com",
    title: "Beachfront Hotels Panama City Beach | SpringHill Suites Panama City Beachfront Resort & Spa",
    titlePixelWidth: 820,
    metaDesc: "Stay beachfront in Panama City Beach suites with lazy river pool access.",
    metaDescPixelWidth: 590,
    canonical: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    h1Elements: ["SpringHill Suites Panama City Beachfront"],
    h2Elements: ["Oceanfront Suites", "Resort Amenities"],
    h3Elements: ["King Suite", "Double Queen"],
    totalImages: 24,
    imagesWithoutAlt: 0,
    oversizedImages: 1,
    words: 520,
    schemas: [
      {
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Home" }],
      },
    ],
    links: { internal: 42, external: 8, nofollow: 2 },
    hasViewport: true,
    hasOgTitle: true,
    hasOgImage: true,
    ogTitle: "SpringHill Suites Panama City Beachfront",
    ogDescription: "Stay beachfront with lazy river and gulf-front suites.",
    ogImage: "https://cache.marriott.com/exterior.jpg",
  };

  const mockScores: ScoreBreakdown = {
    overall: 88,
    onPage: 85,
    schemaTechnical: 90,
    geoAiReadiness: 89,
    grade: "A",
    gradeColor: "text-emerald-400",
    passedGates: 5,
    totalGates: 6,
    quickWins: [
      {
        id: "schema-hotel-missing",
        title: "Missing JSON-LD Hotel Schema",
        severity: "high",
        impact: "Missing Schema.org/Hotel structured data blocks Google rich snippets.",
        templateIdToFix: "schema-hotel-graph",
      },
    ],
  };

  const mockProfile: ClientProfile = {
    id: "profile-marriott",
    name: "SpringHill Suites Panama City Beachfront",
    brand: "Marriott",
    domain: "marriott.com",
    city: "Panama City Beach",
    state: "FL",
    primaryKeywords: ["Panama City Beach Hotels"],
    usps: ["Beachfront", "Lazy River"],
    phone: "+1-850-230-6004",
    address: "14401 Front Beach Rd",
    postalCode: "32413",
  };

  describe("detectHotelBrand", () => {
    it("detects Marriott from URL and domain", () => {
      expect(detectHotelBrand(mockPageData)).toBe("Marriott");
    });

    it("detects Hilton from URL and domain", () => {
      const hiltonData = {
        ...mockPageData,
        hostname: "www.hilton.com",
        url: "https://www.hilton.com/en/hotels/miamhh-hilton-miami-downtown/",
      };
      expect(detectHotelBrand(hiltonData)).toBe("Hilton");
    });

    it("detects IHG and Hyatt brands", () => {
      expect(
        detectHotelBrand({
          ...mockPageData,
          hostname: "www.ihg.com",
          url: "https://www.ihg.com/holidayinn/hotels/us/en/reservation",
          title: "Holiday Inn Resort",
        })
      ).toBe("IHG");
      expect(
        detectHotelBrand({
          ...mockPageData,
          hostname: "www.hyatt.com",
          url: "https://www.hyatt.com/en-US/hotel/california/grand-hyatt-san-francisco",
          title: "Grand Hyatt San Francisco",
        })
      ).toBe("Hyatt");
    });

    it("falls back to Independent for independent hotels", () => {
      const independentData = {
        ...mockPageData,
        hostname: "www.thecoachmanhotel.com",
        url: "https://www.thecoachmanhotel.com/",
        title: "The Coachman Hotel Lake Tahoe",
      };
      expect(detectHotelBrand(independentData)).toBe("Independent Luxury");
    });
  });

  describe("generateExecutiveHtmlReport", () => {
    it("generates a complete, print-ready HTML document", () => {
      const html = generateExecutiveHtmlReport(mockPageData, mockScores, mockProfile);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<title>Executive Audit Report - www.marriott.com</title>");
      expect(html).toContain("SEO STUDIO SEO & GEO STUDIO");
      expect(html).toContain("Hospitality Executive Search & GEO Audit");
      expect(html).toContain("Marriott");
      expect(html).toContain("88<span class=\"kpi-scale\">/100</span>");
      expect(html).toContain("85<span class=\"kpi-scale\">/100</span>");
      expect(html).toContain("90<span class=\"kpi-scale\">/100</span>");
      expect(html).toContain("89<span class=\"kpi-scale\">/100</span>");
      expect(html).toContain("@media print");
      expect(html).toContain("window.print()");
      expect(html).toContain("Missing JSON-LD Hotel Schema");
    });
  });

  describe("generateJsonLdPackage", () => {
    it("generates formatted application/ld+json package with synthesized Hotel and FAQ schemas", () => {
      const packageOutput = generateJsonLdPackage(mockPageData, mockProfile);

      expect(packageOutput).toContain('<script type="application/ld+json">');
      expect(packageOutput).toContain('"@context": "https://schema.org"');
      expect(packageOutput).toContain('"@graph":');
      expect(packageOutput).toContain('"@type": "Hotel"');
      expect(packageOutput).toContain('"@type": "FAQPage"');
      expect(packageOutput).toContain("SpringHill Suites Panama City Beachfront");
      expect(packageOutput).toContain("Panama City Beach");
      expect(packageOutput).toContain("FL");
    });
  });

  describe("generatePortfolioCsv", () => {
    it("generates valid RFC 4180 CSV with headers and row data", () => {
      const csv = generatePortfolioCsv(mockPageData, mockScores, mockProfile);
      const lines = csv.trim().split("\n");

      expect(lines.length).toBe(2);

      const header = lines[0];
      expect(header).toContain('"Property URL"');
      expect(header).toContain('"Composite Score"');
      expect(header).toContain('"On-Page Score"');
      expect(header).toContain('"Schema Score"');
      expect(header).toContain('"GEO AI Score"');

      const dataRow = lines[1];
      expect(dataRow).toContain('"www.marriott.com"');
      expect(dataRow).toContain('"Marriott"');
      expect(dataRow).toContain('"88"');
      expect(dataRow).toContain('"A"');
    });
  });

  describe("escaping helpers", () => {
    it("escapes CSV cells with internal quotes and commas", () => {
      expect(escapeCsvCell('Luxury "Boutique", Hotel')).toBe('"Luxury ""Boutique"", Hotel"');
      expect(escapeCsvCell(null)).toBe('""');
    });

    it("escapes HTML entities", () => {
      expect(escapeHtml('<script>alert("xss & fun")</script>')).toBe(
        "&lt;script&gt;alert(&quot;xss &amp; fun&quot;)&lt;/script&gt;"
      );
    });
  });
});
