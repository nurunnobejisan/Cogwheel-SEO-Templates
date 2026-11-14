"use client";

import { useState } from "react";
import { downloadBlobWithCountdown } from "@/lib/download-manager";
import { GenerationProgressModal } from "./GenerationProgressModal";
import { Card } from "./ui";

interface ReportSummary {
  property_name: string;
  slide_count: number;
  is_brand_hosted: boolean;
  pdf_included: boolean;
  tracked_count: number;
  ancillary_count: number;
  top10_count: number;
  rank_buckets: {
    top3: number;
    pos4_10: number;
    pos11_20: number;
    pos21_40: number;
  };
  tracked_preview?: Array<{ keyword: string; start: string; current: string; delta: string }>;
  ancillary_preview?: Array<{ keyword: string; rank: string; volume: string }>;
}

interface CrawlPreview {
  target_url: string;
  page_title: string;
  crawled_pages: number;
  sitemap_urls: number;
  website_services: string[];
  matched_services: string[];
  unmatched_services: string[];
}

interface Props {
  defaultProperty?: { name?: string; url?: string };
  onClose: () => void;
  onCompleted: () => void;
}

const MAX_CLIENT_XLSX_BYTES = 4 * 1024 * 1024;

async function slimWorkbookIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_CLIENT_XLSX_BYTES) return file;
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return file;
  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const trimmed = rows.slice(0, 600);
  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.aoa_to_sheet(trimmed);
  XLSX.utils.book_append_sheet(outWb, outWs, firstSheetName);
  const outBuf = XLSX.write(outWb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([outBuf], file.name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function SeoVisibilityReportModal({ defaultProperty, onClose, onCompleted }: Props) {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [targetUrl, setTargetUrl] = useState(defaultProperty?.url || "");
  const [vanityMode, setVanityMode] = useState<"auto" | "vanity" | "brand">("auto");
  const [dragOverZone, setDragOverZone] = useState<"template" | "xlsx" | "pdf" | null>(null);
  const [busy, setBusy] = useState(false);
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawlInfo, setCrawlInfo] = useState<CrawlPreview | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [flags, setFlags] = useState<Array<{ code: string; message: string; severity: string }>>([]);

  useEffect(() => {
    if (defaultProperty?.url && !targetUrl) {
      setTargetUrl(defaultProperty.url);
    }
  }, [defaultProperty?.url, targetUrl]);

  function handleDrop(e: React.DragEvent, zone: "template" | "xlsx" | "pdf") {
    e.preventDefault();
    setDragOverZone(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (zone === "template" && file.name.toLowerCase().endsWith(".pptx")) {
      setTemplateFile(file);
    } else if (zone === "xlsx" && (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls"))) {
      setXlsxFile(file);
    } else if (zone === "pdf" && file.name.toLowerCase().endsWith(".pdf")) {
      setPdfFile(file);
    }
  }

  async function handleInspectWebsite() {
    setError(null);
    setCrawlBusy(true);
    try {
      const form = new FormData();
      if (targetUrl.trim()) form.append("target_url", targetUrl.trim());
      if (xlsxFile) {
        const prepared = await slimWorkbookIfNeeded(xlsxFile);
        form.append("xlsx", prepared);
      }
      const res = await fetch("/api/seo-visibility-report?action=crawl", {
        method: "POST",
        body: form,
      });
      if (res.status === 404) {
        throw new Error(
          "Website inspection (/api/seo-visibility-report) runs on Vercel Python runtime or `vercel dev`.",
        );
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Website inspection failed.");
      setCrawlInfo(json as CrawlPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Website inspection failed.");
    } finally {
      setCrawlBusy(false);
    }
  }

  async function handleGenerate() {
    if (!templateFile || !xlsxFile) {
      setError("Please upload both a .pptx PowerPoint template and a .xlsx keywords workbook.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const preparedXlsx = await slimWorkbookIfNeeded(xlsxFile);
      const form = new FormData();
      form.append("template", templateFile);
      form.append("xlsx", preparedXlsx);
      if (pdfFile) form.append("pdf", pdfFile);
      if (targetUrl.trim()) form.append("target_url", targetUrl.trim());
      if (vanityMode === "vanity") form.append("has_vanity_site", "true");
      if (vanityMode === "brand") form.append("has_vanity_site", "false");

      const res = await fetch("/api/seo-visibility-report", {
        method: "POST",
        body: form,
      });

      if (res.status === 404) {
        throw new Error(
          "PPTX report builder (/api/seo-visibility-report) runs on Vercel Python runtime or `vercel dev`.",
        );
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Report generation failed (${res.status}).`);
      }

      const summaryHeader = res.headers.get("X-Report-Summary");
      let parsedSummary: ReportSummary | null = null;
      if (summaryHeader) {
        parsedSummary = JSON.parse(atob(summaryHeader)) as ReportSummary;
        setSummary(parsedSummary);
      }

      const disposition = res.headers.get("Content-Disposition") || "";
      const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const downloadName = nameMatch?.[1] || "seo_visibility_report.pptx";

      const blob = await res.blob();
      downloadBlobWithCountdown(blob, downloadName);

      if (parsedSummary) {
        const taskRes = await fetch("/api/tasks/seo-only-visibility-report/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl: targetUrl.trim(),
            hasVanitySite: vanityMode === "vanity" ? true : vanityMode === "brand" ? false : undefined,
            templateFileName: templateFile.name,
            xlsxFileName: xlsxFile.name,
            pdfFileName: pdfFile?.name,
            downloadName,
            summary: parsedSummary,
          }),
        });
        if (taskRes.ok) {
          const taskJson = await taskRes.json();
          setNarrative(taskJson.data?.executiveSummary ?? taskJson.output?.executiveSummary ?? null);
          setFlags(taskJson.flags ?? []);
          onCompleted();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="animate-fade-in mb-6 border-slate-200/90 bg-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Upload Source Files
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            SEO Only Visibility Report (Monthly) — upload your template and Semrush exports to build your client deck.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          Close
        </button>
      </div>

      {/* 3-Column Step Upload Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* STEP 01 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("template");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, "template")}
          className={`group relative flex flex-col justify-between rounded-2xl border-2 border-dashed p-5 transition-all ${
            dragOverZone === "template"
              ? "border-brand bg-brand-50/50 ring-4 ring-brand/20"
              : templateFile
              ? "border-brand/80 bg-brand-50/30"
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
          }`}
        >
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pptx"
              className="sr-only"
              onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                STEP 01
              </span>
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
                Required
              </span>
            </div>

            <div className="my-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 transition-transform group-hover:scale-105">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M4.5 4.5v10.5a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V4.5M9 20.25l3-3.75 3 3.75" />
                </svg>
              </div>
              <div className="font-display text-sm font-bold text-slate-900">PowerPoint Template</div>
              <div className="mt-0.5 text-xs text-slate-500 truncate max-w-[200px]" title={templateFile ? templateFile.name : "Master slide deck"}>
                {templateFile ? templateFile.name : "Master slide deck or drag .pptx here"}
              </div>
            </div>
          </label>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
              .pptx
            </span>
            {templateFile ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{Math.round(templateFile.size / 1024)} KB</span>
                <button
                  type="button"
                  onClick={() => setTemplateFile(null)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  title="Clear template"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="font-semibold text-slate-800 group-hover:text-slate-950">Browse ↗</span>
            )}
          </div>
        </div>

        {/* STEP 02 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("xlsx");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, "xlsx")}
          className={`group relative flex flex-col justify-between rounded-2xl border-2 border-dashed p-5 transition-all ${
            dragOverZone === "xlsx"
              ? "border-brand bg-brand-50/50 ring-4 ring-brand/20"
              : xlsxFile
              ? "border-brand/80 bg-brand-50/30"
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
          }`}
        >
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                STEP 02
              </span>
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
                Required
              </span>
            </div>

            <div className="my-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="font-display text-sm font-bold text-slate-900">Keywords Workbook</div>
              <div className="mt-0.5 text-xs text-slate-500 truncate max-w-[200px]" title={xlsxFile ? xlsxFile.name : "Excel export"}>
                {xlsxFile ? xlsxFile.name : "Excel export or drag .xlsx here"}
              </div>
            </div>
          </label>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
              .xlsx
            </span>
            {xlsxFile ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{Math.round(xlsxFile.size / 1024)} KB</span>
                <button
                  type="button"
                  onClick={() => setXlsxFile(null)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  title="Clear workbook"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="font-semibold text-slate-800 group-hover:text-slate-950">Browse ↗</span>
            )}
          </div>
        </div>

        {/* STEP 03 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("pdf");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, "pdf")}
          className={`group relative flex flex-col justify-between rounded-2xl border-2 border-dashed p-5 transition-all ${
            dragOverZone === "pdf"
              ? "border-brand bg-brand-50/50 ring-4 ring-brand/20"
              : pdfFile
              ? "border-brand/80 bg-brand-50/30"
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
          }`}
        >
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                STEP 03
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                Optional
              </span>
            </div>

            <div className="my-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-105">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="font-display text-sm font-bold text-slate-900">Semrush Audit PDF</div>
              <div className="mt-0.5 text-xs text-slate-500 truncate max-w-[200px]" title={pdfFile ? pdfFile.name : "Optional PDF report"}>
                {pdfFile ? pdfFile.name : "Optional PDF or drag .pdf here"}
              </div>
            </div>
          </label>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
              .pdf
            </span>
            {pdfFile ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{Math.round(pdfFile.size / 1024)} KB</span>
                <button
                  type="button"
                  onClick={() => setPdfFile(null)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  title="Clear PDF"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="font-semibold text-slate-800 group-hover:text-slate-950">Browse ↗</span>
            )}
          </div>
        </div>
      </div>

      {/* STEP 04: Target Website Crawl & Service Match */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              STEP 04
            </span>
            <h4 className="font-display text-sm font-bold text-slate-900">
              Target Website Crawl &amp; Service Match
            </h4>
          </div>
          <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-0.5 text-[11px] font-semibold text-purple-700">
            Service Verification
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          Enter the target property website URL to crawl its offerings and match services against your Keywords Workbook. Unmatched services are automatically excluded from the Ancillary Keyword Position Summary.
        </p>
        <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleInspectWebsite();
              }
            }}
            placeholder="https://www.marriott.com/en-us/hotels/... or https://www.propertywebsite.com"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
          <button
            type="button"
            onClick={handleInspectWebsite}
            disabled={crawlBusy || (!targetUrl.trim() && !xlsxFile)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold font-display text-slate-800 shadow-sm transition hover:border-brand hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 010 18M12 3a14.5 14.5 0 000 18" />
            </svg>
            {crawlBusy ? "Crawling Website..." : "Crawl & Match Workbook"}
          </button>
        </div>

        {/* Matched Services Result Card matching reference design */}
        {crawlInfo && (
          <div className="mt-4 rounded-xl border border-slate-200/90 bg-white p-4 text-xs space-y-2.5 shadow-sm animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-800 truncate max-w-xl" title={crawlInfo.target_url || crawlInfo.page_title}>
                Target: {crawlInfo.target_url || crawlInfo.page_title}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {crawlInfo.crawled_pages > 0
                  ? `${crawlInfo.crawled_pages} page(s) crawled${crawlInfo.sitemap_urls ? ` • ${crawlInfo.sitemap_urls} sitemap URLs scanned` : ""}`
                  : "URL & Workbook profile analyzed"}
              </span>
            </div>
            <div>
              <span className="font-semibold text-emerald-700 block mb-1">
                Matched Services (Included in Ancillary Keyword Position Summary):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {crawlInfo.matched_services && crawlInfo.matched_services.length > 0 ? (
                  crawlInfo.matched_services.map((s, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700 text-[11px]"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">No hospitality-specific services detected on this website</span>
                )}
              </div>
            </div>
            {crawlInfo.page_topics && crawlInfo.page_topics.length > 0 && (
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Detected Website Topics &amp; Headings:</span>
                <div className="flex flex-wrap gap-1.5">
                  {crawlInfo.page_topics.map((t, idx) => (
                    <span key={idx} className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700 text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {crawlInfo.unmatched_services && crawlInfo.unmatched_services.length > 0 && (
              <div>
                <span className="font-semibold text-rose-600 block mb-1">
                  Excluded Unmatched Services (Removed from Ancillary Keyword Position Summary):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {crawlInfo.unmatched_services.map((s, idx) => (
                    <span key={idx} className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-medium text-rose-600 text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="text-[11px] text-slate-500">
            Slide 5 (SEO Errors) applies to independents &amp; soft brands with a vanity site:
          </span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
            {(
              [
                ["auto", "Auto-Detect"],
                ["vanity", "Has Vanity Site (Keep Slide 5)"],
                ["brand", "Brand-Hosted Only (Omit Slide 5)"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setVanityMode(mode)}
                className={`rounded-lg px-2.5 py-1 transition ${
                  vanityMode === mode
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Dark Bottom Action Bar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-950 p-4 text-white">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy || !templateFile || !xlsxFile}
          className="inline-flex items-center gap-2.5 rounded-xl bg-brand px-5 py-3 font-display text-sm font-bold text-slate-950 shadow-glow transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          {busy ? "Generating Deck..." : "Generate & Download Deck"}
        </button>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
            <span className={`h-1.5 w-1.5 rounded-full ${templateFile ? "bg-brand" : "bg-slate-500"}`} />
            Template Required
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
            <span className={`h-1.5 w-1.5 rounded-full ${xlsxFile ? "bg-brand" : "bg-slate-500"}`} />
            Workbook Required
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
            <span className={`h-1.5 w-1.5 rounded-full ${pdfFile ? "bg-brand" : "bg-slate-500"}`} />
            PDF Optional
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
            <span className={`h-1.5 w-1.5 rounded-full ${crawlInfo || targetUrl.trim() ? "bg-brand" : "bg-slate-500"}`} />
            Crawl Optional
          </span>
        </div>
      </div>

      {summary && (
        <div className="mt-4 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-slate-800">
          <div className="font-semibold text-emerald-900">
            Report Generated: {summary.property_name} ({summary.slide_count} slides,{" "}
            {summary.is_brand_hosted ? "Brand-Hosted" : "Standalone"})
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>Tracked KWs: {summary.tracked_count}</div>
            <div>Ancillary KWs: {summary.ancillary_count}</div>
            <div>Top 10 Total: {summary.top10_count}</div>
            <div>
              Top 3 / 4-10 / 11-20: {summary.rank_buckets.top3} / {summary.rank_buckets.pos4_10} /{" "}
              {summary.rank_buckets.pos11_20}
            </div>
          </div>
          {narrative && <p className="text-slate-700">{narrative}</p>}
          {flags.length > 0 && (
            <div className="text-amber-800">
              Flags: {flags.map((f) => f.message).join(" | ")}
            </div>
          )}
        </div>
      )}

      {/* Generation Countdown & Visual Progress Modal */}
      <GenerationProgressModal
        isOpen={busy}
        title="Generating SEO Visibility Deck"
        subtitle="Building presentation from Semrush audit & keyword workbook..."
        targetName={summary?.property_name || (xlsxFile?.name ? xlsxFile.name.replace(/\.[^/.]+$/, "") : targetUrl)}
        estimatedSeconds={10}
      />
    </Card>
  );
}
