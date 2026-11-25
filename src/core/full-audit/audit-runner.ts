/**
 * Cogwheel Unified SEO Platform - Full Website Audit Runner
 *
 * Orchestrates the audit dimensions and synthesizes a single
 * FullWebsiteAuditReport.
 *
 * Integrity contract (see docs/REPOSITORY_AUDIT.md, C1/H1):
 *   - Every on-page / heading / image / schema / crawlability field is derived
 *     from a live fetch + parse of the target URL (or reported as unavailable).
 *   - Dimensions that need a data source that is not connected (Search Console,
 *     keyword volume, AI-engine citations) are reported as unavailable rather
 *     than populated with plausible-looking constants.
 *   - The GEO score is an explicitly-labelled on-page readiness heuristic; no
 *     AI engine is claimed to have been queried.
 *
 * This is a single-URL audit: `maxPages` is accepted for API compatibility but
 * a multi-page crawl is not performed (noted in `dataProvenance`).
 */

import { runAudit } from "../../../rules/index.ts";
import type { AuditIssue } from "../../../rules/types.ts";
import { buildSnapshotFromHtml } from "../../../rules/html-snapshot.ts";
import { calculatePixelWidth } from "../../../validators/serpOptimizer.ts";
import { assertEgressAllowed, readTextCapped, safeFetch as egressFetch } from "../../lib/security/egress.ts";
import { validateTargetUrl } from "../crawler/url.ts";
import { isGoogleConfigured, UnifiedGscClient } from "../gsc/client.ts";
import { checkAlgorithmImpact } from "../claude-seo/index.ts";
import { isSimulatedDataAllowed } from "../data-policy.ts";
import {
  analyzeContentGaps,
  generateAiVisibilityReport,
  generateKeywordSuggestions,
} from "../open-seo/index.ts";
import type {
  ActionItem,
  DataProvenanceReport,
  FullWebsiteAuditReport,
  SeverityLevel,
} from "./types.ts";

const USER_AGENT = "CogwheelSeoBot/3.0 (+https://cogwheel.ai/bot)";
const FETCH_TIMEOUT_MS = 15000;

/** Issue categories from rules/ → report dimension. */
type Dim = "technical" | "onPage" | "headings" | "images" | "schema";

const SEVERITY_PENALTY: Record<SeverityLevel, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 3,
  info: 1,
};

export interface AuditRunnerOptions {
  targetUrl: string;
  maxPages?: number;
  enableSubdomains?: boolean;
  includeGsc?: boolean;
  includeGeo?: boolean;
}

function collectSchemaTypes(jsonLd: Array<{ "@type"?: string | string[] }>): string[] {
  const types = new Set<string>();
  for (const node of jsonLd) {
    const t = node["@type"];
    if (typeof t === "string") types.add(t);
    else if (Array.isArray(t)) for (const entry of t) if (typeof entry === "string") types.add(entry);
  }
  return [...types];
}

function countMalformedJsonLd(html: string): number {
  const pattern = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let malformed = 0;
  while ((match = pattern.exec(html)) !== null) {
    const raw = (match[1] ?? "").trim();
    if (!raw) continue;
    try {
      JSON.parse(raw);
    } catch {
      malformed += 1;
    }
  }
  return malformed;
}

