import { describe, it } from "node:test";
import assert from "node:assert/strict";

// This suite exercises the bundled demo dataset (thenines.com / Portland) that
// populates the GSC, keyword, backlink and GEO engines when no live data source
// is connected. Simulation is opt-in, so enable it here. Production code must
// NOT set this — without it, those engines return honest empty results.
process.env.ALLOW_SIMULATED_DATA = "1";

import { UnifiedGscClient } from "../src/core/gsc/client.ts";
import {
  evaluateAuditIssues,
  DEFAULT_AUDIT_ISSUES,
  generateAiVisibilityReport,
  generateKeywordSuggestions,
  analyzeContentGaps,
  getBacklinkProfile,
} from "../src/core/open-seo/index.ts";
import {
  getGoogleUpdates,
  checkAlgorithmImpact,
  getSpecializedAgentsList,
} from "../src/core/claude-seo/index.ts";
import { executeUnifiedTool, UNIFIED_SEO_TOOLS } from "../src/engine/unified-ai-orchestrator.ts";
import { runFullWebsiteAudit } from "../src/core/full-audit/audit-runner.ts";

describe("Cogwheel Unified SEO Platform - Multi-Source Integration Suite", () => {
  describe("1. FastMCP Google Search Console Integration (mcp-gsc)", () => {
    const client = new UnifiedGscClient();

    it("executes search analytics query with dimensional grouping", async () => {
      const res = await client.searchAnalyticsQuery({
        siteUrl: "sc-domain:thenines.com",
        startDate: "2026-10-01",
        endDate: "2026-11-20",
        dimensions: ["query", "page"],
      });

      assert.ok(res);
      assert.equal(res.siteUrl, "sc-domain:thenines.com");
      assert.ok(res.totalClicks > 0);
      assert.ok(res.rows.length > 0);
      assert.ok("clicks" in res.rows[0]);
      assert.ok("ctr" in res.rows[0]);
    });

    it("detects search query cannibalization across multiple URLs", async () => {
      const cannibalization = await client.detectCannibalization({
        siteUrl: "sc-domain:thenines.com",
      });

      assert.ok(cannibalization);
      assert.ok(cannibalization.totalCannibalizedQueries > 0);
      assert.ok(cannibalization.details[0].competingPages.length >= 2);
      assert.match(cannibalization.details[0].recommendation, /Consolidate|Designate/);
    });

    it("inspects URL indexing status safely", async () => {
      const inspection = await client.inspectUrl({
        siteUrl: "sc-domain:thenines.com",
        inspectionUrl: "https://thenines.com/rooms/deluxe-suite",
      });

      assert.equal(inspection.status, "INDEXED");
      assert.equal(inspection.coverageState, "Submitted and indexed");
      assert.equal(inspection.indexingState, "INDEXING_ALLOWED");
    });
  });

  describe("2. Open-SEO Tool & Audit Catalog Integration", () => {
    it("evaluates issues catalog with high and critical severities", () => {
      assert.ok(DEFAULT_AUDIT_ISSUES.length >= 10);

      const evaluation = evaluateAuditIssues([
        { issueId: "missing-title", affectedUrls: ["https://example.com/p1"] },
        { issueId: "missing-h1", affectedUrls: ["https://example.com/p2"] },
      ]);

      assert.equal(evaluation.totalIssuesFound, 2);
      assert.ok(evaluation.overallHealthScore < 100);
      assert.ok(evaluation.highPriorityCount >= 1);
    });

    it("generates AI / GEO visibility report across major LLMs", async () => {
      const geo = await generateAiVisibilityReport({
        brandName: "The Nines",
        domain: "thenines.com",
        targetQueries: ["luxury hotels portland", "the nines official site"],
      });

      assert.ok(geo.overallVisibilityScore >= 0);
      assert.ok(geo.overallVisibilityScore <= 100);
      assert.ok("googleAiOverviews" in geo.engineBreakdown);
      assert.ok("perplexity" in geo.engineBreakdown);
      assert.ok(geo.recommendations.length > 0);
    });

    it("provides keyword suggestions and competitor content gaps", async () => {
      const keywords = await generateKeywordSuggestions({
        seedKeyword: "luxury hotel",
        targetCountry: "US",
      });
      assert.ok(keywords.length > 0);
      assert.ok("searchVolume" in keywords[0]);
      assert.ok("cpc" in keywords[0]);

      const gaps = await analyzeContentGaps({
        primaryUrl: "https://thenines.com",
        competitorUrls: ["https://competitor.com"],
      });
      assert.ok(gaps.gapCount > 0);
      assert.ok("opportunityScore" in gaps.gaps[0]);
    });

    it("analyzes backlink profiles and domain ratings", async () => {
      const backlinks = await getBacklinkProfile("thenines.com");
      assert.ok(backlinks.domainRating > 0);
      assert.ok(backlinks.totalBacklinks > 0);
      assert.ok(backlinks.topReferringDomains.length > 0);
    });
  });

  describe("3. Claude-SEO Integration (Google Updates & 20 Specialized Agents)", () => {
    it("loads verified Google algorithm updates dataset", () => {
      const updates = getGoogleUpdates();
      assert.ok(updates.length > 30);

      const march2024 = updates.find((u: { name: string }) => u.name.includes("March 2024"));
      assert.ok(march2024);
      assert.equal(march2024?.kind, "core+spam");
    });

    it("checks algorithmic impact and volatility risk for a domain", () => {
      const impact = checkAlgorithmImpact("thenines.com");
      assert.ok("potentiallyImpacted" in impact);
      assert.ok("riskRating" in impact);
      assert.ok(["low", "medium", "high"].includes(impact.riskRating));
    });

    it("lists 20 specialized SEO agents", () => {
      const agents = getSpecializedAgentsList();
      assert.equal(agents.length, 20);
      assert.ok(agents.includes("seo-geo"));
      assert.ok(agents.includes("seo-content"));
      assert.ok(agents.includes("seo-backlinks"));
    });
  });

  describe("4. Unified AI Orchestrator & Tool Calling Dispatcher", () => {
    it("registers 9 unified tools in orchestrator schema", () => {
      assert.equal(UNIFIED_SEO_TOOLS.length, 9);
      const names = UNIFIED_SEO_TOOLS.map((t) => t.name);
      assert.ok(names.includes("query_google_search_console"));
      assert.ok(names.includes("detect_keyword_cannibalization"));
      assert.ok(names.includes("analyze_ai_visibility_geo"));
      assert.ok(names.includes("lookup_google_core_updates"));
      assert.ok(names.includes("research_keywords_and_gaps"));
    });

    it("dispatches tool call dynamically and returns valid payload", async () => {
      const result = await executeUnifiedTool("detect_keyword_cannibalization", {
        siteUrl: "sc-domain:thenines.com",
      });

      assert.ok(Array.isArray(result));
    });
  });

  describe("5. Full Website SEO Audit Engine", () => {
    it("runs an 11-dimension full audit report", async () => {
      const report = await runFullWebsiteAudit({
        targetUrl: "https://thenines.com",
        maxPages: 10,
        includeGsc: true,
        includeGeo: true,
      });

      assert.ok(report);
      assert.equal(report.domain, "thenines.com");
      assert.ok(report.overallScore > 0);
      assert.ok("statusCode" in report.technicalHealth);
      assert.ok("isIndexable" in report.crawlability);
      assert.ok("title" in report.onPage);
      assert.ok("h1Count" in report.headings);
      assert.ok("totalImages" in report.images);
      assert.ok("cannibalizationDetectedCount" in report.searchConsole);
      assert.ok("topOpportunities" in report.keywordsAndGaps);
      assert.ok("richSnippetEligible" in report.schemaValidation);
      assert.ok("visibilityScore" in report.aiGeoVisibility);
      assert.ok("riskRating" in report.algorithmImpact);
      assert.ok(report.actionPlan.length > 0);
      assert.ok("priority" in report.actionPlan[0]);
    });
  });
});
