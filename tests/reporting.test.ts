import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { FullWebsiteAuditReport } from "../src/core/full-audit/types";
import { auditReportSchema } from "../src/core/reporting";
import { auditReportFileName } from "../src/core/reporting";
import { buildAuditCsvReport } from "../src/core/reporting/csv-report";
import { buildAuditHtmlReport } from "../src/core/reporting/html-report";
import { buildAuditPdfReport } from "../src/core/reporting/pdf-report";
import { buildAuditPptxReport } from "../src/core/reporting/pptx-report";

function makeReport(overrides: Partial<FullWebsiteAuditReport> = {}): FullWebsiteAuditReport {
  const base: FullWebsiteAuditReport = {
    id: "audit_test_001",
    targetUrl: "https://example.com/",
    domain: "example.com",
    createdAt: "2026-11-25T12:00:00.000Z",
    durationMs: 1234,
    overallScore: 71,
    scores: {
      technical: 80,
      onPage: 70,
      headings: 60,
      images: 90,
      schema: 75,
      gsc: 0,
      aiVisibility: 55,
    },
    technicalHealth: {
      statusCode: 200,
      isHttps: true,
      sslValid: true,
      responseTimeMs: 180,
      server: "nginx",
      hasCompression: true,
      securityHeaders: {
        hasHsts: true,
        hasCsp: false,
        hasXFrameOptions: true,
        hasXContentTypeOptions: true,
      },
    },
    crawlability: {
      hasRobotsTxt: true,
      robotsTxtUrl: "https://example.com/robots.txt",
      isIndexable: true,
      hasNoindex: false,
      hasNofollow: false,
      canonicalUrl: "https://example.com/",
      isCanonicalSelfReferencing: true,
      discoveredSitemaps: ["https://example.com/sitemap.xml"],
      totalInternalLinksDiscovered: 12,
      totalExternalLinksDiscovered: 3,
    },
    onPage: {
      title: "Example <Domain>, a \"test\" & demo",
      titleLength: 34,
      titlePixelWidth: 260,
      isTitleBudgetCompliant: true,
      metaDescription: "A short description, with commas.",
      metaDescriptionLength: 35,
      isMetaBudgetCompliant: true,
      wordCount: 420,
      readingTimeMinutes: 2,
      primaryLanguage: "en",
      hasViewportTag: true,
    },
    headings: {
      totalHeadings: 8,
      h1Count: 1,
      h2Count: 3,
      h3Count: 4,
      h4Count: 0,
      h5Count: 0,
      h6Count: 0,
      hierarchyValid: true,
      issuesCount: 0,
      sampleH1: "Example Domain",
    },
    images: {
      totalImages: 4,
      missingAltCount: 1,
      oversizedCount: 0,
      legacyFormatCount: 0,
      lazyLoadedCount: 2,
      optimizationOpportunityBytes: 0,
    },
    searchConsole: {
      isConnected: false,
      siteUrl: "",
      periodDays: 28,
      totalClicks: 0,
      totalImpressions: 0,
      averageCtr: 0,
      averagePosition: 0,
      cannibalizationDetectedCount: 0,
      topQueries: [],
    },
    keywordsAndGaps: {
      totalTargetKeywords: 0,
      top10KeywordsCount: 0,
      top3KeywordsCount: 0,
      averageKeywordDifficulty: 0,
      contentGapsIdentified: 0,
      topOpportunities: [],
    },
    schemaValidation: {
      schemasDetected: ["WebSite"],
      isValidJsonLd: true,
      validationErrorsCount: 0,
      missingRecommendedSchemas: ["Organization"],
      richSnippetEligible: true,
    },
    aiGeoVisibility: {
      visibilityScore: 55,
      brandEntityClarity: 60,
      factDensityScore: 50,
      dataAvailable: false,
      methodology: "On-page heuristic only; no AI engine was queried.",
      engineBreakdown: {},
      estimatedCitationsAcrossEngines: {
        googleAiOverviews: 0,
        perplexity: 0,
        chatgptSearch: 0,
        claude: 0,
      },
      keyEntityStrengths: [],
      recommendations: ["Add concise answer summaries below H2s."],
    },
    algorithmImpact: {
      potentiallyImpactedByRecentUpdates: false,
      recentRelevantUpdates: [],
      riskRating: "low",
    },
    actionPlan: [
      {
        id: "iss_meta",
        priority: "P1",
        category: "images",
        title: "Add missing alt text",
        description: "One image has no alt attribute.",
        impact: "Accessibility and image search visibility",
        effort: "low",
        affectedUrlsCount: 1,
        remediationGuide: "Describe the image in the alt attribute.",
      },
    ],
    dataProvenance: {
      measured: ["Technical health", "On-page SEO"],
      estimated: ["AI / GEO readiness"],
      unavailable: ["Search Console", "Keyword volumes"],
      simulated: false,
      notes: ["Set ALLOW_SIMULATED_DATA only for local demos."],
    },
  };

  return {
    ...base,
    ...overrides,
    scores: { ...base.scores, ...(overrides.scores ?? {}) },
    dataProvenance: { ...base.dataProvenance, ...(overrides.dataProvenance ?? {}) },
  };
}