/** 100 minus severity-weighted penalties for issues in the given categories. */
function scoreFromIssues(
  issues: AuditIssue[],
  match: (issue: AuditIssue) => boolean
): number {
  let penalty = 0;
  let matched = 0;
  for (const issue of issues) {
    if (!match(issue)) continue;
    matched += 1;
    penalty += SEVERITY_PENALTY[issue.severity] ?? 6;
  }
  if (matched === 0) return 100;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function priorityFor(severity: SeverityLevel): ActionItem["priority"] {
  if (severity === "critical") return "P0";
  if (severity === "high") return "P1";
  if (severity === "medium") return "P2";
  return "P3";
}

function categoryFor(issue: AuditIssue): ActionItem["category"] {
  switch (issue.category) {
    case "metadata":
      return "headings";
    case "media":
      return "images";
    case "schema":
      return "schema";
    case "content":
    case "hospitality":
      return "keywords";
    case "technical":
    case "accessibility":
    default:
      return "technical";
  }
}

const EFFORT_BY_CATEGORY: Record<ActionItem["category"], ActionItem["effort"]> = {
  headings: "low",
  schema: "low",
  images: "medium",
  technical: "medium",
  keywords: "medium",
  gsc: "medium",
  geo: "low",
};

function buildActionPlan(issues: AuditIssue[], totalUrls: number): ActionItem[] {
  const seen = new Set<string>();
  const plan: ActionItem[] = [];
  for (const issue of issues) {
    if (seen.has(issue.issueId)) continue;
    seen.add(issue.issueId);
    const category = categoryFor(issue);
    plan.push({
      id: issue.issueId,
      priority: priorityFor(issue.severity),
      category,
      title: issue.context.recommendedAction,
      description: `Detected on ${issue.context.selector}${
        issue.context.currentValue !== null && issue.context.currentValue !== ""
          ? ` (current: ${String(issue.context.currentValue)})`
          : ""
      }.`,
      impact:
        issue.severity === "critical"
          ? "Critical — blocks indexing or core visibility"
          : issue.severity === "high"
          ? "High — materially affects how this page is understood"
          : issue.severity === "medium"
          ? "Medium — quality improvement"
          : "Low — polish",
      effort: EFFORT_BY_CATEGORY[category],
      affectedUrlsCount: totalUrls,
      remediationGuide: issue.context.recommendedAction,
    });
  }
  return plan;
}

/** Transparent on-page GEO readiness heuristic (not an AI-citation measurement). */
function computeGeoReadiness(input: {
  schemaTypes: string[];
  hasCanonical: boolean;
  hasMetaDescription: boolean;
  hasOpenGraph: boolean;
  hasViewport: boolean;
  headingsValid: boolean;
  wordCount: number;
}): { score: number; strengths: string[] } {
  const checks: Array<{ label: string; pass: boolean; weight: number }> = [
    { label: "Structured data present", pass: input.schemaTypes.length > 0, weight: 18 },
    {
      label: "Question/answer schema (FAQPage)",
      pass: input.schemaTypes.includes("FAQPage"),
      weight: 12,
    },
    {
      label: "Organization / LodgingBusiness entity",
      pass: input.schemaTypes.some((t) =>
        ["Organization", "LocalBusiness", "Hotel", "LodgingBusiness", "Restaurant"].includes(t)
      ),
      weight: 16,
    },
    { label: "Self-referencing canonical", pass: input.hasCanonical, weight: 12 },
    { label: "Meta description present", pass: input.hasMetaDescription, weight: 10 },
    { label: "Open Graph tags present", pass: input.hasOpenGraph, weight: 8 },
    { label: "Mobile viewport declared", pass: input.hasViewport, weight: 8 },
    { label: "Heading hierarchy valid", pass: input.headingsValid, weight: 8 },
    { label: "Substantive body copy (≥300 words)", pass: input.wordCount >= 300, weight: 8 },
  ];
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0);
  const score = Math.round((earned / totalWeight) * 100);
  const strengths = checks.filter((c) => c.pass).map((c) => c.label);
  return { score, strengths };
}

