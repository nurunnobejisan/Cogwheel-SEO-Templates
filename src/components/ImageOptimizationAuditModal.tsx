"use client";

import { useState } from "react";
import { Button } from "./ui";
import type { ImageAuditItem, ImageAuditSummary, CrawlLogEntry } from "@/core/image-audit/types";

interface Props {
  defaultUrl?: string;
  onClose: () => void;
}

interface AuditApiResponse {
  success: boolean;
  summary: ImageAuditSummary;
  items: ImageAuditItem[];
  crawlLog: CrawlLogEntry[];
  filename: string;
  xlsxBase64: string;
  googleSheetUrl?: string | null;
  googleSheetError?: string | null;
  googleConfigured?: boolean;
  error?: string;
}

export function ImageOptimizationAuditModal({ defaultUrl = "", onClose }: Props) {
  const [urlInput, setUrlInput] = useState(defaultUrl || "https://arrivehotels.com");
  const [maxPages, setMaxPages] = useState(50);
  const [sizeThresholdKb, setSizeThresholdKb] = useState(100);
  const [delayMs, setDelayMs] = useState(100);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [saveToGoogleSheets, setSaveToGoogleSheets] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditApiResponse | null>(null);
  const [filterType, setFilterType] = useState<"all" | "missing-alt" | "oversized" | "broken" | "high-priority">("all");
  const [searchFilter, setSearchFilter] = useState("");

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
    setProgressMsg("Connecting to site & crawling pages for images...");

    try {
      const res = await fetch("/api/image-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target,
          maxPages,
          sizeThresholdKb,
          delayMs,
          includeSubdomains,
          saveToGoogleSheets,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Image optimization audit failed.");
      }

      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error running image audit.";
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
    link.download = result.filename || "image-optimization-audit.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items
  const filteredItems = (result?.items || []).filter((item) => {
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const match =
        item.imageUrl.toLowerCase().includes(q) ||
        (item.currentAlt && item.currentAlt.toLowerCase().includes(q)) ||
        item.proposedAlt.toLowerCase().includes(q) ||
        item.pageUrl.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterType === "missing-alt") {
      return item.issues.some((i) => i.code === "missing-alt" || i.code === "empty-alt-suspicious");
    }
    if (filterType === "oversized") {
      return item.issues.some((i) => i.code === "oversized-file");
    }
    if (filterType === "broken") {
      return item.isBroken || item.issues.some((i) => i.code === "broken-image");
    }
    if (filterType === "high-priority") {
      return item.priority === "High";
    }
    return true;
  });

  return (
    <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Website Image Optimization Audit
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit alt text, WebP/AVIF formats, dimensions, and generate formula-powered spreadsheets.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Input & Config Panel */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleRunAudit}
              disabled={loading || !urlInput.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Auditing Site...
                </span>
              ) : (
                "Start Image Audit"
              )}
            </Button>
          </div>

          {/* Advanced options row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
            <div>
              <label className="font-semibold text-slate-600 dark:text-slate-300">Max Pages</label>
              <input
                type="number"
                min="1"
                max="150"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600 dark:text-slate-300">Size Threshold (KB)</label>
              <input
                type="number"
                min="10"
                max="5000"
                value={sizeThresholdKb}
                onChange={(e) => setSizeThresholdKb(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600 dark:text-slate-300">Delay (ms)</label>
              <input
                type="number"
                min="0"
                max="1000"
                step="50"
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <div className="flex flex-col justify-end space-y-1.5 pb-0.5">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSubdomains}
                  onChange={(e) => setIncludeSubdomains(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Subdomains</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToGoogleSheets}
                  onChange={(e) => setSaveToGoogleSheets(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Google Sheets</span>
              </label>
            </div>
          </div>
        </div>

        {/* Loading status */}
        {loading && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
              {progressMsg || "Crawling website pages and extracting media attributes..."}
            </div>
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Inspecting &lt;img&gt;, &lt;picture&gt;, CSS background images, srcset variants, and image headers.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {/* Audit Results */}
        {result && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pages Scanned</div>
                <div className="mt-1 text-2xl font-black text-slate-800 dark:text-white">
                  {result.summary.pagesScanned}
                </div>
                <div className="text-[10px] text-slate-500">{result.summary.pagesFailed} failed / {result.summary.durationMs}ms</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Images</div>
                <div className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">
                  {result.summary.totalImagesFound}
                </div>
                <div className="text-[10px] text-slate-500">{result.summary.uniqueImagesCount} unique assets</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Missing Alt</div>
                <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                  {result.summary.missingAltCount}
                </div>
                <div className="text-[10px] text-slate-500">{result.summary.decorativeEmptyAltCount} decorative (alt=&quot;&quot;)</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Oversized (&gt;{sizeThresholdKb}K)</div>
                <div className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
                  {result.summary.oversizedImagesCount}
                </div>
                <div className="text-[10px] text-slate-500">Exceeds threshold</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Legacy Format</div>
                <div className="mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {result.summary.legacyFormatCount}
                </div>
                <div className="text-[10px] text-slate-500">PNG/JPG (non-WebP)</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Broken Images</div>
                <div className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">
                  {result.summary.brokenImagesCount}
                </div>
                <div className="text-[10px] text-slate-500">4xx / 5xx responses</div>
              </div>
            </div>

            {/* Actions Bar: Download XLSX and Google Sheets */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Audit Spreadsheet Ready (5 Tabs)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Includes <strong>Image Optimization</strong> (with =IMAGE and =LEN formulas), <strong>Overview</strong>, <strong>Image Inventory</strong>, <strong>Recommendations</strong>, and <strong>Crawl Log</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadXlsx}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download .XLSX Workbook
                </button>

                {result.googleSheetUrl ? (
                  <a
                    href={result.googleSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                    Open Google Sheet ↗
                  </a>
                ) : result.googleSheetError ? (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400" title={result.googleSheetError}>
                    Google Sheet setup required (XLSX downloaded above)
                  </span>
                ) : null}
              </div>
            </div>

            {/* Note on WCAG Decorative Images */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Accessibility Note:</span> Empty alt text (<code>alt=&quot;&quot;</code>) is completely valid and recommended by WCAG for purely decorative images, backgrounds, and icons that don&apos;t convey content. Not every empty alt attribute is a defect.
            </div>

            {/* Filter and Table of Audited Images */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      filterType === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    All ({result.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("missing-alt")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      filterType === "missing-alt"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Missing Alt ({result.summary.missingAltCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("oversized")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      filterType === "oversized"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Oversized ({result.summary.oversizedImagesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("high-priority")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      filterType === "high-priority"
                        ? "bg-purple-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    High Priority
                  </button>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search by URL or alt text..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
                    <tr>
                      <th className="p-3">Preview</th>
                      <th className="p-3">Image &amp; Page</th>
                      <th className="p-3">Current Alt</th>
                      <th className="p-3">Proposed Alt</th>
                      <th className="p-3">Format / Size</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Action / Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.slice(0, 50).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.currentAlt || "thumbnail"}
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        </td>
                        <td className="p-3 max-w-xs truncate">
                          <a
                            href={item.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400 truncate block"
                            title={item.imageUrl}
                          >
                            {item.imageUrl.split("/").pop() || item.imageUrl}
                          </a>
                          <a
                            href={item.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-slate-400 hover:underline truncate block"
                            title={item.pageUrl}
                          >
                            Page: {item.pageTitle || new URL(item.pageUrl).pathname}
                          </a>
                        </td>
                        <td className="p-3 max-w-[180px]">
                          {item.currentAlt ? (
                            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                              &quot;{item.currentAlt}&quot;
                            </span>
                          ) : item.isDecorative ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              alt=&quot;&quot; (Decorative)
                            </span>
                          ) : (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-400">
                              Missing Alt
                            </span>
                          )}
                        </td>
                        <td className="p-3 max-w-[200px]">
                          <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                            &quot;{item.proposedAlt}&quot;
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {item.format}
                          </span>
                          <span className="ml-1 text-[10px] text-slate-400">
                            {item.fileSizeKb ? `${item.fileSizeKb} KB` : "-"}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.priority === "High"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                                : item.priority === "Medium"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                : item.priority === "Low"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            }`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs text-[11px] text-slate-600 dark:text-slate-400">
                          {item.recommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredItems.length > 50 && (
                <p className="text-center text-xs text-slate-400">
                  Showing first 50 of {filteredItems.length} items. All records are included in the downloadable spreadsheet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
        <span className="text-xs text-slate-400">
          Excel format matches reference workbook with =IMAGE and =LEN formulas.
        </span>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
