"use client";

import React, { useState, useEffect } from "react";
import { FullWebsiteAuditReport, ActionItem } from "@/core/full-audit/types";
import GscPerformancePanel from "./GscPerformancePanel.tsx";
import VisibilityMonitorPanel from "./VisibilityMonitorPanel.tsx";
import type { GscPanelPayload } from "@/core/gsc/panel-types.ts";

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

export function UnifiedSeoSuiteView({
  property,
  onBackToDashboard,
  onOpenImageAudit,
  onOpenHeadingAudit,
}: UnifiedSeoSuiteViewProps) {
  const [subTab, setSubTab] = useState<SuiteSubTab>("full-audit");
  const [targetUrl, setTargetUrl] = useState<string>(property?.websiteUrl || property?.url || "");
  const [maxPages, setMaxPages] = useState<number>(25);
  const [includeGsc, setIncludeGsc] = useState<boolean>(true);
  const [includeGeo, setIncludeGeo] = useState<boolean>(true);
  const [gscForAudit, setGscForAudit] = useState<GscPanelPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [auditReport, setAuditReport] = useState<FullWebsiteAuditReport | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"html" | "pdf" | "csv" | "pptx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState<
    Array<{
      role: "user" | "assistant" | "system";
      content: string;
      toolUsed?: string;
      provider?: string;
      provenance?: string;
    }>
  >([
    {
      role: "assistant",
      content:
        "Ask about the audit you just ran — Search Console, GEO readiness, algorithm risk, headings, images or technical health. Answers try Gemini, Groq and OpenRouter free tiers, then optional paid keys, then a deterministic rules fallback. Every number is checked against the current audit, Search Console, visibility and knowledge-base context before it is shown.",
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
    if (subTab !== "model-training" || trainingData) return;
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
  }, [subTab, trainingData]);

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
          gscPanel: gscForAudit,
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
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || `seo-studio-audit.${format}`;
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

  // Streams answers from /api/assistant. The route supplies the engine label
  // and the result of the unverified-number check as SSE-style JSON events.
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: "", provider: "Connecting…" },
    ]);
    setIsChatLoading(true);

    const appendToLast = (patch: { content?: string; provider?: string; toolUsed?: string; provenance?: string }) => {
      setChatMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (!last || last.role !== "assistant") return prev;
        updated[updated.length - 1] = {
          ...last,
          ...patch,
          content: `${last.content}${patch.content ?? ""}`,
        };
        return updated;
      });
    };

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          targetUrl,
          report: auditReport,
          gscPanel: gscForAudit,
        }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `Assistant request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line) as {
            type: string;
            text?: string;
            provider?: string;
            toolUsed?: string;
            provenance?: { ok: boolean; untracedNumbers?: string[] };
            message?: string;
          };
          if (parsed.type === "status") appendToLast({ provider: `Checking ${parsed.provider}…` });
          if (parsed.type === "delta") appendToLast({ content: parsed.text ?? "" });
          if (parsed.type === "done") {
            appendToLast({
              provider: parsed.provider,
              toolUsed: parsed.toolUsed,
              provenance: parsed.provenance?.ok
                ? "All numbers traced to supplied context"
                : `Unverified numbers: ${(parsed.provenance?.untracedNumbers ?? []).join(", ") || "unknown"}`,
            });
          }
          if (parsed.type === "error") appendToLast({ content: `\n\nError: ${parsed.message ?? "stream failed"}` });
        }
      }
    } catch (err) {
      appendToLast({
        content: `\n\nCould not answer: ${err instanceof Error ? err.message : String(err)}`,
        provider: "Unavailable",
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand/10 px-2.5 py-1 text-eyebrow font-bold uppercase tracking-wider text-brand-dark dark:text-brand">
              Unified Platform
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-eyebrow font-bold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              MIT Code Integration Complete
            </span>
          </div>
          <h1 className="mt-2 font-display text-display font-extrabold text-slate-900 dark:text-white">
            Unified AI SEO &amp; GEO Automation Suite
          </h1>
          <p className="mt-1.5 max-w-3xl text-body text-slate-500 text-pretty dark:text-slate-400">
            Powered by Claude-SEO (20 Specialized Agents &amp; Algorithm Volatility), Open-SEO (Issue Catalog &amp; GEO Visibility), and FastMCP Search Console.
          </p>
        </div>

        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-caption font-semibold text-slate-700 shadow-soft transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            &larr; Back to Dashboard
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { id: "full-audit", label: "Full Website Audit", tag: "11-D" },
          { id: "gsc-intel", label: "GSC Performance & Cannibalization", tag: "Live API" },
          { id: "geo-visibility", label: "AI & GEO Visibility", tag: "AI Citations" },
          { id: "ai-orchestrator", label: "Audit Assistant", tag: "Rules-based" },
          { id: "model-training", label: "Training Rules", tag: "Stored" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as SuiteSubTab)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-caption font-bold transition-all ${
              subTab === tab.id
                ? "bg-brand text-slate-900 shadow-glow dark:bg-brand dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-micro font-extrabold uppercase ${
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
            <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
              Evaluates Technical Health, Crawlability, On-Page SEO, Heading Hierarchy, Image Optimization, Search Console Cannibalization, Keyword Gaps, Schemas, and AI Visibility.
            </p>

            <form onSubmit={handleRunAudit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="block text-caption font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Target Website URL
                  </label>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    required
                    placeholder="https://example.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-caption font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Crawl Page Limit
                  </label>
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                    className="w-full rounded-xl bg-brand px-4 py-2.5 text-caption font-bold text-slate-900 shadow-sm transition hover:brightness-105 disabled:opacity-50"
                  >
                    {isLoading ? "Auditing Website..." : "Run Unified Audit"}
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2 text-caption text-slate-600 dark:text-slate-400">
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
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-caption text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
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
                  <div className="text-tiny font-bold uppercase tracking-wider text-slate-500">
                    Audit report
                  </div>
                  <div className="mt-0.5 text-caption text-slate-600 dark:text-slate-400">
                    {auditReport.domain} · generated {new Date(auditReport.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-tiny font-semibold uppercase tracking-wider text-slate-500">
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
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-tiny font-bold uppercase tracking-wider text-slate-700 shadow-sm transition hover:border-brand hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand"
                    >
                      {exportFormat === format ? "Preparing…" : format}
                    </button>
                  ))}
                </div>
              </div>
              {exportError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-caption text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <strong>Export failed:</strong> {exportError}
                </div>
              )}

              {/* Executive Score Card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-tiny font-bold uppercase tracking-wider text-slate-500">Overall Health Score</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-extrabold text-brand">
                      {auditReport.overallScore}
                    </span>
                    <span className="text-caption text-slate-500">/ 100</span>
                  </div>
                  <p className="mt-2 text-caption text-slate-500 dark:text-slate-400">
                    {auditReport.dataProvenance?.simulated
                      ? "Contains simulated data (ALLOW_SIMULATED_DATA is on)"
                      : `${auditReport.dataProvenance?.measured.length ?? 0} dimensions measured from the live page`}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-tiny font-bold uppercase tracking-wider text-slate-500">Technical &amp; Crawl</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-slate-900 dark:text-white">
                      {auditReport.scores.technical}
                    </span>
                    <span className="text-caption text-slate-500">/ 100</span>
                  </div>
                  <p className="mt-2 text-caption text-slate-500">
                    Response: {auditReport.technicalHealth.responseTimeMs}ms | HTTPS: {auditReport.technicalHealth.isHttps ? "Active" : "No"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-tiny font-bold uppercase tracking-wider text-slate-500">GSC Cannibalization</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {auditReport.searchConsole.cannibalizationDetectedCount}
                    </span>
                    <span className="text-caption text-slate-500">conflicts detected</span>
                  </div>
                  <p className="mt-2 text-caption text-slate-500">
                    {auditReport.searchConsole.isConnected
                      ? `Total impressions: ${auditReport.searchConsole.totalImpressions.toLocaleString()}`
                      : "Google Search Console not connected"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-tiny font-bold uppercase tracking-wider text-slate-500">AI / GEO Visibility</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {auditReport.scores.aiVisibility}
                    </span>
                    <span className="text-caption text-slate-500">/ 100</span>
                  </div>
                  <p className="mt-2 text-caption text-slate-500">
                    {auditReport.aiGeoVisibility.dataAvailable
                      ? "Measured from a connected AI-visibility source"
                      : "Estimated on-page readiness — no AI engine queried"}
                  </p>
                </div>
              </div>

              {/* Data provenance banner */}
              {auditReport.dataProvenance && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-caption dark:border-slate-800 dark:bg-slate-800/30">
                  <div className="font-display text-body font-bold text-slate-900 dark:text-white">
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
                    <p className="mt-3 text-tiny text-slate-500 dark:text-slate-500">
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
                  <span className="text-caption text-slate-500">Sorted by Impact &amp; Priority</span>
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
                            className={`rounded px-2 py-0.5 text-micro font-extrabold uppercase ${
                              action.priority === "P0"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : action.priority === "P1"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {action.priority}
                          </span>
                          <span className="text-caption font-bold uppercase tracking-wider text-slate-500">
                            {action.category}
                          </span>
                        </div>
                        <h4 className="mt-1 text-body font-bold text-slate-900 dark:text-white">
                          {action.title}
                        </h4>
                        <p className="mt-0.5 text-caption text-slate-600 dark:text-slate-400">
                          {action.description}
                        </p>
                        <p className="mt-1 text-tiny font-medium text-emerald-700 dark:text-emerald-400">
                          Remediation: {action.remediationGuide}
                        </p>
                      </div>

                      <div className="flex flex-shrink-0 flex-col items-end text-caption">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Impact: {action.impact}
                        </span>
                        <span className="text-tiny text-slate-500">
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
                  <h4 className="text-body font-bold text-slate-900 dark:text-white">Heading Structure Audit</h4>
                  <p className="mt-1 text-caption text-slate-500">
                    Found {auditReport.headings.totalHeadings} headings. Valid hierarchy: {auditReport.headings.hierarchyValid ? "Yes" : "Needs Review"}.
                  </p>
                  {onOpenHeadingAudit && (
                    <button
                      type="button"
                      onClick={onOpenHeadingAudit}
                      className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-caption font-semibold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Open Heading Structure Studio &rarr;
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-body font-bold text-slate-900 dark:text-white">Image Optimization Audit</h4>
                  <p className="mt-1 text-caption text-slate-500">
                    Found {auditReport.images.totalImages} images ({auditReport.images.missingAltCount} missing ALT text, {(auditReport.images.optimizationOpportunityBytes / (1024 * 1024)).toFixed(1)} MB compressible).
                  </p>
                  {onOpenImageAudit && (
                    <button
                      type="button"
                      onClick={onOpenImageAudit}
                      className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-caption font-semibold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Open Image Audit Studio &rarr;
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <p className="text-caption text-slate-500 dark:text-slate-400">
                Click &ldquo;Run Unified Audit&rdquo; above to generate your comprehensive 11-dimension SEO report.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: GSC PERFORMANCE & CANNIBALIZATION */}
      {subTab === "gsc-intel" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <GscPerformancePanel
            property={property}
            onUseInAudit={(data) => {
              setGscForAudit(data);
              setSubTab("full-audit");
              setIncludeGsc(true);
            }}
          />
          {gscForAudit && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-caption text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              Real GSC rows from {gscForAudit.siteUrl} are attached to the next 11-D audit run.
            </p>
          )}
        </div>
      )}

      {/* SUBTAB 3: GEO VISIBILITY */}
      {subTab === "geo-visibility" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Generative Engine Optimization (GEO) &amp; AI Citation Monitor
          </h2>
          <div className="mt-4">
            <VisibilityMonitorPanel property={property} />
          </div>
        </div>
      )}

      {/* SUBTAB 4: AI ORCHESTRATOR CHAT */}
      {subTab === "ai-orchestrator" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Audit Assistant
          </h2>
          <p className="mt-1 text-caption text-slate-500">
            Answers are grounded in the current audit, Search Console panel, visibility runs and
            retrieved knowledge. Free engines are tried first, then optional paid keys, then the
            deterministic rules engine. Every number is checked before display.
          </p>

          <div className="mt-4 flex flex-col h-[400px] rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-caption ${
                      msg.role === "user"
                        ? "bg-slate-900 text-white dark:bg-brand dark:text-slate-900"
                        : "bg-white text-slate-800 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {msg.provider && (
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-micro font-semibold text-purple-800 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200">
                          {msg.provider}
                        </span>
                      )}
                      {msg.toolUsed && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-micro font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {msg.toolUsed}
                        </span>
                      )}
                      {msg.provenance && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-micro font-semibold ${
                            msg.provenance.startsWith("All numbers")
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                          }`}
                        >
                          {msg.provenance}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="text-caption text-slate-500 italic">Checking grounded context and engine availability…</div>
              )}
            </div>

            {/* Quick Prompt Suggestion Chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Quick Prompt:</span>
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
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-tiny font-medium text-slate-700 transition hover:border-brand hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand dark:hover:text-white"
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
                placeholder="Ask about Search Console, GEO, algorithm risk, headings, images or technical health..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="rounded-xl bg-brand px-4 py-2.5 text-caption font-bold text-slate-900 shadow-sm transition hover:brightness-105 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB 5: TRAINING RULES & CHANGE HISTORY */}
      {subTab === "model-training" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Training Rules &amp; Change History
            </h2>
            <p className="mt-1 text-caption text-slate-500">
              Loaded live from <code className="font-mono">/api/ai-training</code>. Rules are the
              operator guidance the platform applies; the list below is the stored state, not a demo
              dataset.
            </p>

            {trainingLoading && (
              <p className="mt-6 text-caption italic text-slate-500">Loading stored rules…</p>
            )}

            {trainingError && (
              <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-caption text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <strong>Could not load training data:</strong> {trainingError}
              </div>
            )}

            {trainingData && (
              <>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-tiny font-bold uppercase text-slate-500">AI Provider</span>
                    <div className="mt-1 font-mono text-caption font-bold text-slate-900 dark:text-white truncate">
                      {trainingData.provider}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-tiny font-bold uppercase text-slate-500">Stored Rules</span>
                    <div className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
                      {trainingData.rules.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-tiny font-bold uppercase text-slate-500">Active Rules</span>
                    <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {trainingData.rules.filter((rule) => rule.active).length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-tiny font-bold uppercase text-slate-500">Feedback Records</span>
                    <div className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
                      {trainingData.history.length}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <h3 className="text-caption font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Stored rules
                    </h3>
                    {trainingData.rules.length === 0 ? (
                      <p className="mt-3 text-caption text-slate-500">No rules are stored yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {trainingData.rules.slice(0, 6).map((rule) => (
                          <li key={rule.id} className="rounded-lg border border-slate-200 bg-white p-3 text-caption dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{rule.title}</span>
                              <span className={`rounded px-1.5 py-0.5 text-micro font-bold uppercase ${rule.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                                {rule.active ? "active" : "inactive"}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600 dark:text-slate-400">{rule.ruleText}</p>
                            <p className="mt-1 text-micro text-slate-400">
                              {rule.taskId ? `Task: ${rule.taskId}` : "Global rule"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <h3 className="text-caption font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Recent feedback
                    </h3>
                    {trainingData.history.length === 0 ? (
                      <p className="mt-3 text-caption text-slate-500">
                        No feedback has been recorded on this instance. Feedback history is kept in
                        memory and resets when the server restarts.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {trainingData.history.slice(-6).reverse().map((entry) => (
                          <li key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3 text-caption dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{entry.authorName}</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-micro font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                {entry.status}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600 dark:text-slate-400">{entry.summary || entry.requestText}</p>
                            <p className="mt-1 text-micro text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-caption text-slate-600 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
            <h3 className="font-display text-body font-bold text-slate-900 dark:text-white">
              No model checkpoint is configured
            </h3>
            <p className="mt-1">
              Holdout benchmark, validation loss and hallucination rate require a trained checkpoint
              plus an evaluation harness. Neither exists in this deployment, so those figures are not
              shown — placeholder numbers would misrepresent the system&apos;s quality.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