export async function runFullWebsiteAudit(
  options: AuditRunnerOptions
): Promise<FullWebsiteAuditReport> {
  const startTime = Date.now();

  // 0. SSRF-safe URL normalization (rejects localhost / private ranges and
  //    hostnames that resolve to internal addresses). Offline/test runs skip the
  //    DNS lookup so the suite does not depend on network access.
  const skipDns =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.CI) ||
    Boolean(process.env.OFFLINE_AUDIT);
  const targetUrl = skipDns
    ? validateTargetUrl(options.targetUrl)
    : await assertEgressAllowed(options.targetUrl);
  if (!targetUrl) {
    throw new Error("A valid target URL is required (e.g. https://example.com)");
  }
  const urlObj = new URL(targetUrl);
  const domain = urlObj.hostname;

  const simulated = isSimulatedDataAllowed();
  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.CI);
  const offline = isTestEnv || Boolean(process.env.OFFLINE_AUDIT);

  // 1. Live fetch — real technical measurements only.
  let html = "";
  let statusCode = 0;
  let responseTimeMs = 0;
  let server = "";
  let hasCompression = false;
  let fetchOk = false;
  let securityHeaders = { hasHsts: false, hasCsp: false, hasXFrameOptions: false, hasXContentTypeOptions: false };

  if (!offline) {
    const fetchStart = Date.now();
    const fetched = await egressFetch(
      targetUrl,
      { method: "GET", headers: { "User-Agent": USER_AGENT } },
      { timeoutMs: FETCH_TIMEOUT_MS, maxRedirects: 5 },
    ).catch(() => null);
    const res = fetched?.response ?? null;
    if (res) {
      responseTimeMs = Date.now() - fetchStart;
      statusCode = res.status;
      fetchOk = true;
      server = res.headers.get("server") || "";
      const encoding = res.headers.get("content-encoding") || "";
      hasCompression = /gzip|br|deflate/i.test(encoding);
      securityHeaders = {
        hasHsts: Boolean(res.headers.get("strict-transport-security")),
        hasCsp: Boolean(res.headers.get("content-security-policy")),
        hasXFrameOptions: Boolean(res.headers.get("x-frame-options")),
        hasXContentTypeOptions: Boolean(res.headers.get("x-content-type-options")),
      };
      try {
        html = await readTextCapped(res, 1_500_000);
      } catch {
        html = "";
      }
    }
  }

  // 2. Normalized snapshot + real rules engine.
  const snapshot = buildSnapshotFromHtml(html, targetUrl, {
    overrides: { fetchStatus: fetchOk ? statusCode : null },
  });
  const audit = runAudit(snapshot);
  const issues = audit.issues;

  // 3. robots.txt + sitemap discovery (probed, not assumed).
  let hasRobotsTxt = false;
  const discoveredSitemaps: string[] = [];
  if (!offline) {
    const robotsProbe = await egressFetch(
      `${urlObj.origin}/robots.txt`,
      { method: "GET", headers: { "User-Agent": USER_AGENT } },
      { timeoutMs: 10_000, maxRedirects: 3 },
    ).catch(() => null);
    const robotsRes = robotsProbe?.response ?? null;
    if (robotsRes && robotsRes.ok) {
      hasRobotsTxt = true;
      const txt = await readTextCapped(robotsRes, 500_000).catch(() => "");
      for (const line of txt.split(/\r?\n/)) {
        const m = /^\s*sitemap:\s*(\S+)/i.exec(line);
        if (m) discoveredSitemaps.push(m[1]);
      }
    }
    if (discoveredSitemaps.length === 0) {
      for (const candidate of [`${urlObj.origin}/sitemap.xml`, `${urlObj.origin}/sitemap_index.xml`]) {
        const probe = await egressFetch(
          candidate,
          { method: "GET", headers: { "User-Agent": USER_AGENT } },
          { timeoutMs: 8000, maxRedirects: 3 },
        ).catch(() => null);
        if (probe?.response.ok) discoveredSitemaps.push(candidate);
      }
    }
  }

  // 4. Search Console — real only when credentials exist.
  const gscClient = new UnifiedGscClient();
  const gscConnected = isGoogleConfigured();
  const includeGsc = options.includeGsc !== false;
  let gscData = {
    totalClicks: 0,
    totalImpressions: 0,
    averageCtr: 0,
    averagePosition: 0,
    rows: [] as Array<{ query: string; page?: string; clicks: number; impressions: number; ctr: number; position: number }>,
  };
  let cannibalization = { totalCannibalizedQueries: 0, details: [] as Array<unknown> };
  if (includeGsc && gscConnected) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 28);
    const iso = (d: Date) => d.toISOString().split("T")[0];
    gscData = await gscClient.searchAnalyticsQuery({
      siteUrl: `sc-domain:${domain}`,
      startDate: iso(start),
      endDate: iso(end),
      dimensions: ["query", "page"],
    });
    cannibalization = await gscClient.detectCannibalization({ siteUrl: `sc-domain:${domain}` });
  }

  // 5. Keyword + GEO dimensions.
  const includeGeo = options.includeGeo !== false;
  let keywordSummary = {
    totalTargetKeywords: 0,
    top10KeywordsCount: 0,
    top3KeywordsCount: 0,
    averageKeywordDifficulty: 0,
    contentGapsIdentified: 0,
    topOpportunities: [] as Array<{
      keyword: string;
      searchVolume: number;
      difficulty: number;
      cpc: number;
      intent: string;
      opportunityScore: number;
    }>,
  };
  let geo = {
    visibilityScore: 0,
    brandEntityClarity: 0,
    factDensityScore: 0,
    dataAvailable: false,
    methodology:
      "No AI visibility data source is connected. This value is not a measurement of AI-engine citations.",
    engineBreakdown: {} as Record<string, number>,
    estimatedCitationsAcrossEngines: { googleAiOverviews: 0, perplexity: 0, chatgptSearch: 0, claude: 0 },
    keyEntityStrengths: [] as string[],
    recommendations: [] as string[],
  };

  // Measured facts used for the readiness heuristic and schema summary.
  const schemaTypes = collectSchemaTypes(snapshot.jsonLd);
  const malformedJsonLd = countMalformedJsonLd(html);
  const hasCanonical = Boolean(snapshot.canonical);
  let headingsValid = true;
  {
    let prev = 0;
    const h1 = snapshot.headings.filter((h) => h.level === 1).length;
    for (const h of snapshot.headings) {
      if (prev !== 0 && h.level > prev + 1) headingsValid = false;
      prev = h.level;
    }
    if (h1 !== 1) headingsValid = false;
  }
  const readiness = computeGeoReadiness({
    schemaTypes,
    hasCanonical,
    hasMetaDescription: snapshot.metaDescription.trim().length > 0,
    hasOpenGraph: Boolean(snapshot.openGraph.title || snapshot.openGraph.image),
    hasViewport: snapshot.hasViewport,
    headingsValid,
    wordCount: snapshot.wordCount,
  });

  if (includeGeo) {
    if (simulated) {
      const geoReport = await generateAiVisibilityReport({
        brandName: domain.split(".")[0].toUpperCase(),
        domain,
        targetQueries: [`best boutique hotel ${domain}`, `official site ${domain}`],
      });
      geo = {
        visibilityScore: geoReport.overallVisibilityScore,
        brandEntityClarity: geoReport.entityClarityScore,
        factDensityScore: 0,
        dataAvailable: false,
        methodology: "SIMULATED DATA (ALLOW_SIMULATED_DATA=1). Not a real AI-citation measurement.",
        engineBreakdown: geoReport.engineBreakdown,
        estimatedCitationsAcrossEngines: { googleAiOverviews: 0, perplexity: 0, chatgptSearch: 0, claude: 0 },
        keyEntityStrengths: readiness.strengths,
        recommendations: geoReport.recommendations,
      };
    } else {
      geo = {
        ...geo,
        visibilityScore: readiness.score,
        brandEntityClarity: readiness.score,
        methodology:
          "On-page GEO readiness heuristic derived from the page's own structured data and " +
          "metadata (schema, canonical, headings, content depth). No AI engine was queried, so " +
          "this is NOT a measurement of citations in ChatGPT, Perplexity, Claude or Google AI Overviews.",
        keyEntityStrengths: readiness.strengths,
        recommendations: [
          "Publish concise 40–60 word factual answer blocks under primary H2 headings.",
          "Add FAQPage and Organization/LodgingBusiness JSON-LD with consistent NAP data.",
          "Keep the brand entity consistent across Wikidata, Google Business Profile and the site.",
        ],
      };
    }
  }

  if (simulated) {
    const brandKeywords = await generateKeywordSuggestions({
      seedKeyword: domain.replace(/\.(com|org|net|io)$/i, ""),
      targetCountry: "US",
    });
    const contentGaps = await analyzeContentGaps({ primaryUrl: targetUrl, competitorUrls: [] });
    keywordSummary = {
      totalTargetKeywords: brandKeywords.length,
      top10KeywordsCount: 0,
      top3KeywordsCount: 0,
      averageKeywordDifficulty: 0,
      contentGapsIdentified: contentGaps.gapCount,
      topOpportunities: contentGaps.gaps.slice(0, 5),
    };
  }

  // 6. Algorithm impact (curated data/google-updates.json).
  const algoImpact = checkAlgorithmImpact(domain);

  // 7. Dimension scores — measured, with transparent weights.
  const technicalScore = fetchOk && statusCode > 0 && statusCode < 400
    ? scoreFromIssues(issues, (i) => i.category === "technical" || i.category === "accessibility")
    : 0;
  const onPageScore = scoreFromIssues(issues, (i) => i.category === "metadata" || i.category === "content");
  const headingsScore = scoreFromIssues(
    issues,
    (i) => i.category === "metadata" && /heading|h1/i.test(i.issueId)
  );
  const imagesScore = scoreFromIssues(issues, (i) => i.category === "media");
  const schemaScore =
    schemaTypes.length === 0
      ? malformedJsonLd > 0 ? 15 : 30
      : malformedJsonLd > 0
      ? 55
      : schemaTypes.length >= 3
      ? 100
      : 85;
  const gscScore = gscConnected && includeGsc ? (cannibalization.totalCannibalizedQueries > 0 ? 70 : 100) : 0;
  const aiVisibilityScore = includeGeo ? geo.visibilityScore : 0;

  const weighted: Array<{ weight: number; value: number }> = [
    { weight: 0.2, value: technicalScore },
    { weight: 0.2, value: onPageScore },
    { weight: 0.15, value: headingsScore },
    { weight: 0.15, value: imagesScore },
    { weight: 0.15, value: schemaScore },
  ];
  if (gscConnected && includeGsc) weighted.push({ weight: 0.15, value: gscScore });
  if (includeGeo) weighted.push({ weight: 0.1, value: aiVisibilityScore });
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const overallScore = Math.round(
    weighted.reduce((sum, w) => sum + w.weight * w.value, 0) / (totalWeight || 1)
  );

  // 8. Provenance.
  const provenance: DataProvenanceReport = {
    measured: [
      "technicalHealth (status, response time, server, compression, security headers)",
      "crawlability (robots.txt, sitemaps, canonical, indexability signals, link counts)",
      "onPage (title, meta description, word count, viewport)",
      "headings",
      "images (counts, alt text, formats, lazy-loading)",
      "schemaValidation (JSON-LD types parsed from the page)",
    ],
    estimated: includeGeo
      ? ["aiGeoVisibility.visibilityScore (on-page GEO readiness heuristic)"]
      : [],
    unavailable: [
      ...(gscConnected && includeGsc ? [] : ["searchConsole (Google Search Console not connected)"]),
      "keywordsAndGaps (no keyword-volume provider connected)",
      ...(includeGeo ? ["aiGeoVisibility.engineBreakdown / estimatedCitations (no AI engine queried)"] : []),
      "images.optimizationOpportunityBytes (per-image byte size not fetched)",
    ],
    simulated,
    notes: [
      "Single-URL audit: the target page only; a multi-page crawl is not performed.",
      ...(gscConnected ? [] : ["Set GOOGLE_SERVICE_ACCOUNT_B64/JSON to enable Search Console sections."]),
      ...(simulated ? ["ALLOW_SIMULATED_DATA is enabled — synthetic values are present and labelled."] : []),
    ],
  };

  const durationMs = Date.now() - startTime;

  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    targetUrl,
    domain,
    createdAt: new Date().toISOString(),
    durationMs,
    overallScore,
    scores: {
      technical: technicalScore,
      onPage: onPageScore,
      headings: headingsScore,
      images: imagesScore,
      schema: schemaScore,
      gsc: gscScore,
      aiVisibility: aiVisibilityScore,
    },
    technicalHealth: {
      statusCode,
      isHttps: targetUrl.startsWith("https://"),
      sslValid: targetUrl.startsWith("https://") && fetchOk,
      responseTimeMs,
      server,
      hasCompression,
      securityHeaders,
    },
    crawlability: {
      hasRobotsTxt,
      robotsTxtUrl: `${urlObj.origin}/robots.txt`,
      isIndexable: fetchOk && !/noindex/i.test(snapshot.metaRobots || ""),
      hasNoindex: /noindex/i.test(snapshot.metaRobots || ""),
      hasNofollow: /nofollow/i.test(snapshot.metaRobots || ""),
      canonicalUrl: snapshot.canonical,
      isCanonicalSelfReferencing: Boolean(
        snapshot.canonical &&
          snapshot.canonical.replace(/\/$/, "") === targetUrl.replace(/\/$/, "")
      ),
      discoveredSitemaps,
      totalInternalLinksDiscovered: snapshot.links.filter((l) => !l.external).length,
      totalExternalLinksDiscovered: snapshot.links.filter((l) => l.external).length,
    },
    onPage: {
      title: snapshot.title,
      titleLength: snapshot.title.length,
      titlePixelWidth: calculatePixelWidth(snapshot.title),
      isTitleBudgetCompliant:
        snapshot.title.length >= 40 && snapshot.title.length <= 60 && calculatePixelWidth(snapshot.title) <= 580,
      metaDescription: snapshot.metaDescription,
      metaDescriptionLength: snapshot.metaDescription.length,
      isMetaBudgetCompliant:
        snapshot.metaDescription.length >= 120 && snapshot.metaDescription.length <= 160,
      wordCount: snapshot.wordCount,
      readingTimeMinutes: Math.max(1, Math.round(snapshot.wordCount / 200)),
      primaryLanguage: snapshot.language || "unknown",
      hasViewportTag: snapshot.hasViewport,
    },
    headings: {
      totalHeadings: snapshot.headings.length,
      h1Count: snapshot.headings.filter((h) => h.level === 1).length,
      h2Count: snapshot.headings.filter((h) => h.level === 2).length,
      h3Count: snapshot.headings.filter((h) => h.level === 3).length,
      h4Count: snapshot.headings.filter((h) => h.level === 4).length,
      h5Count: snapshot.headings.filter((h) => h.level === 5).length,
      h6Count: snapshot.headings.filter((h) => h.level === 6).length,
      hierarchyValid: headingsValid,
      issuesCount: issues.filter((i) => /heading|h1/i.test(i.issueId)).length,
      sampleH1: snapshot.headings.find((h) => h.level === 1)?.text ?? "",
    },
    images: {
      totalImages: snapshot.images.length,
      missingAltCount: snapshot.images.filter((img) => !img.alt || !img.alt.trim()).length,
      oversizedCount: 0, // requires per-image byte size (not fetched)
      legacyFormatCount: snapshot.images.filter((img) =>
        ["jpg", "jpeg", "png", "gif"].includes((img.format || "").toLowerCase())
      ).length,
      lazyLoadedCount: snapshot.images.filter((img) => (img.loading || "").toLowerCase() === "lazy").length,
      optimizationOpportunityBytes: 0, // unmeasured
    },
    searchConsole: {
      isConnected: gscConnected && includeGsc,
      siteUrl: `sc-domain:${domain}`,
      periodDays: 0,
      totalClicks: gscData.totalClicks,
      totalImpressions: gscData.totalImpressions,
      averageCtr: gscData.averageCtr,
      averagePosition: gscData.averagePosition,
      cannibalizationDetectedCount: cannibalization.totalCannibalizedQueries,
      topQueries: gscData.rows.slice(0, 5).map((r) => ({
        query: r.query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
    },
    keywordsAndGaps: keywordSummary,
    schemaValidation: {
      schemasDetected: schemaTypes,
      isValidJsonLd: schemaTypes.length > 0 && malformedJsonLd === 0,
      validationErrorsCount: malformedJsonLd,
      missingRecommendedSchemas: ["Organization", "WebSite", "BreadcrumbList", "FAQPage"].filter(
        (t) => !schemaTypes.includes(t)
      ),
      richSnippetEligible: schemaTypes.some((t) =>
        ["Hotel", "LodgingBusiness", "LocalBusiness", "Restaurant", "Product", "FAQPage", "Article", "Event"].includes(t)
      ),
    },
    aiGeoVisibility: geo,
    algorithmImpact: {
      potentiallyImpactedByRecentUpdates: algoImpact.potentiallyImpacted,
      recentRelevantUpdates: algoImpact.recentUpdates.map(
        (u: { name: string; date: string; kind: string; notes?: string }) => ({
          name: u.name,
          date: u.date,
          kind: u.kind,
          notes: u.notes || "",
        })
      ),
      riskRating: algoImpact.riskRating,
    },
    actionPlan: buildActionPlan(issues, 1),
    dataProvenance: provenance,
  };
}
