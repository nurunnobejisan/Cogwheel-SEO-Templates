"use client";

import { useState } from "react";
import { Button } from "./ui";
import type { PageHeadingAudit, HeadingAuditSummary } from "@/core/heading-audit/types";

interface Props {
  defaultUrl?: string;
  onClose: () => void;
}

interface HeadingAuditApiResponse {
  success: boolean;
  summary: HeadingAuditSummary;
  pages: PageHeadingAudit[];
  filename: string;
  xlsxBase64: string;
  googleSheetUrl?: string | null;
  googleSheetError?: string | null;
  googleConfigured?: boolean;
  error?: string;
}

export function HeadingStructureAuditModal({ defaultUrl = "", onClose }: Props) {
  const [urlInput, setUrlInput] = useState(defaultUrl || "");
  const [maxPages, setMaxPages] = useState(50);
  const [delayMs, setDelayMs] = useState(100);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [saveToGoogleSheets, setSaveToGoogleSheets] = useState(false);
  const [enableSitemaps, setEnableSitemaps] = useState(true);

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HeadingAuditApiResponse | null>(null);
  const [filterType, setFilterType] = useState<"all" | "issues" | "missing-h1" | "multi-h1" | "skipped">("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedPageUrl, setExpandedPageUrl] = useState<string | null>(null);

  const handleRunAudit = async () => {
    let target = urlInput.trim();
    if (!target) {
      setError("Please enter a website URL to audit.");
      return;
    }
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
      setUrlInput(target);
    }

    setLoading(true);
    setError(null);
    setProgressMsg("Checking XML sitemaps, discovering pages & inspecting heading hierarchy (H1–H6)...");

    try {
      const res = await fetch("/api/heading-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target,
          maxPages,
          delayMs,
          timeoutMs: 10000,
          includeSubdomains,
          saveToGoogleSheets,
          enableSitemaps,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute heading structure audit");
      }

      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error executing heading audit";
      setError(msg);
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  const handleDownloadXlsx = () => {
    if (!result?.xlsxBase64) return;
    const byteCharacters = atob(result.xlsxBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = result.filename || "heading-optimization-audit.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter pages
  const filteredPages = (result?.pages || []).filter((page) => {
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const match =
        page.pageUrl.toLowerCase().includes(q) ||
        page.targetKeyword.toLowerCase().includes(q) ||
        page.headings.some(
          (h) =>
            h.originalText.toLowerCase().includes(q) ||
            h.optimizedText.toLowerCase().includes(q)
        );
      if (!match) return false;
    }

    if (filterType === "all") return true;
    if (filterType === "issues") {
      return (
        page.h1Count === 0 ||
        page.h1Count > 1 ||
        page.hasSkippedLevels ||
        page.headings.some((h) => h.issues.length > 0)
      );
    }
    if (filterType === "missing-h1") return page.h1Count === 0 || Boolean(page.missingH1);
    if (filterType === "multi-h1") return page.h1Count > 1 || Boolean(page.multipleH1);
    if (filterType === "skipped") return page.hasSkippedLevels;
    return true;
  });

  return (
    <div className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Heading Structure Optimization Studio
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-micro font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                The Nines Reference Parity
              </span>
            </h2>
            <p className="text-caption text-slate-500 dark:text-slate-400">
              Audit rendered heading hierarchies (H1–H6), detect missing or unrendered placeholders, and export 6-column optimized spreadsheets.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Input Configuration Box */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
          <div className="space-y-4">
            <div>
              <label className="block text-caption font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Website URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://your-property.com/"
                  disabled={loading}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-body text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <Button
                  onClick={handleRunAudit}
                  disabled={loading}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Auditing...
                    </span>
                  ) : (
                    "Run Heading Audit"
                  )}
                </Button>
              </div>
            </div>

            {/* Advanced Discovery Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-caption">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Max Crawl Depth
                </label>
                <select
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-caption text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value={10}>10 pages (Fast)</option>
                  <option value={25}>25 pages (Standard)</option>
                  <option value={50}>50 pages (Full Site Target)</option>
                  <option value={100}>100 pages (Deep Crawl)</option>
                  <option value={150}>150 pages (Exhaustive)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Delay Between Requests
                </label>
                <select
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-caption text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value={0}>0ms (Fastest)</option>
                  <option value={50}>50ms (Balanced)</option>
                  <option value={100}>100ms (Polite Default)</option>
                  <option value={300}>300ms (High Reliability)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSitemaps}
                    onChange={(e) => setEnableSitemaps(e.target.checked)}
                    disabled={loading}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Parse XML Sitemaps</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSubdomains}
                    onChange={(e) => setIncludeSubdomains(e.target.checked)}
                    disabled={loading}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Audit Subdomains</span>
                </label>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToGoogleSheets}
                    onChange={(e) => setSaveToGoogleSheets(e.target.checked)}
                    disabled={loading}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Sync directly to Google Sheets</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Progress Notification */}
        {loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-center justify-center gap-3">
              <svg className="h-5 w-5 animate-spin text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-body font-semibold text-amber-900 dark:text-amber-200">
                {progressMsg}
              </span>
            </div>
            <p className="mt-1 text-caption text-amber-700 dark:text-amber-400">
              Traversing sitemaps, extracting rendered headings, validating single H1, and generating hierarchy optimization recommendations.
            </p>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-caption text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <div className="font-semibold mb-0.5">Audit Failed</div>
            {error}
          </div>
        )}

        {/* Results View */}
        {result && (
          <div className="space-y-6">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-tiny font-medium text-slate-500">Pages Audited</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                  {result.summary.pagesScanned}
                  <span className="text-caption font-normal text-slate-400"> / {result.summary.pagesDiscovered}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-tiny font-medium text-slate-500">Total Headings</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                  {result.summary.totalHeadingsAudited}
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 text-center dark:border-red-900/40 dark:bg-red-950/20">
                <div className="text-tiny font-medium text-red-600 dark:text-red-400">Missing H1</div>
                <div className="mt-1 text-xl font-extrabold text-red-700 dark:text-red-400">
                  {result.summary.pagesMissingH1Count}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="text-tiny font-medium text-amber-700 dark:text-amber-400">Multiple H1s</div>
                <div className="mt-1 text-xl font-extrabold text-amber-700 dark:text-amber-400">
                  {result.summary.pagesMultipleH1Count}
                </div>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-center dark:border-purple-900/40 dark:bg-purple-950/20">
                <div className="text-tiny font-medium text-purple-700 dark:text-purple-400">Skipped Levels</div>
                <div className="mt-1 text-xl font-extrabold text-purple-700 dark:text-purple-400">
                  {result.summary.pagesWithSkippedLevelsCount}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-tiny font-medium text-slate-500">Empty Headings</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                  {result.summary.emptyHeadingsCount}
                </div>
              </div>
            </div>

            {/* Action Bar & Export Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleDownloadXlsx}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-caption px-4 py-2 flex items-center gap-2 shadow-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Excel (.xlsx)
                </Button>

                {result.googleSheetUrl ? (
                  <a
                    href={result.googleSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-caption font-bold text-white shadow-md hover:bg-blue-700 transition"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                    Open Google Sheet ↗
                  </a>
                ) : result.googleSheetError ? (
                  <span className="text-tiny text-amber-700 dark:text-amber-400" title={result.googleSheetError}>
                    Google Sheet credentials required (XLSX downloaded above)
                  </span>
                ) : null}
              </div>

              <div className="text-caption text-slate-500 dark:text-slate-400">
                Duration: <span className="font-semibold text-slate-700 dark:text-slate-300">{(result.summary.durationMs / 1000).toFixed(1)}s</span> | Status: <span className="font-semibold text-slate-700 dark:text-slate-300">{result.summary.crawlCompleted ? "Full Crawl Completed" : "Partial (Limit Reached)"}</span>
              </div>
            </div>

            {/* Coverage Boundary Statement */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-caption text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Coverage Statement:</span> {result.summary.coverageStatement}
            </div>

            {/* Top Strategic Findings */}
            {result.summary.topFindings && result.summary.topFindings.length > 0 && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="text-caption font-bold text-amber-900 dark:text-amber-300 mb-2">
                  Key Strategic Observations & Optimization Guidance
                </div>
                <ul className="space-y-1.5 text-caption text-slate-700 dark:text-slate-300">
                  {result.summary.topFindings.map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-600 font-bold">•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterType("all")}
                  className={`rounded-lg px-2.5 py-1 text-caption font-medium transition ${
                    filterType === "all"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  All Pages ({result.pages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("issues")}
                  className={`rounded-lg px-2.5 py-1 text-caption font-medium transition ${
                    filterType === "issues"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  With Issues
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("missing-h1")}
                  className={`rounded-lg px-2.5 py-1 text-caption font-medium transition ${
                    filterType === "missing-h1"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  Missing H1 ({result.summary.pagesMissingH1Count})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("multi-h1")}
                  className={`rounded-lg px-2.5 py-1 text-caption font-medium transition ${
                    filterType === "multi-h1"
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  Multi H1 ({result.summary.pagesMultipleH1Count})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("skipped")}
                  className={`rounded-lg px-2.5 py-1 text-caption font-medium transition ${
                    filterType === "skipped"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  Skipped Levels ({result.summary.pagesWithSkippedLevelsCount})
                </button>
              </div>

              <input
                type="text"
                placeholder="Search page URL, keyword, headline..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-1 text-caption text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>

            {/* 6-Column The Nines Sheet Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-caption text-slate-500">
                <span>Displaying 6-column hierarchy structure matching The Nines reference template</span>
                <span>{filteredPages.length} pages listed</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-left text-caption">
                  <thead>
                    {/* Yellow Table Header Row (#FFE599) */}
                    <tr className="bg-[#FFE599] text-slate-900 font-bold border-b border-amber-300 text-center">
                      <th className="p-2.5 border-r border-amber-200 w-1/4">Page URL</th>
                      <th className="p-2.5 border-r border-amber-200 w-1/6">Keyword </th>
                      <th className="p-2.5 border-r border-amber-200 w-1/4">Old Headline</th>
                      <th className="p-2.5 border-r border-amber-200 w-24">Old Heading Level</th>
                      <th className="p-2.5 border-r border-amber-200 w-1/4">New Headline (optimized)</th>
                      <th className="p-2.5 w-24">New Heading Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPages.map((page, pIdx) => {
                      const isExpanded = expandedPageUrl === page.pageUrl;
                      return (
                        <tr key={pIdx} className="border-b border-slate-100 dark:border-slate-800">
                          <td colSpan={6} className="p-0">
                            {/* Category Banner (Blue #4A86E8) */}
                            <div className="bg-[#4A86E8] text-white px-4 py-2 font-bold text-body tracking-wide">
                              {pIdx + 1}. {page.subCategory.toUpperCase()} - {page.category}
                            </div>

                            {/* Page URL & Headings Table */}
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {page.headings.length === 0 ? (
                                <div className="grid grid-cols-6 p-2.5 bg-red-50/30 text-caption">
                                  <div className="truncate font-mono text-tiny text-blue-600 px-2" title={page.pageUrl}>
                                    <a href={page.pageUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                      {page.pageUrl}
                                    </a>
                                  </div>
                                  <div className="font-semibold text-slate-800 dark:text-slate-200 px-2">
                                    {page.targetKeyword}
                                  </div>
                                  <div className="italic text-slate-400 px-2">[No Headings Found]</div>
                                  <div className="text-center font-mono text-slate-400 px-2">NONE</div>
                                  <div className="bg-[#B6D7A8]/30 font-medium text-emerald-950 px-2">
                                    {page.targetKeyword} | Dressed To The Nines
                                  </div>
                                  <div className="bg-[#B6D7A8]/30 text-center font-bold text-emerald-900 px-2">H1</div>
                                </div>
                              ) : (
                                page.headings.map((h, hIdx) => {
                                  const hasIssues = h.issues.length > 0;
                                  return (
                                    <div
                                      key={hIdx}
                                      className={`grid grid-cols-6 items-center p-2 text-caption transition ${
                                        hasIssues
                                          ? "bg-amber-50/20 dark:bg-amber-950/10"
                                          : hIdx % 2 === 0
                                          ? "bg-white dark:bg-slate-900"
                                          : "bg-slate-50/50 dark:bg-slate-800/20"
                                      }`}
                                    >
                                      {/* Col A: Page URL (First row only) */}
                                      <div className="truncate font-mono text-tiny text-blue-600 dark:text-blue-400 px-2" title={page.pageUrl}>
                                        {hIdx === 0 ? (
                                          <a href={page.pageUrl} target="_blank" rel="noreferrer" className="hover:underline font-semibold">
                                            {page.pageUrl}
                                          </a>
                                        ) : (
                                          ""
                                        )}
                                      </div>

                                      {/* Col B: Keyword (First row only) */}
                                      <div className="font-semibold text-slate-800 dark:text-slate-200 px-2 truncate" title={page.targetKeyword}>
                                        {hIdx === 0 ? page.targetKeyword : ""}
                                      </div>

                                      {/* Col C: Old Headline */}
                                      <div className="px-2">
                                        <div className="font-medium text-slate-700 dark:text-slate-300 break-words">
                                          {h.originalText}
                                        </div>
                                        {hasIssues && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {h.issues.map((iss, iIdx) => (
                                              <span
                                                key={iIdx}
                                                className={`text-micro font-bold px-1.5 py-0.2 rounded ${
                                                  iss.type === "template-placeholder"
                                                    ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                                                    : iss.type === "skipped-level"
                                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                                }`}
                                              >
                                                {iss.label}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Col D: Old Heading Level */}
                                      <div className="text-center font-mono font-bold text-slate-600 dark:text-slate-400 px-2">
                                        {h.tag}
                                      </div>

                                      {/* Col E: New Headline (optimized) - Green #B6D7A8 */}
                                      <div className="bg-[#B6D7A8]/30 px-2 py-1 rounded text-emerald-950 dark:text-emerald-100 font-medium break-words">
                                        {h.optimizedText}
                                      </div>

                                      {/* Col F: New Heading Level - Green #B6D7A8 */}
                                      <div className="bg-[#B6D7A8]/30 text-center font-mono font-bold text-emerald-900 dark:text-emerald-300 px-2 py-1 rounded">
                                        {h.optimizedLevel}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
        <span className="text-caption text-slate-500">
          Hotel SEO Hierarchy Optimizer • The Nines Portland Parity
        </span>
        <Button variant="secondary" onClick={onClose} className="text-caption">
          Close
        </Button>
      </div>
    </div>
  );
}
