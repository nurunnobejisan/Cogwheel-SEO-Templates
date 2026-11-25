"use client";

import React, { useState, useEffect } from "react";
import { FullWebsiteAuditReport, ActionItem } from "@/core/full-audit/types";

interface UnifiedSeoSuiteViewProps {
  property?: {
    name?: string;
    brand?: string;
    city?: string;
    state?: string;
    url?: string;
    websiteUrl?: string;
  };
  onBackToDashboard?: () => void;
  onOpenImageAudit?: () => void;
  onOpenHeadingAudit?: () => void;
}

type SuiteSubTab = "full-audit" | "gsc-intel" | "geo-visibility" | "ai-orchestrator" | "model-training";

/**
 * Answers the in-app assistant from the audit report the operator just ran.
 *
 * This deliberately does not call an LLM: the previous implementation returned
 * canned diagnoses and invented scores. Every sentence below is derived from
 * measured report fields, and missing data sources are named instead of filled.
 */
function answerFromAudit(
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


export function UnifiedSeoSuiteView({
  property,
  onBackToDashboard,
  onOpenImageAudit,
  onOpenHeadingAudit,
}: UnifiedSeoSuiteViewProps) {
  const [subTab, setSubTab] = useState<SuiteSubTab>("full-audit");
  const [targetUrl, setTargetUrl] = useState<string>(property?.websiteUrl || property?.url || "https://thenines.com");
  const [maxPages, setMaxPages] = useState<number>(25);
  const [includeGsc, setIncludeGsc] = useState<boolean>(true);
  const [includeGeo, setIncludeGeo] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [auditReport, setAuditReport] = useState<FullWebsiteAuditReport | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"html" | "pdf" | "csv" | "pptx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant" | "system"; content: string; toolUsed?: string }>>([
    {
      role: "assistant",
      content:
        "Ask about the audit you just ran — Search Console, GEO readiness, algorithm risk, headings, images or technical health. Answers are computed from the current report only; this assistant does not call an external AI model and will name any data source that is not connected.",
    },
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Training rules & change history (loaded from /api/ai-training)
  const [trainingData, setTrainingData] = useState<{
    provider: string;
    rules: Array<{
      id: string;
      taskId: string | null;
      title: string;
      ruleText: string;
      active: boolean;
      createdAt: string;
    }>;
    history: Array<{
      id: string;
      authorName: string;
      category: string;
      requestText: string;
      status: string;
      summary: string;
      createdAt: string;
    }>;
  } | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingLoading, setTrainingLoading] = useState<boolean>(false);

  useEffect(() => {
    if (subTab !== "model-training" || trainingData || trainingLoading) return;
    let cancelled = false;
    setTrainingLoading(true);

    fetch("/api/ai-training")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setTrainingData({
          provider: typeof data.provider === "string" ? data.provider : "unknown",
          rules: Array.isArray(data.rules) ? data.rules : [],
          history: Array.isArray(data.history) ? data.history : [],
        });
      })
      .catch((err) => {
        if (!cancelled) setTrainingError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setTrainingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subTab, trainingData, trainingLoading]);

  // Run Full Audit Handler
  const handleRunAudit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setAuditError(null);

    try {
      const res = await fetch("/api/full-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          maxPages,
          includeGsc,
          includeGeo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Audit failed to execute");
      }
      setAuditReport(data.report);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async (format: "html" | "pdf" | "csv" | "pptx") => {
    if (!auditReport || exportFormat) return;
    setExportFormat(format);
    setExportError(null);

    try {
      const res = await fetch("/api/audit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, report: auditReport }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || `cogwheel-audit.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportFormat(null);
    }
  };

  // Answer questions from the current audit report (no external model call)
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsChatLoading(true);

    const answer = answerFromAudit(userText, auditReport, targetUrl);
    setChatMessages((prev) => [
      ...prev,
      { role: "assistant", content: answer.content, toolUsed: answer.toolUsed },
    ]);
    setIsChatLoading(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-brand">
              Unified Platform
            </span>
            <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              MIT Code Integration Complete
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Unified AI SEO &amp; GEO Automation Suite
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Powered by Claude-SEO (20 Specialized Agents &amp; Algorithm Volatility), Open-SEO (Issue Catalog &amp; GEO Visibility), and FastMCP Search Console.
          </p>
        </div>

        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            &larr; Back to Dashboard
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { id: "full-audit", label: "Full Website Audit", tag: "11-D" },
          { id: "gsc-intel", label: "GSC Performance & Cannibalization", tag: "FastMCP" },
          { id: "geo-visibility", label: "AI & GEO Visibility", tag: "AI Citations" },
          { id: "ai-orchestrator", label: "Unified AI Assistant", tag: "20 Agents" },
          { id: "model-training", label: "AI Model & Training Vault", tag: "SFT v3.0" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as SuiteSubTab)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              subTab === tab.id
                ? "bg-brand text-slate-900 shadow-glow dark:bg-brand dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                subTab === tab.id
                  ? "bg-slate-900 text-brand-light dark:bg-slate-950 dark:text-brand"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {tab.tag}
            </span>
          </button>
        ))}
      </div>

      {/* SUBTAB 1: FULL WEBSITE AUDIT */}
      {subTab === "full-audit" && (
        <div className="space-y-6">
          {/* Audit Launcher Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Launch 11-Dimension Comprehensive Website Audit
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Evaluates Technical Health, Crawlability, On-Page SEO, Heading Hierarchy, Image Optimization, Search Console Cannibalization, Keyword Gaps, Schemas, and AI Visibility.
            </p>

            <form onSubmit={handleRunAudit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Target Website URL
                  </label>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    required
                    placeholder="https://example.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Crawl Page Limit
                  </label>
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value={10}>10 pages (Quick)</option>
                    <option value={25}>25 pages (Standard)</option>
                    <option value={50}>50 pages (Deep)</option>
                    <option value={100}>100 pages (Comprehensive)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:brightness-105 disabled:opacity-50"
                  >
                    {isLoading ? "Auditing Website..." : "Run Unified Audit"}
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-600 dark:text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGsc}
                    onChange={(e) => setIncludeGsc(e.target.checked)}
                    className="rounded text-brand focus:ring-brand"
                  />
                  <span>Include Google Search Console Cannibalization Analysis</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGeo}
                    onChange={(e) => setIncludeGeo(e.target.checked)}
                    className="rounded text-brand focus:ring-brand"
                  />
                  <span>Include Generative Engine (GEO) &amp; AI Overviews Scoring</span>
                </label>
              </div>
            </form>

            {auditError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <strong>Error running audit:</strong> {auditError}
              </div>
            )}
          </div>

          {/* Audit Results View */}
          {auditReport ? (
            <div className="space-y-6">
              {/* Report header + exports */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Audit report
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {auditReport.domain} · generated {new Date(auditReport.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Export
                  </span>
                  {(["html", "pdf", "csv", "pptx"] as const).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => handleExportReport(format)}
                      disabled={exportFormat !== null}
                      aria-label={`Download ${format.toUpperCase()} report`}
                      title={
                        format === "pptx"
                          ? "Client-ready presentation deck"
                          : format === "pdf"
                            ? "Portable PDF (text layout)"
                            : format === "html"
                              ? "Print-ready HTML (best for pixel-perfect PDF)"
                              : "Spreadsheet-friendly data export"
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 shadow-sm transition hover:border-brand hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand"
                    >
                      {exportFormat === format ? "Preparing…" : format}
                    </button>
                  ))}
                </div>
              </div>
              {exportError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <strong>Export failed:</strong> {exportError}
                </div>
              )}

              {/* Executive Score Card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Overall Health Score</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-extrabold text-brand">
                      {auditReport.overallScore}
                    </span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {auditReport.dataProvenance?.simulated
                      ? "Contains simulated data (ALLOW_SIMULATED_DATA is on)"
                      : `${auditReport.dataProvenance?.measured.length ?? 0} dimensions measured from the live page`}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Technical &amp; Crawl</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-slate-900 dark:text-white">
                      {auditReport.scores.technical}
                    </span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Response: {auditReport.technicalHealth.responseTimeMs}ms | HTTPS: {auditReport.technicalHealth.isHttps ? "Active" : "No"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">GSC Cannibalization</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {auditReport.searchConsole.cannibalizationDetectedCount}
                    </span>
                    <span className="text-xs text-slate-500">conflicts detected</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {auditReport.searchConsole.isConnected
                      ? `Total impressions: ${auditReport.searchConsole.totalImpressions.toLocaleString()}`
                      : "Google Search Console not connected"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">AI / GEO Visibility</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {auditReport.scores.aiVisibility}
                    </span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {auditReport.aiGeoVisibility.dataAvailable
                      ? "Measured from a connected AI-visibility source"
                      : "Estimated on-page readiness — no AI engine queried"}
                  </p>
                </div>
              </div>

              {/* Data provenance banner */}
              {auditReport.dataProvenance && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-xs dark:border-slate-800 dark:bg-slate-800/30">
                  <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Data provenance
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    {auditReport.dataProvenance.simulated
                      ? "This report contains simulated data and must not be treated as a measurement."
                      : "Measured values come from a live fetch of the target page. Dimensions without a data source are shown as unavailable and are not included in the overall score."}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Measured
                      </span>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600 dark:text-slate-400">
                        {auditReport.dataProvenance.measured.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Unavailable (not connected)
                      </span>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600 dark:text-slate-400">
                        {auditReport.dataProvenance.unavailable.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {auditReport.dataProvenance.notes.length > 0 && (
                    <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-500">
                      {auditReport.dataProvenance.notes.join(" ")}
                    </p>
                  )}
                </div>
              )}

              {/* Action Plan (P0 - P3) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Prioritized Action Plan ({auditReport.actionPlan.length} Remediations)
                  </h3>
                  <span className="text-xs text-slate-500">Sorted by Impact &amp; Priority</span>
                </div>

                <div className="mt-4 space-y-3">
                  {auditReport.actionPlan.map((action: ActionItem) => (
                    <div
                      key={action.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 md:flex-row md:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                              action.priority === "P0"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : action.priority === "P1"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {action.priority}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {action.category}
                          </span>
                        </div>
                        <h4 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                          {action.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                          {action.description}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          Remediation: {action.remediationGuide}
                        </p>
                      </div>

                      <div className="flex flex-shrink-0 flex-col items-end text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Impact: {action.impact}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Effort: {action.effort} | URLs: {action.affectedUrlsCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Jump Buttons to Dedicated Modals */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Heading Structure Audit</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Found {auditReport.headings.totalHeadings} headings. Valid hierarchy: {auditReport.headings.hierarchyValid ? "Yes" : "Needs Review"}.
                  </p>
                  {onOpenHeadingAudit && (
                    <button
                      type="button"
                      onClick={onOpenHeadingAudit}
                      className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Open Heading Structure Studio &rarr;
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Image Optimization Audit</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Found {auditReport.images.totalImages} images ({auditReport.images.missingAltCount} missing ALT text, {(auditReport.images.optimizationOpportunityBytes / (1024 * 1024)).toFixed(1)} MB compressible).
                  </p>
                  {onOpenImageAudit && (
                    <button
                      type="button"
                      onClick={onOpenImageAudit}
                      className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Open Image Audit Studio &rarr;
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Run Unified Audit&rdquo; above to generate your comprehensive 11-dimension SEO report.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: GSC INTEL */}
      {subTab === "gsc-intel" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Google Search Console FastMCP Intelligence
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Powered by the integrated `mcp-gsc` protocol engine: Search Analytics, Period Comparison, URL Inspection, and Cannibalization Detection.
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              No Search Console data available
            </p>
            <p className="mt-1 text-xs">
              Set <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-slate-700">GOOGLE_SERVICE_ACCOUNT_B64</code>{" "}
              (or <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-slate-700">GOOGLE_SERVICE_ACCOUNT_JSON</code>)
              and grant the service account access to the property. Until then, clicks, impressions, CTR and
              position cannot be shown — they are never simulated.
            </p>
          </div>
        </div>
      )}

      {/* SUBTAB 3: GEO VISIBILITY */}
      {subTab === "geo-visibility" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Generative Engine Optimization (GEO) &amp; AI Citation Monitor
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            On-page readiness signals for generative engines. AI citation counts require a live engine
            data source, which is not connected — no citation rates are shown or invented.
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-purple-300 bg-purple-50/40 p-6 text-sm text-slate-600 dark:border-purple-900/60 dark:bg-purple-950/20 dark:text-slate-400">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              AI citation rates are not measured
            </p>
            <p className="mt-1 text-xs">
              Reporting per-engine citation share (ChatGPT, Perplexity, Claude, Google AI Overviews)
              requires querying those engines or a licensed visibility provider. Neither is connected,
              so this panel intentionally shows no scores rather than estimated ones.
            </p>
          </div>
        </div>
      )}

      {/* SUBTAB 4: AI ORCHESTRATOR CHAT */}
      {subTab === "ai-orchestrator" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Unified AI SEO Model &amp; Multi-Agent Orchestrator
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Interactive multi-tool assistant with direct access to all 9 integrated SEO tools.
          </p>

          <div className="mt-4 flex flex-col h-[400px] rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-xs ${
                      msg.role === "user"
                        ? "bg-slate-900 text-white dark:bg-brand dark:text-slate-900"
                        : "bg-white text-slate-800 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {msg.toolUsed && (
                      <div className="mb-2 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Tool: {msg.toolUsed}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="text-xs text-slate-500 italic">AI is evaluating tools and compiling diagnostic data...</div>
              )}
            </div>

            {/* Quick Prompt Suggestion Chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Quick Prompt:</span>
              {[
                "Detect cannibalization in Search Console",
                "Audit GEO citations on Perplexity",
                "Check August 2024 Core Update impact",
                "Analyze heading hierarchy skipped levels",
              ].map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => setChatInput(promptText)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand dark:hover:text-white"
                >
                  {promptText}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about query cannibalization, Google algorithm updates, or GEO citations..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:brightness-105 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB 5: MODEL TRAINING & REGISTRY */}
      {subTab === "model-training" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Fine-Tuning Dataset &amp; Model Checkpoint Vault
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Synthesized from Google Update archives, 20 agent instruction sets, and hospitality SERP matrix.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-bold uppercase text-slate-500">Active Checkpoint</span>
              <div className="mt-1 font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                {modelRegistry.activeModelId}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-bold uppercase text-slate-500">Train / Eval Examples</span>
              <div className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
                {modelRegistry.totalTrainingExamples} / {modelRegistry.totalEvalExamples}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-bold uppercase text-slate-500">Holdout Benchmark</span>
              <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {modelRegistry.benchmarkScore}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-bold uppercase text-slate-500">Hallucination Rate</span>
              <div className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
                {modelRegistry.hallucinationRate}%
              </div>
            </div>
          </div>

          {/* SFT Dataset & Loss Curve Breakdown */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                SFT Dataset Composition (168 Total Examples)
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>Google Algorithm Updates (2019-2024)</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">35 pairs (21%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: "21%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>20 Specialized Claude-SEO Agents</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">20 pairs (12%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: "12%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>78-Keyword Strategy &amp; Intent Matrix</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">78 pairs (46%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-brand" style={{ width: "46%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>Search Console Query Cannibalization &amp; GEO</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">35 pairs (21%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: "21%" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Fine-Tuning Convergence &amp; Quality Metrics
              </h3>
              <div className="mt-3 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900">
                  <span className="text-slate-600 dark:text-slate-400">Initial Validation Loss</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">1.842</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900">
                  <span className="text-slate-600 dark:text-slate-400">Final Epoch 3 Loss</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0.412 (-77.6%)</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900">
                  <span className="text-slate-600 dark:text-slate-400">Deterministic Formatting Compliance</span>
                  <span className="font-mono font-bold text-brand-dark dark:text-brand">100.0%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
