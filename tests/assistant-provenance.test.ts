import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/assistant/route.ts";
import { assistantProviderChain } from "../src/core/assistant/providers.ts";
import { verifyClaimProvenance } from "../src/core/brain";
import type { FullWebsiteAuditReport } from "../src/core/full-audit/types.ts";

const report: FullWebsiteAuditReport = {
  id: "audit_assistant_test",
  targetUrl: "https://example.com/",
  domain: "example.com",
  createdAt: "2026-11-28T00:00:00.000Z",
  durationMs: 1000,
  overallScore: 71,
  scores: { technical: 80, onPage: 70, headings: 60, images: 90, schema: 75, gsc: 0, aiVisibility: 55 },
  technicalHealth: {
    statusCode: 200,
    isHttps: true,
    sslValid: true,
    responseTimeMs: 180,
    server: "nginx",
    hasCompression: true,
    securityHeaders: { hasHsts: true, hasCsp: false, hasXFrameOptions: true, hasXContentTypeOptions: true },
  },
  crawlability: {
    hasRobotsTxt: true,
    robotsTxtUrl: "https://example.com/robots.txt",
    isIndexable: true,
    hasNoindex: false,
    hasNofollow: false,
    canonicalUrl: "https://example.com/",
    isCanonicalSelfReferencing: true,
    discoveredSitemaps: [],
    totalInternalLinksDiscovered: 12,
    totalExternalLinksDiscovered: 3,
  },
  onPage: {
    title: "Example",
    titleLength: 7,
    titlePixelWidth: 50,
    isTitleBudgetCompliant: true,
    metaDescription: "Example description",
    metaDescriptionLength: 18,
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
    missingRecommendedSchemas: [],
    richSnippetEligible: true,
  },
  aiGeoVisibility: {
    visibilityScore: 55,
    brandEntityClarity: 60,
    factDensityScore: 50,
    dataAvailable: false,
    methodology: "On-page heuristic only.",
    engineBreakdown: {},
    estimatedCitationsAcrossEngines: { googleAiOverviews: 0, perplexity: 0, chatgptSearch: 0, claude: 0 },
    keyEntityStrengths: [],
    recommendations: [],
  },
  algorithmImpact: { potentiallyImpactedByRecentUpdates: false, recentRelevantUpdates: [], riskRating: "low" },
  actionPlan: [],
  dataProvenance: {
    measured: ["Technical health"],
    estimated: ["AI / GEO readiness"],
    unavailable: ["Search Console"],
    simulated: false,
    notes: [],
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
});

interface AssistantEvent {
  type?: string;
  text?: string;
  provider?: string;
  provenance?: { ok?: boolean };
}

function ndjsonEvents(text: string): AssistantEvent[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as AssistantEvent);
}

describe("audit assistant", () => {
  it("orders free engines before optional paid add-ons", () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    vi.stubEnv("GROQ_API_KEY", "test");
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    vi.stubEnv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free");
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    expect(assistantProviderChain().map((provider) => provider.id)).toEqual([
      "gemini",
      "groq",
      "openrouter_free",
      "openai_paid",
      "anthropic_paid",
    ]);
    expect(assistantProviderChain()[1]?.label).toMatch(/^Llama 3\.3 \(Groq,/);
  });

  it("rejects numbers that are not in the measured context", () => {
    const check = verifyClaimProvenance("The overall score is 987/100.", report, []);
    expect(check.ok).toBe(false);
    expect(check.untracedNumbers).toContain("987");
  });

  it("streams a rules-grounded answer when no session or provider is available", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_AI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const request = new NextRequest("http://localhost/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "summarise the audit", targetUrl: report.targetUrl, report }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const events = ndjsonEvents(await response.text());
    const done = events.find((event) => event.type === "done");
    const text = events.filter((event) => event.type === "delta").map((event) => event.text).join("");
    expect(done?.provider).toMatch(/Rules engine/);
    expect(done?.provenance?.ok).toBe(true);
    expect(text).toContain("71/100");
    expect(text).toContain("Search Console");
  });

  it("validates assistant input", async () => {
    const request = new NextRequest("http://localhost/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "", targetUrl: "https://example.com" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
