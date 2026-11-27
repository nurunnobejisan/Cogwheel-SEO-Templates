import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Play,
  Download,
  Copy,
  Check,
  Clock,
  Sparkles,
  Link as LinkIcon,
  Upload,
  ArrowUpDown,
  FileSpreadsheet,
  FileCode,
  Search,
  Filter,
} from "lucide-react";
import { PageAuditData, ClientProfile } from "../types/extension";
import { buildUnifiedPacket, collectPacketSources } from "../engine/unified-packet";
import {
  BATCH_AUDIT_CONCURRENCY,
  gradeForOverall,
  runFullAudit,
  runWithConcurrency,
  type BatchAuditMeasurement,
  type BatchGrade,
} from "../engine/full-audit-client";

interface Props {
  pageData?: PageAuditData;
  activeProfile?: ClientProfile;
}

export interface BatchAuditItem {
  id: string;
  propertyName: string;
  url: string;
  status: "pending" | "running" | "done" | "error" | "cancelled";
  /** null = not measured. Scores only exist after a successful /api/full-audit run. */
  overallHealth: number | null;
  onPageScore: number | null;
  schemaScore: number | null;
  geoScore: number | null;
  h1: string;
  wordCount: number | null;
  schemasFound: number | null;
  grade: BatchGrade | null;
  /** Why a row has no numbers (shown instead of a score). */
  unavailableReason?: string;
}

type SortField = "overallHealth" | "onPageScore" | "schemaScore" | "geoScore" | "propertyName";
type SortDirection = "asc" | "desc";

/** Badge tone per grade — single source so colour always matches the label. */
const GRADE_TONE: Record<BatchGrade, string> = {
  "A+ OPTIMAL": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
  "A STRONG": "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300",
  "B NEEDS AUDIT": "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
  "C CRITICAL": "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300",
};