describe("audit report schema", () => {
  it("accepts a complete report", () => {
    expect(auditReportSchema.safeParse(makeReport()).success).toBe(true);
  });

  it("rejects a report with a missing nested section", () => {
    const report = makeReport();
    const broken = { ...report, headings: undefined };
    expect(auditReportSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects an unknown priority", () => {
    const report = makeReport();
    const broken = {
      ...report,
      actionPlan: [{ ...report.actionPlan[0], priority: "P9" }],
    };
    expect(auditReportSchema.safeParse(broken).success).toBe(false);
  });
});

describe("HTML report", () => {
  it("renders a standalone document and escapes page content", () => {
    const html = buildAuditHtmlReport(makeReport());
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("SEO &amp; GEO Audit — example.com");
    expect(html).toContain("Example &lt;Domain&gt;, a &quot;test&quot; &amp; demo");
    expect(html).not.toContain("Example <Domain>");
    expect(html).toContain("Not available — connect Google Search Console credentials");
    expect(html).toContain("@media print");
  });

  it("warns when simulated data was enabled", () => {
    const html = buildAuditHtmlReport(
      makeReport({ dataProvenance: { ...makeReport().dataProvenance, simulated: true } }),
    );
    expect(html).toContain("Simulated data enabled");
  });
});

describe("CSV report", () => {
  it("quotes commas, quotes and newlines", () => {
    const csv = buildAuditCsvReport(makeReport());
    expect(csv.split("\n")[0]).toBe("section,metric,value");
    expect(csv).toContain('"Example <Domain>, a ""test"" & demo"');
    expect(csv).toContain("not available - Search Console not connected");
    expect(csv).toContain("P1");
  });
});

describe("PDF report", () => {
  it("produces a valid PDF with xref and the report title", () => {
    const pdf = buildAuditPdfReport(makeReport());
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("SEO & GEO Audit Report");
    expect(text).toContain("Report audit_test_001");
    expect(text).toMatch(/startxref\n\d+\n%%EOF/);
    const size = Number(/\/Size (\d+)/.exec(text)?.[1]);
    expect(size).toBeGreaterThan(4);
  });
});

describe("PPTX report", () => {
  it("produces a readable OOXML package", async () => {
    const buffer = await buildAuditPptxReport(makeReport());
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("ppt/presentation.xml");
    expect(names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length).toBeGreaterThan(3);
  });
});

describe("report file names", () => {
  it("sanitizes the domain and uses the right extension", () => {
    expect(auditReportFileName("example.com", "pdf", "2026-11-25T00:00:00.000Z")).toBe(
      "cogwheel-audit-example.com-2026-11-25.pdf",
    );
    expect(auditReportFileName("weird/domain?x=1", "pptx", "2026-01-02T00:00:00.000Z")).toBe(
      "cogwheel-audit-weird-domain-x-1-2026-01-02.pptx",
    );
  });
});

// Guard against accidental regression: the package must be installable from a
// clean checkout, so the PPTX writer needs its dependency in package.json.
it("declares pptxgenjs as a direct dependency", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(pkg.dependencies.pptxgenjs).toBeTruthy();
});
