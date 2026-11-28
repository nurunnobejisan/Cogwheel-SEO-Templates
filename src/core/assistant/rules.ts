import "server-only";

import type { FullWebsiteAuditReport } from "@/core/full-audit/types";

/**
 * Deterministic assistant fallback. Every number comes from the supplied audit
 * report. Missing data sources are named rather than estimated. This is the
 * zero-key path and also the final fallback when a model output fails the
 * claim-to-field gate.
 */
export function answerFromAudit(
  question: string,
  report: FullWebsiteAuditReport | null,
  targetUrl: string,
): { content: string; toolUsed: string } {
  if (!report) {
    return {
      toolUsed: "audit_report:missing",
      content: `### No audit loaded\n\nRun the 11-dimension audit for ${targetUrl} first. This assistant answers from the current report only — it does not crawl on its own and it does not invent metrics.`,
    };
  }

  const q = question.toLowerCase();
  const r = report;

  if (q.includes("cannibal") || q.includes("gsc") || q.includes("search console")) {
    const gsc = r.searchConsole;
    if (!gsc.isConnected) {
      return {
        toolUsed: "audit_report:search_console",
        content:
          "### Search Console cannibalization\n\nNot measured for this report. Google Search Console credentials are not connected, so query-level clicks, impressions and cannibalization conflicts are unavailable.\n\nConnect Search Console and re-run the audit to populate this section.",
      };
    }
    const top = gsc.topQueries
      .slice(0, 5)
      .map((query) => `- \`${query.query}\` — ${query.clicks} clicks / ${query.impressions} impressions / position ${query.position.toFixed(1)}`)
      .join("\n");
    return {
      toolUsed: "audit_report:search_console",
      content: `### Search Console cannibalization\n\n- Property: \`${gsc.siteUrl}\` (last ${gsc.periodDays} days)\n- Clicks / impressions: ${gsc.totalClicks.toLocaleString()} / ${gsc.totalImpressions.toLocaleString()}\n- Average CTR / position: ${(gsc.averageCtr * 100).toFixed(2)}% / ${gsc.averagePosition.toFixed(1)}\n- Conflicting queries: **${gsc.cannibalizationDetectedCount}**\n${top ? `\nTop queries:\n${top}` : ""}\n\n${gsc.cannibalizationDetectedCount > 0 ? "Review the competing URLs listed in the Search Console panel and consolidate internal links onto one canonical target per query." : "No query-level conflict was detected in the exported window."}`,
    };
  }

  if (q.includes("geo") || q.includes("perplexity") || q.includes("ai overview") || q.includes("citation")) {
    const geo = r.aiGeoVisibility;
    const citations = geo.dataAvailable
      ? `- Citations: Google AI Overviews ${geo.estimatedCitationsAcrossEngines.googleAiOverviews}, Perplexity ${geo.estimatedCitationsAcrossEngines.perplexity}, ChatGPT Search ${geo.estimatedCitationsAcrossEngines.chatgptSearch}, Claude ${geo.estimatedCitationsAcrossEngines.claude}`
      : "- Citations: **not measured** — no AI engine or licensed visibility provider is connected.";
    const recommendations = geo.recommendations.length
      ? `\n\nRecommendations from the report:\n${geo.recommendations.slice(0, 5).map((item) => `- ${item}`).join("\n")}`
      : "";
    return {
      toolUsed: "audit_report:geo",
      content: `### AI / GEO visibility\n\n- Readiness score: **${geo.visibilityScore}/100** (${geo.dataAvailable ? "includes measured citations" : "on-page heuristic only"})\n- Brand entity clarity: ${geo.brandEntityClarity}/100\n- Fact density: ${geo.factDensityScore}/100\n${citations}\n\nMethodology: ${geo.methodology}${recommendations}`,
    };
  }

  if (q.includes("update") || q.includes("algorithm") || q.includes("core")) {
    const impact = r.algorithmImpact;
    const updates = impact.recentRelevantUpdates.length
      ? impact.recentRelevantUpdates
          .map((update) => `- ${update.name} (${update.date}, ${update.kind})${update.notes ? ` — ${update.notes}` : ""}`)
          .join("\n")
      : "- No update matched the rules in `data/google-updates.json`.";
    return {
      toolUsed: "audit_report:algorithm_impact",
      content: `### Algorithm update risk\n\n- Risk rating: **${impact.riskRating}**\n- Potentially impacted: ${impact.potentiallyImpactedByRecentUpdates ? "yes" : "no"}\n\nMatched updates:\n${updates}\n\nThis is a rules-based mapping from the audit issues to the local update archive, not a prediction from Google.`,
    };
  }

  if (q.includes("heading") || q.includes("h1") || q.includes("h2")) {
    const h = r.headings;
    return {
      toolUsed: "audit_report:headings",
      content: `### Heading structure\n\n- Total headings: ${h.totalHeadings}\n- H1 / H2 / H3 / H4 / H5 / H6: ${h.h1Count} / ${h.h2Count} / ${h.h3Count} / ${h.h4Count} / ${h.h5Count} / ${h.h6Count}\n- Hierarchy valid: ${h.hierarchyValid ? "yes" : "no"}\n- Issues: ${h.issuesCount}\n${h.sampleH1 ? `- Sample H1: ${h.sampleH1}` : ""}\n\n${h.hierarchyValid ? "No skipped levels were detected on the audited pages." : "Open the Heading Audit tab for the per-page outline and skipped-level details."}`,
    };
  }

  if (q.includes("image") || q.includes("alt") || q.includes("webp")) {
    const img = r.images;
    return {
      toolUsed: "audit_report:images",
      content: `### Images\n\n- Total images: ${img.totalImages}\n- Missing alt text: ${img.missingAltCount}\n- Oversized: ${img.oversizedCount}\n- Legacy formats: ${img.legacyFormatCount}\n- Lazy-loaded: ${img.lazyLoadedCount}\n- Measured optimization opportunity: ${img.optimizationOpportunityBytes > 0 ? `${img.optimizationOpportunityBytes.toLocaleString()} bytes` : "not measured"}\n\nOpen the Image Audit tab for per-file findings.`,
    };
  }

  if (q.includes("technical") || q.includes("speed") || q.includes("ssl") || q.includes("https") || q.includes("index")) {
    const t = r.technicalHealth;
    const c = r.crawlability;
    return {
      toolUsed: "audit_report:technical",
      content: `### Technical health & crawlability\n\n- HTTP status: ${t.statusCode} · response ${t.responseTimeMs} ms\n- HTTPS / SSL: ${t.isHttps ? "yes" : "no"} / ${t.sslValid ? "valid" : "not valid"}\n- Compression: ${t.hasCompression ? "enabled" : "disabled"} · server: ${t.server || "not disclosed"}\n- Indexable: ${c.isIndexable ? "yes" : "no"} · noindex: ${c.hasNoindex ? "yes" : "no"} · nofollow: ${c.hasNofollow ? "yes" : "no"}\n- robots.txt: ${c.hasRobotsTxt ? c.robotsTxtUrl : "not found"}\n- Sitemaps discovered: ${c.discoveredSitemaps.length || "none"}\n- Links: ${c.totalInternalLinksDiscovered} internal / ${c.totalExternalLinksDiscovered} external`,
    };
  }

  const topActions = [...r.actionPlan]
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, 3)
    .map((item) => `- **${item.priority}** ${item.title} — ${item.description}`)
    .join("\n");
  return {
    toolUsed: "audit_report:summary",
    content: `### Audit summary for ${r.domain}\n\n- Overall score: **${r.overallScore}/100**\n- Technical ${r.scores.technical} · On-page ${r.scores.onPage} · Headings ${r.scores.headings} · Images ${r.scores.images} · Schema ${r.scores.schema} · GEO readiness ${r.scores.aiVisibility}\n- Data sources unavailable: ${r.dataProvenance.unavailable.length ? r.dataProvenance.unavailable.join(", ") : "none"}\n\nTop actions:\n${topActions || "No issues were raised by the rules engine."}\n\nAsk about Search Console, GEO, algorithm risk, headings, images or technical health for the matching section.`,
  };
}
