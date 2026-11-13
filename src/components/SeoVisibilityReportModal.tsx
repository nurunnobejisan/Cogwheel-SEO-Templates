"use client";

import { useState } from "react";
import { Button, Card } from "./ui";

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

export function SeoVisibilityReportModal({ onClose, onCompleted }: Props) {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawlInfo, setCrawlInfo] = useState<CrawlPreview | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [flags, setFlags] = useState<Array<{ code: string; message: string; severity: string }>>([]);

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

      const res = await fetch("/api/seo-visibility-report", {
        method: "POST",
        body: form,
      });

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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (parsedSummary) {
        const taskRes = await fetch("/api/tasks/seo-only-visibility-report/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl: targetUrl.trim(),
            templateFileName: templateFile.name,
            xlsxFileName: xlsxFile.name,
            pdfFileName: pdfFile?.name,
            downloadName,
            summary: parsedSummary,
          }),
        });
        if (taskRes.ok) {
          const taskJson = await taskRes.json();
          setNarrative(taskJson.output?.executiveSummary ?? null);
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
    <Card className="mb-6 border-slate-300 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900">
            SEO Only Visibility Report (Monthly)
          </h3>
          <p className="text-xs text-slate-500">
            Generates a filled PowerPoint visibility deck from your PPTX template, Semrush XLSX export, and optional Site Audit PDF.
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs transition hover:border-brand hover:bg-brand-50/40">
          <span className="font-semibold text-slate-800">PowerPoint Template (.pptx) *</span>
          <span className="mt-1 text-[11px] text-slate-500">
            {templateFile ? `${templateFile.name} (${Math.round(templateFile.size / 1024)} KB)` : "Click to select .pptx template"}
          </span>
          <input
            type="file"
            accept=".pptx"
            onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-[11px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
          />
        </label>

        <label className="flex cursor-pointer flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs transition hover:border-brand hover:bg-brand-50/40">
          <span className="font-semibold text-slate-800">Keywords Workbook (.xlsx) *</span>
          <span className="mt-1 text-[11px] text-slate-500">
            {xlsxFile ? `${xlsxFile.name} (${Math.round(xlsxFile.size / 1024)} KB)` : "Click to select Semrush .xlsx export"}
          </span>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-[11px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
          />
        </label>

        <label className="flex cursor-pointer flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs transition hover:border-brand hover:bg-brand-50/40">
          <span className="font-semibold text-slate-800">Semrush Site Audit PDF (.pdf, optional)</span>
          <span className="mt-1 text-[11px] text-slate-500">
            {pdfFile ? `${pdfFile.name} (${Math.round(pdfFile.size / 1024)} KB)` : "Optional for Slide 5 SEO Errors"}
          </span>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-[11px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-800 hover:file:bg-slate-300"
          />
        </label>

        <label className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-xs">
          <span className="font-semibold text-slate-800">Target Website URL (optional)</span>
          <span className="mt-1 text-[11px] text-slate-500">
            Used for live hospitality service &amp; topic matching
          </span>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://thenines.com/"
            className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerate} disabled={busy || !templateFile || !xlsxFile}>
          {busy ? "Generating PPTX..." : "Generate Monthly Visibility Deck (.pptx)"}
        </Button>
        <Button
          variant="secondary"
          onClick={handleInspectWebsite}
          disabled={crawlBusy || (!targetUrl.trim() && !xlsxFile)}
        >
          {crawlBusy ? "Inspecting..." : "Inspect Website Services"}
        </Button>
      </div>

      {crawlInfo && (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">
            Site Inspection: {crawlInfo.page_title} ({crawlInfo.crawled_pages} pages crawled)
          </div>
          <div className="mt-1">
            Matched Services: {crawlInfo.matched_services.join(", ") || "None"}
          </div>
        </div>
      )}

      {summary && (
        <div className="mt-4 space-y-2 rounded border border-emerald-200 bg-emerald-50 p-4 text-xs text-slate-800">
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
    </Card>
  );
}

