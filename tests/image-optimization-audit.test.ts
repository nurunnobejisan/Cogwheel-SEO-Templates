import { describe, it } from "node:test";
import assert from "node:assert";
import * as XLSX from "xlsx";
import { generateImageAuditWorkbook } from "../src/core/image-audit/excel.ts";
import type {
  ImageAuditItem,
  ImageAuditSummary,
  CrawlLogEntry,
} from "../src/core/image-audit/types.ts";

describe("Website Image Optimization Audit Engine", () => {
  const mockSummary: ImageAuditSummary = {
    websiteUrl: "https://example-hotel.com",
    origin: "https://example-hotel.com",
    crawledAt: new Date().toISOString(),
    durationMs: 450,
    maxPagesLimit: 50,
    pagesDiscovered: 6,
    pagesScanned: 5,
    pagesFailed: 0,
    totalImagesFound: 4,
    uniqueImagesCount: 4,
    totalPlacementsCount: 4,
    imagesPreviewedSuccessfully: 3,
    imagesFailedLoading: 1,
    brokenImagesCount: 1,
    oversizedImagesCount: 1,
    missingAltCount: 1,
    decorativeEmptyAltCount: 1,
    missingDimensionsCount: 1,
    legacyFormatCount: 2,
    aboveFoldLazyCount: 0,
    discoveryMethods: ["Internal HTML Link Crawler", "XML Sitemap & Index Parser", "Lazy-Load Attribute Parser"],
    sitemapDiscoverySucceeded: true,
    sitemapUrlsFound: 12,
    wpMediaApiFound: false,
    wpMediaCount: 0,
    jsRenderingInspected: false,
    crawlCompleted: true,
    stoppedReason: "Completed all queue pages",
    coverageStatement: "Complete within 5 scanned public HTML pages and discovered sitemaps under configured crawl parameters.",
    skippedAreas: [],
    unresolvedErrors: [],
    formatBreakdown: { JPEG: 2, PNG: 1, WebP: 1 },
    topFindings: [
      "1 image placements are missing descriptive alt text.",
      "1 image placements exceed 100 KB and should be compressed.",
      "1 image links return 4xx/5xx HTTP errors.",
    ],
  };

  const mockItems: ImageAuditItem[] = [
    {
      id: "img-1",
      placementId: "https://example-hotel.com/assets/hero-suite.jpg::https://example-hotel.com/::1",
      imageUrl: "https://example-hotel.com/assets/hero-suite.jpg",
      pageUrl: "https://example-hotel.com/",
      pageTitle: "Luxury Suites | Example Hotel",
      pageStatus: 200,
      filename: "hero-suite.jpg",
      titleLength: 14,
      currentAlt: null,
      proposedAlt: "Example Hotel Hero Suite Luxury Suites",
      altLength: 38,
      isDecorative: false,
      htmlWidth: null,
      htmlHeight: null,
      naturalWidth: 1920,
      naturalHeight: 1080,
      fileSizeBytes: 350000,
      fileSizeKb: 341.8,
      format: "JPEG",
      mimeType: "image/jpeg",
      elementType: "img",
      sourceAttribute: "src",
      loadingAttribute: "lazy",
      httpStatus: 200,
      isBroken: false,
      occurrenceCount: 1,
      placementIndex: 1,
      issues: [
        {
          code: "missing-alt",
          label: "Missing Alt Attribute",
          description: "Missing alt attribute.",
          severity: "high",
        },
        {
          code: "oversized-file",
          label: "Oversized File (>100KB)",
          description: "File size is 342 KB.",
          severity: "high",
        },
        {
          code: "legacy-format",
          label: "Legacy Format (JPEG)",
          description: "Could save 25-35% with WebP/AVIF.",
          severity: "medium",
        },
        {
          code: "missing-dimensions",
          label: "Missing Intrinsic Dimensions",
          description: "Causes Cumulative Layout Shift (CLS).",
          severity: "low",
        },
      ],
      recommendation: "Provide alt text, convert to WebP/AVIF, compress to <100KB, and add width/height.",
      priority: "High",
    },
    {
      id: "img-2",
      placementId: "https://example-hotel.com/assets/divider-icon.png::https://example-hotel.com/rooms::2",
      imageUrl: "https://example-hotel.com/assets/divider-icon.png",
      pageUrl: "https://example-hotel.com/rooms",
      pageTitle: "Guest Rooms | Example Hotel",
      pageStatus: 200,
      filename: "divider-icon.png",
      titleLength: 16,
      currentAlt: "",
      proposedAlt: "",
      altLength: 0,
      isDecorative: true,
      htmlWidth: 24,
      htmlHeight: 24,
      naturalWidth: 24,
      naturalHeight: 24,
      fileSizeBytes: 2048,
      fileSizeKb: 2,
      format: "PNG",
      mimeType: "image/png",
      elementType: "img",
      sourceAttribute: "src",
      loadingAttribute: "auto",
      httpStatus: 200,
      isBroken: false,
      occurrenceCount: 3,
      placementIndex: 2,
      issues: [],
      recommendation: "Decorative image correctly uses empty alt=\"\". Valid per WCAG standards.",
      priority: "Good",
    },
    {
      id: "img-3",
      placementId: "https://example-hotel.com/assets/pool-sunset.webp::https://example-hotel.com/amenities::1",
      imageUrl: "https://example-hotel.com/assets/pool-sunset.webp",
      pageUrl: "https://example-hotel.com/amenities",
      pageTitle: "Amenities & Pool | Example Hotel",
      pageStatus: 200,
      filename: "pool-sunset.webp",
      titleLength: 16,
      currentAlt: "Heated rooftop pool at sunset",
      proposedAlt: "Heated rooftop pool at sunset",
      altLength: 29,
      isDecorative: false,
      htmlWidth: 800,
      htmlHeight: 600,
      naturalWidth: 800,
      naturalHeight: 600,
      fileSizeBytes: 45000,
      fileSizeKb: 43.9,
      format: "WebP",
      mimeType: "image/webp",
      elementType: "picture",
      sourceAttribute: "srcset",
      loadingAttribute: "lazy",
      httpStatus: 200,
      isBroken: false,
      occurrenceCount: 1,
      placementIndex: 1,
      issues: [],
      recommendation: "Optimized modern format with descriptive alt text and explicit dimensions.",
      priority: "Good",
    },
    {
      id: "img-4",
      placementId: "https://example-hotel.com/assets/broken-logo.jpg::https://example-hotel.com/contact::1",
      imageUrl: "https://example-hotel.com/assets/broken-logo.jpg",
      pageUrl: "https://example-hotel.com/contact",
      pageTitle: "Contact Us | Example Hotel",
      pageStatus: 200,
      filename: "broken-logo.jpg",
      titleLength: 15,
      currentAlt: "Hotel Logo",
      proposedAlt: "Hotel Logo",
      altLength: 10,
      isDecorative: false,
      htmlWidth: 150,
      htmlHeight: 50,
      naturalWidth: null,
      naturalHeight: null,
      fileSizeBytes: null,
      fileSizeKb: null,
      format: "JPEG",
      mimeType: "image/jpeg",
      elementType: "img",
      sourceAttribute: "src",
      loadingAttribute: "eager",
      httpStatus: 404,
      isBroken: true,
      occurrenceCount: 1,
      placementIndex: 1,
      issues: [
        {
          code: "broken-image",
          label: "Broken Image (HTTP 404)",
          description: "Asset URL returned status 404.",
          severity: "high",
        },
      ],
      recommendation: "Fix or remove dead image link returning HTTP 404.",
      priority: "High",
    },
  ];

  const mockCrawlLog: CrawlLogEntry[] = [
    {
      url: "https://example-hotel.com/",
      statusCode: 200,
      title: "Luxury Suites | Example Hotel",
      responseTimeMs: 80,
      imagesFound: 1,
      status: "success",
    },
    {
      url: "https://example-hotel.com/rooms",
      statusCode: 200,
      title: "Guest Rooms | Example Hotel",
      responseTimeMs: 65,
      imagesFound: 1,
      status: "success",
    },
    {
      url: "https://example-hotel.com/amenities",
      statusCode: 200,
      title: "Amenities & Pool | Example Hotel",
      responseTimeMs: 90,
      imagesFound: 1,
      status: "success",
    },
    {
      url: "https://example-hotel.com/contact",
      statusCode: 200,
      title: "Contact Us | Example Hotel",
      responseTimeMs: 70,
      imagesFound: 1,
      status: "success",
    },
  ];

  it("generates a 5-tab workbook containing all required audit sheets", () => {
    const { workbook, buffer, base64 } = generateImageAuditWorkbook(
      mockSummary,
      mockItems,
      mockCrawlLog
    );

    assert(buffer instanceof Buffer, "Buffer must be an instance of Buffer");
    assert(base64.length > 0, "Base64 string must not be empty");
    assert.strictEqual(typeof base64, "string");

    // Verify all 5 sheet names
    const expectedSheetNames = [
      "Image Optimization",
      "Audit Summary",
      "Image Inventory",
      "Recommendations",
      "Crawl Log",
    ];
    assert.deepStrictEqual(workbook.SheetNames, expectedSheetNames);
  });

  it("Image Optimization tab strictly preserves 6 columns matching reference sheet headers and formulas", () => {
    const { workbook } = generateImageAuditWorkbook(
      mockSummary,
      mockItems,
      mockCrawlLog
    );

    const sheet = workbook.Sheets["Image Optimization"];
    assert(sheet, "Image Optimization sheet must exist");

    // Check Header row (Row 1): Exact 6 columns
    assert.strictEqual(sheet["A1"]?.v, "Image");
    assert.strictEqual(sheet["B1"]?.v, "URL ");
    assert.strictEqual(sheet["C1"]?.v, "Title ");
    assert.strictEqual(sheet["D1"]?.v, "Length");
    assert.strictEqual(sheet["E1"]?.v, "Optimized ALT Text");
    assert.strictEqual(sheet["F1"]?.v, "Length");
    // Column G should NOT exist on main tab
    assert.strictEqual(sheet["G1"], undefined);

    // Check Row 2 formulas
    // Col A should be =IMAGE(B2)
    assert.strictEqual(sheet["A2"]?.f, "IMAGE(B2)");
    // Col B should be image URL
    assert.strictEqual(sheet["B2"]?.v, "https://example-hotel.com/assets/hero-suite.jpg");
    // Col C should be decoded filename
    assert.strictEqual(sheet["C2"]?.v, "hero-suite.jpg");
    // Col D should be =LEN(C2)
    assert.strictEqual(sheet["D2"]?.f, "LEN(C2)");
    // Col F should be =LEN(E2)
    assert.strictEqual(sheet["F2"]?.f, "LEN(E2)");
  });

  it("correctly identifies decorative images vs missing alt defects", () => {
    const decorativeItem = mockItems.find((i) => i.id === "img-2");
    assert(decorativeItem);
    assert.strictEqual(decorativeItem.isDecorative, true);
    assert.strictEqual(decorativeItem.currentAlt, "");
    assert.strictEqual(decorativeItem.priority, "Good");
    // Should NOT flag missing-alt as defect
    assert(!decorativeItem.issues.some((i) => i.code === "missing-alt"));

    const missingAltItem = mockItems.find((i) => i.id === "img-1");
    assert(missingAltItem);
    assert.strictEqual(missingAltItem.isDecorative, false);
    assert.strictEqual(missingAltItem.currentAlt, null);
    assert(missingAltItem.issues.some((i) => i.code === "missing-alt"));
    assert.strictEqual(missingAltItem.priority, "High");
  });

  it("Audit Summary sheet renders coverage metrics, discovery methods, and format breakdown", () => {
    const { workbook } = generateImageAuditWorkbook(
      mockSummary,
      mockItems,
      mockCrawlLog
    );

    const sheet = workbook.Sheets["Audit Summary"];
    assert(sheet, "Audit Summary sheet must exist");

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    const textContent = json.flat().join(" ");

    assert(textContent.includes("https://example-hotel.com"));
    assert(textContent.includes("Pages Successfully Scanned"));
    assert(textContent.includes("Total Image Placements"));
    assert(textContent.includes("XML Sitemap Discovery"));
    assert(textContent.includes("Coverage Statement"));
    assert(textContent.includes("FORMAT BREAKDOWN"));
    assert(textContent.includes("JPEG"));
    assert(textContent.includes("WebP"));
  });

  it("Recommendations tab details Core Web Vitals, WebP/AVIF, and Alt Text guidelines", () => {
    const { workbook } = generateImageAuditWorkbook(
      mockSummary,
      mockItems,
      mockCrawlLog
    );

    const sheet = workbook.Sheets["Recommendations"];
    assert(sheet, "Recommendations sheet must exist");

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    const textContent = json.flat().join(" ");

    assert(textContent.includes("Cumulative Layout Shift"));
    assert(textContent.includes("WebP"));
    assert(textContent.includes("AVIF"));
    assert(textContent.includes("WCAG"));
  });
});
