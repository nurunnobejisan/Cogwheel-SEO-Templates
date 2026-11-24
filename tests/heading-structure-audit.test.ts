import { describe, it } from "node:test";
import assert from "node:assert";
import * as XLSX from "xlsx";
import {
  classifyPageUrl,
  deriveTargetKeyword,
  analyzeAndOptimizeHeadings,
  toTitleCase,
} from "../src/core/heading-audit/analyzer.ts";
import { extractHeadingsFromHtml } from "../src/core/heading-audit/crawler.ts";
import { generateHeadingAuditWorkbook } from "../src/core/heading-audit/excel.ts";
import type {
  PageHeadingAudit,
  HeadingAuditSummary,
} from "../src/core/heading-audit/types.ts";

describe("Heading Structure Optimization Audit Engine (The Nines)", () => {
  it("classifies hotel page categories and primary target keywords accurately", () => {
    assert.strictEqual(classifyPageUrl("https://thenines.com/").category, "HOME PAGE");
    assert.strictEqual(classifyPageUrl("https://thenines.com/rooms/superior/").category, "Accommodations");
    assert.strictEqual(classifyPageUrl("https://thenines.com/dining/departure/").category, "DINING");
    assert.strictEqual(classifyPageUrl("https://thenines.com/meetings-events/").category, "MEETING & EVENTS");
    assert.strictEqual(classifyPageUrl("https://thenines.com/explore-portland/").category, "General Pages");

    const homeKw = deriveTargetKeyword("https://thenines.com/", "The Nines Hotel Downtown Portland");
    assert.strictEqual(homeKw, "Downtown Portland Hotels");

    const roomKw = deriveTargetKeyword(
      "https://thenines.com/rooms/one-bedroom-suite/",
      "One Bedroom Suite | The Nines"
    );
    assert.strictEqual(roomKw, "One Bedroom Suite Downtown Portland");

    const diningKw = deriveTargetKeyword(
      "https://thenines.com/dining/departure-restaurant/",
      "Departure Restaurant & Lounge"
    );
    assert.strictEqual(diningKw, "Rooftop Restaurant In Portland: Departure");
  });

  it("extracts headings in document order and identifies unrendered JS templates", () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>The Nines Luxury Hotel Portland</title></head>
        <body>
          <header>
            <div class="booking-widget">
              <h3 class="widget-title">Check Availability</h3>
            </div>
          </header>
          <main>
            <h1>The Nines, a Luxury Collection Hotel, Portland</h1>
            <p>Welcome to our historic downtown destination.</p>
            <h2>'+page.title+'</h2>
            <h2>ACCOMMODATIONS AT THE NINES</h2>
            <h4>DELUXE ROOMS</h4>
            <h2>DINING EXPERIENCES</h2>
            <h3>Urban Farmer Steakhouse</h3>
            <h2></h2>
          </main>
        </body>
      </html>
    `;

    const rawHeadings = extractHeadingsFromHtml(mockHtml);
    assert.strictEqual(rawHeadings.length, 8);

    // 1. First in document order is H3 Check Availability
    assert.strictEqual(rawHeadings[0].tag, "H3");
    assert.strictEqual(rawHeadings[0].text, "Check Availability");

    // 2. Main H1
    assert.strictEqual(rawHeadings[1].tag, "H1");
    assert.ok(rawHeadings[1].text.includes("The Nines"));

    // 3. Template placeholder
    assert.strictEqual(rawHeadings[2].text, "'+page.title+'");

    // 4. Empty heading
    assert.strictEqual(rawHeadings[7].text, "");
  });

  it("analyzes heading hierarchy and flags deterministic issues", () => {
    const rawHeadings = [
      { tag: "H3" as const, text: "Check Availability", position: 1 },
      { tag: "H1" as const, text: "The Nines Luxury Hotel", position: 2 },
      { tag: "H2" as const, text: "'+page.title+'", position: 3 },
      { tag: "H2" as const, text: "LUXURY ROOMS AND SUITES", position: 4 },
      { tag: "H4" as const, text: "Presidential Suite", position: 5 }, // Skipped level (H2 -> H4)
      { tag: "H1" as const, text: "Plan Your Visit Today", position: 6 }, // Multiple H1
    ];

    const analysis = analyzeAndOptimizeHeadings(
      rawHeadings,
      "https://thenines.com/rooms/",
      "Accommodations - The Nines Hotel"
    );

    assert.strictEqual(analysis.h1Count, 2);
    assert.strictEqual(analysis.hasSkippedLevels, true);

    // Check individual issues
    const h3Availability = analysis.headings[0];
    assert.ok(h3Availability.issues.some((i) => i.type === "inverted-hierarchy"));
    assert.strictEqual(h3Availability.isDecorativeOrWidget, true);

    const templateHeading = analysis.headings[2];
    assert.ok(templateHeading.issues.some((i) => i.type === "template-placeholder"));

    const skippedH4 = analysis.headings[4];
    assert.ok(skippedH4.issues.some((i) => i.type === "skipped-level"));

    const secondH1 = analysis.headings[5];
    assert.ok(secondH1.issues.some((i) => i.type === "multiple-h1"));
    assert.strictEqual(secondH1.optimizedLevel, "H2");
  });

  it("generates 3-tab OpenXML workbook matching The Nines 6-column reference layout", () => {
    const mockSummary: HeadingAuditSummary = {
      websiteUrl: "https://thenines.com/",
      origin: "https://thenines.com",
      auditedAt: new Date().toISOString(),
      durationMs: 1250,
      maxPagesLimit: 50,
      pagesDiscovered: 42,
      pagesScanned: 40,
      pagesFailed: 0,
      totalPagesAudited: 40,
      totalHeadingsAudited: 185,
      h1TotalCount: 38,
      h2TotalCount: 92,
      h3TotalCount: 45,
      h4H6TotalCount: 10,
      pagesMissingH1Count: 3,
      pagesMultipleH1Count: 4,
      pagesWithSkippedLevelsCount: 8,
      emptyHeadingsCount: 2,
      discoveryMethods: ["XML Sitemap & Index Parser", "Internal HTML Link Crawler"],
      sitemapDiscoverySucceeded: true,
      sitemapUrlsFound: 42,
      jsRenderingInspected: false,
      crawlCompleted: true,
      stoppedReason: "Completed all queue pages",
      coverageStatement: "Complete within 40 scanned public HTML pages and XML sitemaps.",
      skippedAreas: [],
      unresolvedErrors: [],
      topFindings: [
        "Inverted heading hierarchy on homepage: Check Availability H3 precedes main H1.",
        "Unrendered JavaScript template literal <h2>'+page.title+'</h2> detected on multiple accommodation pages.",
      ],
    };

    const mockPages: PageHeadingAudit[] = [
      {
        pageUrl: "https://thenines.com/",
        pageTitle: "The Nines Luxury Hotel Portland",
        pageStatus: 200,
        category: "HOME PAGE",
        subCategory: "Home",
        targetKeyword: "Downtown Portland Hotels",
        h1Count: 1,
        h2Count: 1,
        h3Count: 1,
        h4Count: 0,
        hasSkippedLevels: true,
        issues: ["Inverted hierarchy: Check Availability precedes H1"],
        recommendationSummary: "Establish single prominent H1 and demote reservation widget.",
        headings: [
          {
            id: "hdg-1",
            originalText: "Check Availability",
            tag: "H3",
            position: 1,
            optimizedText: "Check Availability & Reservations",
            optimizedLevel: "H3",
            isDecorativeOrWidget: true,
            issues: [{ type: "inverted-hierarchy", label: "Inverted Hierarchy (H3 before H1)", description: "Widget", severity: "high" }],
          },
          {
            id: "hdg-2",
            originalText: "The Nines Hotel Downtown Portland",
            tag: "H1",
            position: 2,
            optimizedText: "Downtown Portland Hotels | Dressed To The Nines",
            optimizedLevel: "H1",
            isDecorativeOrWidget: false,
            issues: [],
          },
          {
            id: "hdg-3",
            originalText: "OUR STORY",
            tag: "H2",
            position: 3,
            optimizedText: "Our Story",
            optimizedLevel: "H2",
            isDecorativeOrWidget: false,
            issues: [{ type: "all-caps-shouting", label: "All-Caps Shouting", description: "Convert to Title Case", severity: "low" }],
          },
        ],
      },
      {
        pageUrl: "https://thenines.com/dining/departure/",
        pageTitle: "Departure Restaurant & Lounge",
        pageStatus: 200,
        category: "DINING",
        subCategory: "Departure",
        targetKeyword: "Rooftop Restaurant In Portland: Departure",
        h1Count: 1,
        h2Count: 1,
        h3Count: 0,
        h4Count: 0,
        hasSkippedLevels: false,
        issues: [],
        recommendationSummary: "Heading hierarchy is well-structured and logical.",
        headings: [
          {
            id: "hdg-1",
            originalText: "DEPARTURE RESTAURANT",
            tag: "H1",
            position: 1,
            optimizedText: "Rooftop Restaurant In Portland: Departure",
            optimizedLevel: "H1",
            isDecorativeOrWidget: false,
            issues: [{ type: "all-caps-shouting", label: "All-Caps Shouting", description: "Convert to Title Case", severity: "low" }],
          },
          {
            id: "hdg-2",
            originalText: "Pan-Asian Cuisine & Cocktails",
            tag: "H2",
            position: 2,
            optimizedText: "Pan-Asian Cuisine & Cocktails",
            optimizedLevel: "H2",
            isDecorativeOrWidget: false,
            issues: [],
          },
        ],
      },
    ];

    const { buffer, filename } = generateHeadingAuditWorkbook(mockSummary, mockPages);

    assert.ok(buffer.length > 0);
    assert.ok(filename.includes("heading-structure-audit-thenines_com"));

    // Parse workbook with xlsx to inspect sheets and columns
    const wb = XLSX.read(buffer, { type: "buffer" });
    assert.deepStrictEqual(wb.SheetNames, [
      "Heading Optimization",
      "Audit Summary",
      "Hierarchy Analysis",
    ]);

    const mainSheet = wb.Sheets["Heading Optimization"];
    const rows = XLSX.utils.sheet_to_json<string[]>(mainSheet, { header: 1 });

    // Verify presence of Category Banner
    assert.ok(
      rows.some((r) => Array.isArray(r) && r[0] != null && String(r[0]).includes("HOME")),
      "Should contain category banner for HOME"
    );

    // Verify 6-column header row
    const headerRow = rows.find(
      (r) =>
        r.length >= 6 &&
        r[0] === "Page URL" &&
        r[1] === "Keyword " &&
        r[2] === "Old Headline" &&
        r[3] === "Old Heading Level" &&
        r[4] === "New Headline (optimized)" &&
        r[5] === "New Heading Level"
    );
    assert.ok(headerRow, "Should have exact 6-column table header matching reference sheet");

    // Verify Audit Summary Sheet
    const summarySheet = wb.Sheets["Audit Summary"];
    const summaryRows = XLSX.utils.sheet_to_json<string[]>(summarySheet, { header: 1 });
    assert.ok(
      summaryRows.some((r) => r[0] === "Audited Website URL:" && r[1] === "https://thenines.com/"),
      "Summary sheet should contain audited URL"
    );
    assert.ok(
      summaryRows.some((r) => r[0] === "Total Heading Elements Inspected:" && Number(r[1]) === 185),
      "Summary sheet should contain total headings"
    );

    // Verify Hierarchy Analysis Technical Tab
    const analysisSheet = wb.Sheets["Hierarchy Analysis"];
    const analysisRows = XLSX.utils.sheet_to_json<string[]>(analysisSheet, { header: 1 });
    assert.strictEqual(analysisRows[0][0], "Page URL");
    assert.strictEqual(analysisRows[0][4], "Original Heading Text");
    assert.strictEqual(analysisRows[0][8], "Flagged Issues");
  });

  it("formats title case accurately without mangling Roman numerals or contractions", () => {
    assert.strictEqual(toTitleCase("the nines hotel"), "The Nines Hotel");
    assert.strictEqual(toTitleCase("ROOFTOP RESTAURANT AND LOUNGE"), "Rooftop Restaurant and Lounge");
    assert.strictEqual(toTitleCase("DELUXE ROOM WITH KING BED"), "Deluxe Room with King Bed");
    assert.strictEqual(toTitleCase("SUITE LEVEL II"), "Suite Level II");
  });
});