export function AutomationBulkRunner({ pageData, activeProfile }: Props) {
  // Workflow Unified Packet State
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [unifiedPacket, setUnifiedPacket] = useState<string | null>(null);
  const [copiedPacket, setCopiedPacket] = useState(false);

  // Batch URLs State
  const [urlsInput, setUrlsInput] = useState(
    `https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/\nhttps://www.hilton.com/en/hotels/bosdnt-canopy-boston-downtown/\nhttps://coachmanhotel.com/\nhttps://www.hyatt.com/en-US/hotel/california/hyatt-regency-san-francisco/sfors\nhttps://www.ihg.com/kimptonhotels/hotels/us/en/the-rowan-palm-springs-ca/pspkr/hoteldetail`
  );
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchAuditItem[]>([]);
  const [sortField, setSortField] = useState<SortField>("overallHealth");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterQuery, setFilterQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1-Click Multi-Template "Auto-Generate All" Workflow
  const handleRunFullWorkflow = () => {
    setWorkflowRunning(true);

    setTimeout(() => {
      // Template defaults overlaid with profile/page-sourced values only —
      // no invented copy (see engine/unified-packet.ts).
      setUnifiedPacket(
        buildUnifiedPacket(
          collectPacketSources(activeProfile, pageData),
          new Date().toLocaleDateString()
        )
      );
      setWorkflowRunning(false);
    }, 600);
  };

  const handleCopyPacket = () => {
    if (!unifiedPacket) return;
    navigator.clipboard.writeText(unifiedPacket).then(() => {
      setCopiedPacket(true);
      setTimeout(() => setCopiedPacket(false), 2000);
    });
  };

  const handleDownloadPacket = () => {
    if (!unifiedPacket) return;
    const blob = new Blob([unifiedPacket], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(pageData?.hostname || "hotel").replace(/\./g, "_")}_SEO Studio_Deliverable_Packet.md`;
    a.click();
  };

  // Auto-Extract Internal Links from Active Page
  const handleAutoExtractLinks = () => {
    if (pageData?.internalUrls && pageData.internalUrls.length > 0) {
      setUrlsInput(pageData.internalUrls.join("\n"));
    } else {
      alert("No internal links found on current page.");
    }
  };

  // CSV File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const parsedUrls: string[] = [];

      lines.forEach((line, idx) => {
        // Skip header if looks like header
        if (idx === 0 && (line.toLowerCase().includes("url") || line.toLowerCase().includes("link"))) {
          return;
        }
        // Extract URL from CSV line (e.g. "Hotel Name,https://...")
        const parts = line.split(",").map((p) => p.replace(/^["']|["']$/g, "").trim());
        const foundUrl = parts.find((p) => p.startsWith("http://") || p.startsWith("https://"));
        if (foundUrl) {
          parsedUrls.push(foundUrl);
        } else if (parts[0] && parts[0].includes(".")) {
          parsedUrls.push(parts[0].startsWith("http") ? parts[0] : `https://${parts[0]}`);
        }
      });

      if (parsedUrls.length > 0) {
        setUrlsInput(parsedUrls.join("\n"));
      } else {
        alert("No valid URLs found in the uploaded CSV file.");
      }
    };
    reader.readAsText(file);
  };

  // Helper to extract property name from URL
  const getPropertyNameFromUrl = (url: string, index: number): string => {
    try {
      const parsed = new URL(url);
      const pathSegments = parsed.pathname.split("/").filter(Boolean);
      if (pathSegments.length > 0) {
        const last = pathSegments[pathSegments.length - 1];
        return last
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .slice(0, 32);
      }
      return parsed.hostname.replace(/^www\./, "").replace(/\..+$/, "") + ` Hotel #${index + 1}`;
    } catch {
      return `Property #${index + 1}`;
    }
  };

  // Automated Batch URL Crawler & Scorer — real `/api/full-audit` runs, three
  // at a time. No score is produced locally: a failed or cancelled audit stays
  // blank and is labelled "unavailable" with the reason.
  const batchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => batchAbortRef.current?.abort(), []);

  const applyMeasurement = (item: BatchAuditItem, m: BatchAuditMeasurement): BatchAuditItem => ({
    ...item,
    status: "done",
    overallHealth: m.overall,
    onPageScore: m.onPage,
    schemaScore: m.schema,
    geoScore: m.geo,
    h1: m.h1,
    wordCount: m.wordCount,
    schemasFound: m.schemasFound,
    grade: gradeForOverall(m.overall),
  });

  const handleStopBatch = () => {
    batchAbortRef.current?.abort();
  };

  const handleStartBatch = async () => {
    const urls = urlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0 || isBatchRunning) return;

    const controller = new AbortController();
    batchAbortRef.current = controller;

    setIsBatchRunning(true);
    setProgress(0);

    const items: BatchAuditItem[] = urls.map((u, i) => ({
      id: `prop-${i + 1}`,
      propertyName: getPropertyNameFromUrl(u, i),
      url: u,
      status: "pending",
      overallHealth: null,
      onPageScore: null,
      schemaScore: null,
      geoScore: null,
      h1: "",
      wordCount: null,
      schemasFound: null,
      grade: null,
    }));

    setBatchResults(items);

    let completed = 0;
    await runWithConcurrency(urls, BATCH_AUDIT_CONCURRENCY, async (url, index) => {
      if (controller.signal.aborted) return;

      setBatchResults((prev) => prev.map((it, i) => (i === index ? { ...it, status: "running" as const } : it)));

      const outcome = await runFullAudit(url, { signal: controller.signal });
      completed++;
      setProgress(Math.round((completed / urls.length) * 100));

      setBatchResults((prev) =>
        prev.map((it, i) => {
          if (i !== index) return it;
          if (outcome.ok) return applyMeasurement(it, outcome.measurement);
          return {
            ...it,
            status: controller.signal.aborted ? ("cancelled" as const) : ("error" as const),
            unavailableReason: outcome.reason,
          };
        }),
      );
    });

    // Anything still queued after a stop is cancelled, not "queued forever".
    if (controller.signal.aborted) {
      setBatchResults((prev) =>
        prev.map((it) =>
          it.status === "pending" || it.status === "running"
            ? {
                ...it,
                status: "cancelled" as const,
                unavailableReason: "Cancelled before the audit finished",
              }
            : it,
        ),
      );
    }

    batchAbortRef.current = null;
    setIsBatchRunning(false);
  };

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedResults = useMemo(() => {
    return batchResults
      .filter((item) => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
          item.propertyName.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q) ||
          (item.grade ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (typeof valA === "string" || typeof valB === "string") {
          const strA = String(valA ?? "");
          const strB = String(valB ?? "");
          return sortDirection === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }

        // Unmeasured rows sort last in both directions — a blank never beats a real score.
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        return sortDirection === "asc" ? valA - valB : valB - valA;
      });
  }, [batchResults, sortField, sortDirection, filterQuery]);

  // Export CSV for Monthly Visibility Decks
  const handleExportCsv = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const headers = [
      "Property Name",
      "Target URL",
      "Overall Health Score",
      "On-Page Structure",
      "Schema & Tech",
      "GEO AI Readiness",
      "Grade",
      "Schemas Detected",
      "Word Count",
      "Score Status",
      "Audit Date",
    ];

    // Unmeasured cells stay empty — a blank is honest, a 0 would be a claim.
    const rows = batchResults.map((r) => {
      const scoreStatus =
        r.status === "done"
          ? "measured"
          : r.status === "error"
          ? `unavailable: ${r.unavailableReason || "audit failed"}`
          : r.status === "cancelled"
          ? "cancelled - not audited"
          : "not run";
      return [
        `"${r.propertyName.replace(/"/g, '""')}"`,
        `"${r.url.replace(/"/g, '""')}"`,
        r.overallHealth ?? "",
        r.onPageScore ?? "",
        r.schemaScore ?? "",
        r.geoScore ?? "",
        r.grade ? `"${r.grade}"` : "",
        r.schemasFound ?? "",
        r.wordCount ?? "",
        `"${scoreStatus.replace(/"/g, '""')}"`,
        timestamp,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SEO_Studio_Monthly_Visibility_Audit_${timestamp}.csv`;
    a.click();
  };

  // Export JSON for Monthly Visibility Decks
  const handleExportJson = () => {
    const timestamp = new Date().toISOString();
    const measured = batchResults.filter((r) => typeof r.overallHealth === "number");
    const payload = {
      report: "SEO Studio Monthly Visibility Deck Audit",
      timestamp,
      totalProperties: batchResults.length,
      measuredProperties: measured.length,
      unavailableProperties: batchResults.length - measured.length,
      // null when nothing was measured: an average of no scores is not 0.
      averageOverallScore:
        measured.length > 0
          ? Math.round(
              measured.reduce((acc, curr) => acc + (curr.overallHealth as number), 0) / measured.length
            )
          : null,
      properties: batchResults,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SEO_Studio_Visibility_Deck_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  /** One score cell: a measured number, or an explicit "n/a"/blank. Never a fallback figure. */
  const scoreCell = (item: BatchAuditItem, value: number | null, suffix = "") => {
    if (item.status === "done" && value !== null) return `${value}${suffix}`;
    if (item.status === "error") {
      return (
        <span
          className="text-[10px] font-bold text-rose-500 dark:text-rose-400"
          title={item.unavailableReason}
        >
          n/a
        </span>
      );
    }
    if (item.status === "running") return <span className="text-[10px] text-sky-500">…</span>;
    return <span className="text-[10px] text-slate-400">-</span>;
  };

  return (
    <div className="space-y-4">
      {/* 1. BATCH AUDIT RUNNER SUITE */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              MULTI-PROPERTY QUALITY GATE CRAWLER
            </span>
            <h3 className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Automated Hospitality Portfolio Audits
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Hidden CSV File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,text/csv"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>Upload CSV</span>
            </button>

            <button
              type="button"
              onClick={handleAutoExtractLinks}
              title="Auto-fill with internal links discovered on current page"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <LinkIcon className="h-3.5 w-3.5 text-emerald-500" />
              <span>Extract Page Links</span>
            </button>
          </div>
        </div>

        {/* URLs Textarea */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            ENTER TARGET HOTEL URLS (ONE PER LINE OR UPLOAD CSV):
          </label>
          <textarea
            rows={4}
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            disabled={isBatchRunning}
            placeholder="https://www.marriott.com/hotel-a&#10;https://www.hilton.com/hotel-b"
            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-[11px] text-slate-800 shadow-xs focus:border-brand focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          />

          <div className="flex flex-col gap-1.5 sm:flex-row">
            <button
              type="button"
              onClick={handleStartBatch}
              disabled={isBatchRunning}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light disabled:opacity-50"
            >
              {isBatchRunning ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>
                {isBatchRunning
                  ? `Auditing Properties (${progress}% Complete)...`
                  : "Run Automated SEO + GEO Batch Audits"}
              </span>
            </button>

            {isBatchRunning && (
              <button
                type="button"
                onClick={handleStopBatch}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span>Stop</span>
              </button>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            Each row is audited live against the SEO Studio rules engine (3 at a time). Rows that
            fail or are stopped show <span className="font-bold">unavailable</span> — no score is
            estimated locally.
          </p>
        </div>

        {/* Progress Bar */}
        {isBatchRunning && (
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Sortable Table & Export Controls */}
        {batchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  AUDITED PROPERTIES ({filteredAndSortedResults.length}/{batchResults.length})
                </span>
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 h-3 w-3 text-slate-400" />
                  <input
                    type="search"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filter properties..."
                    className="h-6 w-32 rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-[10px] text-slate-800 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Sortable Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th
                      className="cursor-pointer px-3 py-2"
                      onClick={() => handleSort("propertyName")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Property / Target URL</span>
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="cursor-pointer px-2.5 py-2 text-right"
                      onClick={() => handleSort("overallHealth")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Overall</span>
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="cursor-pointer px-2.5 py-2 text-right hidden sm:table-cell"
                      onClick={() => handleSort("onPageScore")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>On-Page</span>
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="cursor-pointer px-2.5 py-2 text-right hidden sm:table-cell"
                      onClick={() => handleSort("schemaScore")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Schema</span>
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="cursor-pointer px-2.5 py-2 text-right hidden sm:table-cell"
                      onClick={() => handleSort("geoScore")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>GEO AI</span>
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {filteredAndSortedResults.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50/50 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-3 py-2 max-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {item.propertyName}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate">
                          {item.url}
                        </div>
                      </td>

                      <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums">
                        {item.status === "done" && item.overallHealth !== null ? (
                          <span className="text-slate-900 dark:text-white tabular-nums">
                            {item.overallHealth}/100
                          </span>
                        ) : item.status === "running" ? (
                          <span className="text-[10px] text-sky-500">Scanning...</span>
                        ) : item.status === "error" ? (
                          <span
                            className="text-[10px] font-bold text-rose-500 dark:text-rose-400"
                            title={item.unavailableReason}
                          >
                            unavailable
                          </span>
                        ) : item.status === "cancelled" ? (
                          <span className="text-[10px] text-slate-400">cancelled</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Queued</span>
                        )}
                      </td>

                      <td className="px-2.5 py-2 text-right font-mono text-slate-600 dark:text-slate-400 hidden sm:table-cell tabular-nums">
                        {scoreCell(item, item.onPageScore, "%")}
                      </td>

                      <td className="px-2.5 py-2 text-right font-mono text-slate-600 dark:text-slate-400 hidden sm:table-cell tabular-nums">
                        {scoreCell(item, item.schemaScore, "%")}
                      </td>

                      <td
                        className="px-2.5 py-2 text-right font-mono text-slate-600 dark:text-slate-400 hidden sm:table-cell tabular-nums"
                        title="GEO readiness is an on-page heuristic estimate from the audit report — not an AI-engine measurement."
                      >
                        {scoreCell(item, item.geoScore, "%")}
                      </td>

                      <td className="px-3 py-2 text-center">
                        {item.status === "done" && item.grade ? (
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${GRADE_TONE[item.grade]}`}
                          >
                            {item.grade}
                          </span>
                        ) : item.status === "error" ? (
                          <span
                            className="text-[10px] font-bold text-rose-500 dark:text-rose-400"
                            title={item.unavailableReason}
                          >
                            n/a
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 2. 1-CLICK MULTI-TEMPLATE PRODUCTION DELIVERABLE WORKFLOW */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1-CLICK AUTO-GENERATE WORKFLOW
            </span>
          </div>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            5 Deliverables
          </span>
        </div>

        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Executes Title/Meta + H1 Headline + Hotel Schema + FAQ Page + GEO/AI Citation copy in one click, pre-filling all active page attributes and brand profile variables.
        </p>

        <button
          type="button"
          onClick={handleRunFullWorkflow}
          disabled={workflowRunning}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light disabled:opacity-50"
        >
          {workflowRunning ? (
            <Clock className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span>{workflowRunning ? "Compiling Deliverables..." : "Run Full SEO Studio Workflow on This Page"}</span>
        </button>

        {/* Unified Deliverable Packet Preview */}
        {unifiedPacket && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-950 p-3 shadow-inner dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[10px] font-bold text-emerald-400 uppercase">
                UNIFIED DELIVERABLE PACKET READY
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPacket}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700"
                >
                  {copiedPacket ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedPacket ? "Copied" : "Copy All"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPacket}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700"
                >
                  <Download className="h-3 w-3" />
                  Save .MD
                </button>
              </div>
            </div>

            <pre className="mt-2 max-h-56 overflow-y-auto text-[10px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap">
              {unifiedPacket}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
