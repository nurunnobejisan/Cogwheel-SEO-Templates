/**
 * CSV export of a full audit report.
 *
 * Flat `section, metric, value` rows keep the file usable in any spreadsheet.
 * Values are copied verbatim from the audit payload; unavailable dimensions are
 * exported with an explicit "not available" marker instead of a guessed number.
 */

import type { FullWebsiteAuditReport } from "../full-audit/types.ts";

type Row = [string, string, string | number | boolean];

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildAuditCsvReport(report: FullWebsiteAuditReport): string {
  const r = report;
  const rows: Row[] = [];

  const section = (name: string) => rows.push([name, "", ""]);
  const add = (name: string, metric: string, value: string | number | boolean) =>
    rows.push([name, metric, value]);

  add("Report", "id", r.id);
  add("Report", "targetUrl", r.targetUrl);
  add("Report", "domain", r.domain);
  add("Report", "createdAt", r.createdAt);
  add("Report", "durationMs", r.durationMs);
  add("Report", "overallScore", r.overallScore);

  section("Scores");
  add("Scores", "technical", r.scores.technical);
  add("Scores", "onPage", r.scores.onPage);
  add("Scores", "headings", r.scores.headings);
  add("Scores", "images", r.scores.images);
  add("Scores", "schema", r.scores.schema);
  add("Scores", "gsc", r.scores.gsc);
  add("Scores", "aiVisibility", r.scores.aiVisibility);

  section("Technical");
  add("Technical", "statusCode", r.technicalHealth.statusCode);
  add("Technical", "isHttps", r.technicalHealth.isHttps);
  add("Technical", "sslValid", r.technicalHealth.sslValid);
  add("Technical", "responseTimeMs", r.technicalHealth.responseTimeMs);
  add("Technical", "server", r.technicalHealth.server);
  add("Technical", "hasCompression", r.technicalHealth.hasCompression);
  add("Technical", "hasHsts", r.technicalHealth.securityHeaders.hasHsts);
  add("Technical", "hasCsp", r.technicalHealth.securityHeaders.hasCsp);
  add("Technical", "hasXFrameOptions", r.technicalHealth.securityHeaders.hasXFrameOptions);
  add(
    "Technical",
    "hasXContentTypeOptions",
    r.technicalHealth.securityHeaders.hasXContentTypeOptions,
  );

  section("Crawlability");
  add("Crawlability", "hasRobotsTxt", r.crawlability.hasRobotsTxt);
  add("Crawlability", "robotsTxtUrl", r.crawlability.robotsTxtUrl);
  add("Crawlability", "isIndexable", r.crawlability.isIndexable);
  add("Crawlability", "hasNoindex", r.crawlability.hasNoindex);
  add("Crawlability", "hasNofollow", r.crawlability.hasNofollow);
  add("Crawlability", "canonicalUrl", r.crawlability.canonicalUrl ?? "");
  add("Crawlability", "isCanonicalSelfReferencing", r.crawlability.isCanonicalSelfReferencing);
  add("Crawlability", "discoveredSitemaps", r.crawlability.discoveredSitemaps.join(" | "));
  add("Crawlability", "totalInternalLinksDiscovered", r.crawlability.totalInternalLinksDiscovered);
  add("Crawlability", "totalExternalLinksDiscovered", r.crawlability.totalExternalLinksDiscovered);

  section("OnPage");
  add("OnPage", "title", r.onPage.title);
  add("OnPage", "titleLength", r.onPage.titleLength);
  add("OnPage", "titlePixelWidth", r.onPage.titlePixelWidth);
  add("OnPage", "isTitleBudgetCompliant", r.onPage.isTitleBudgetCompliant);
  add("OnPage", "metaDescription", r.onPage.metaDescription);
  add("OnPage", "metaDescriptionLength", r.onPage.metaDescriptionLength);
  add("OnPage", "isMetaBudgetCompliant", r.onPage.isMetaBudgetCompliant);
  add("OnPage", "wordCount", r.onPage.wordCount);
  add("OnPage", "readingTimeMinutes", r.onPage.readingTimeMinutes);
  add("OnPage", "primaryLanguage", r.onPage.primaryLanguage);
  add("OnPage", "hasViewportTag", r.onPage.hasViewportTag);

  section("Headings");
  add("Headings", "totalHeadings", r.headings.totalHeadings);
  add("Headings", "h1Count", r.headings.h1Count);
  add("Headings", "h2Count", r.headings.h2Count);
  add("Headings", "h3Count", r.headings.h3Count);
  add("Headings", "h4Count", r.headings.h4Count);
  add("Headings", "h5Count", r.headings.h5Count);
  add("Headings", "h6Count", r.headings.h6Count);
  add("Headings", "hierarchyValid", r.headings.hierarchyValid);
  add("Headings", "issuesCount", r.headings.issuesCount);
  add("Headings", "sampleH1", r.headings.sampleH1);

  section("Images");
  add("Images", "totalImages", r.images.totalImages);
  add("Images", "missingAltCount", r.images.missingAltCount);
  add("Images", "oversizedCount", r.images.oversizedCount);
  add("Images", "legacyFormatCount", r.images.legacyFormatCount);
  add("Images", "lazyLoadedCount", r.images.lazyLoadedCount);
  add("Images", "optimizationOpportunityBytes", r.images.optimizationOpportunityBytes);

  section("SearchConsole");
  if (r.searchConsole.isConnected) {
    add("SearchConsole", "siteUrl", r.searchConsole.siteUrl);
    add("SearchConsole", "periodDays", r.searchConsole.periodDays);
    add("SearchConsole", "totalClicks", r.searchConsole.totalClicks);
    add("SearchConsole", "totalImpressions", r.searchConsole.totalImpressions);
    add("SearchConsole", "averageCtr", r.searchConsole.averageCtr);
    add("SearchConsole", "averagePosition", r.searchConsole.averagePosition);
    add("SearchConsole", "cannibalizationDetectedCount", r.searchConsole.cannibalizationDetectedCount);
    for (const query of r.searchConsole.topQueries) {
      add(
        "SearchConsole.topQuery",
        query.query,
        `${query.clicks} clicks | ${query.impressions} impressions | CTR ${query.ctr} | pos ${query.position}`,
      );
    }
  } else {
    add("SearchConsole", "status", "not available - Search Console not connected");
  }

  section("Keywords");
  if (r.keywordsAndGaps.totalTargetKeywords > 0) {
    add("Keywords", "totalTargetKeywords", r.keywordsAndGaps.totalTargetKeywords);
    add("Keywords", "top10KeywordsCount", r.keywordsAndGaps.top10KeywordsCount);
    add("Keywords", "top3KeywordsCount", r.keywordsAndGaps.top3KeywordsCount);
    add("Keywords", "averageKeywordDifficulty", r.keywordsAndGaps.averageKeywordDifficulty);
    add("Keywords", "contentGapsIdentified", r.keywordsAndGaps.contentGapsIdentified);
    for (const kw of r.keywordsAndGaps.topOpportunities) {
      add(
        "Keywords.opportunity",
        kw.keyword,
        `volume ${kw.searchVolume} | difficulty ${kw.difficulty} | CPC ${kw.cpc} | ${kw.intent} | score ${kw.opportunityScore}`,
      );
    }
  } else {
    add("Keywords", "status", "not available - no keyword data provider connected");
  }

  section("Schema");
  add("Schema", "schemasDetected", r.schemaValidation.schemasDetected.join(" | "));
  add("Schema", "isValidJsonLd", r.schemaValidation.isValidJsonLd);
  add("Schema", "validationErrorsCount", r.schemaValidation.validationErrorsCount);
  add("Schema", "missingRecommendedSchemas", r.schemaValidation.missingRecommendedSchemas.join(" | "));
  add("Schema", "richSnippetEligible", r.schemaValidation.richSnippetEligible);

  section("Geo");
  add("Geo", "visibilityScore", r.aiGeoVisibility.visibilityScore);
  add("Geo", "brandEntityClarity", r.aiGeoVisibility.brandEntityClarity);
  add("Geo", "factDensityScore", r.aiGeoVisibility.factDensityScore);
  add("Geo", "dataAvailable", r.aiGeoVisibility.dataAvailable);
  add("Geo", "methodology", r.aiGeoVisibility.methodology);
  if (r.aiGeoVisibility.dataAvailable) {
    const e = r.aiGeoVisibility.estimatedCitationsAcrossEngines;
    add("Geo", "citations.googleAiOverviews", e.googleAiOverviews);
    add("Geo", "citations.perplexity", e.perplexity);
    add("Geo", "citations.chatgptSearch", e.chatgptSearch);
    add("Geo", "citations.claude", e.claude);
  } else {
    add("Geo", "citations", "not available - no AI engine queried");
  }
  for (const rec of r.aiGeoVisibility.recommendations) {
    add("Geo.recommendation", "", rec);
  }

  section("ActionPlan");
  const sorted = [...r.actionPlan].sort((a, b) => a.priority.localeCompare(b.priority));
  for (const item of sorted) {
    add(
      `ActionPlan.${item.priority}`,
      item.title,
      `${item.description} | impact: ${item.impact} | effort: ${item.effort} | category: ${item.category} | affected URLs: ${item.affectedUrlsCount} | fix: ${item.remediationGuide}`,
    );
  }

  section("Provenance");
  add("Provenance", "simulated", r.dataProvenance.simulated);
  for (const item of r.dataProvenance.measured) add("Provenance.measured", "", item);
  for (const item of r.dataProvenance.estimated) add("Provenance.estimated", "", item);
  for (const item of r.dataProvenance.unavailable) add("Provenance.unavailable", "", item);
  for (const note of r.dataProvenance.notes) add("Provenance.note", "", note);

  const header = "section,metric,value";
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return `${header}\n${body}\n`;
}
