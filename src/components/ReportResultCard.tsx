"use client";

import { TEMPLATES } from "@/config/templates";
import type { DocumentQualityReport } from "@/lib/doc-quality";
import type { GeoSeoInsights } from "@/lib/engine/geo-seo";
import type { MatrixRow, Property, TemplateId } from "@/lib/types";
import { Card } from "./ui";

export interface ReportDocResult {
  docId: string;
  docUrl: string;
  preservedTemplateDesign?: boolean;
  usedAi?: boolean;
  rationales: Array<{ pageId: string; title: string; text: string }>;
  qualityReport?: DocumentQualityReport;
}

interface ReportResultCardProps {
  reportDoc: ReportDocResult;
  property: Property;
  template: TemplateId;
  matrix: MatrixRow[];
  insights: GeoSeoInsights;
  onExportExcel: () => void;
}

export function ReportResultCard({
  reportDoc,
  property,
  template,
  matrix,
  insights,
  onExportExcel,
}: ReportResultCardProps) {
  const flaggedRows = matrix.filter((m) => m.flags.length > 0);
  const quality = reportDoc.qualityReport;
  const pdfUrl = `/api/export-doc?docId=${encodeURIComponent(reportDoc.docId)}&format=pdf&name=${encodeURIComponent(property.name || "Hotel")}`;
  const docxUrl = `/api/export-doc?docId=${encodeURIComponent(reportDoc.docId)}&format=docx&name=${encodeURIComponent(property.name || "Hotel")}`;

  return (
    <Card
      title="Keyword Report Generated"
      subtitle={`Template ${template} — ${TEMPLATES[template].rationaleHeading}${reportDoc.preservedTemplateDesign ? " (Master template design preserved)" : ""}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export Excel (.xlsx)
          </button>
          <a
            href={pdfUrl}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export PDF
          </a>
          <a
            href={docxUrl}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export DOCX
          </a>
          <a
            href={reportDoc.docUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Open Google Doc →
          </a>
        </div>
      }
    >
      <div className="space-y-4">
        {quality && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
              <span>Document Quality Check</span>
              <span>
                {quality.passedCount} passed · {quality.warningCount} warning · {quality.failedCount} failed
              </span>
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 text-xs md:grid-cols-2">
              {quality.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span
                    className={
                      c.status === "passed"
                        ? "font-bold text-emerald-700"
                        : c.status === "warning"
                          ? "font-bold text-amber-700"
                          : "font-bold text-red-700"
                    }
                  >
                    {c.status === "passed" ? "✓" : c.status === "warning" ? "!" : "✕"}
                  </span>
                  <span className="text-slate-700">
                    <strong>{c.label}:</strong> {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs md:grid-cols-3">
          <div>
            <div className="font-bold uppercase tracking-wider text-slate-500">Brand Split</div>
            <div className="mt-1 text-slate-800">
              Branded: <strong>{insights.brandedCount}</strong> · Non-Branded: <strong>{insights.nonBrandedCount}</strong>
            </div>
          </div>
          <div>
            <div className="font-bold uppercase tracking-wider text-slate-500">Intent Mix</div>
            <div className="mt-1 text-slate-800">
              Trans: <strong>{insights.intentBreakdown.transactional}</strong> · Comm: <strong>{insights.intentBreakdown.commercial}</strong> · Local:{" "}
              <strong>{insights.intentBreakdown.local}</strong> · Info: <strong>{insights.intentBreakdown.informational}</strong>
            </div>
          </div>
          <div>
            <div className="font-bold uppercase tracking-wider text-slate-500">GEO & Schema</div>
            <div className="mt-1 text-slate-800">
              {insights.conversationalQueries.length} conversational queries · {insights.structuredDataRecommendations.length} schema recs
            </div>
          </div>
        </div>

        {flaggedRows.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Flag Summary ({flaggedRows.length} {flaggedRows.length === 1 ? "page needs" : "pages need"} review)
            </div>
            <ul className="mt-2 space-y-1 text-xs text-amber-900">
              {flaggedRows.map((m) => (
                <li key={m.pageId}>
                  <strong>{m.title}:</strong> {m.primary?.keyword ?? "—"} ({m.flags.join(", ")})
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="space-y-2 text-sm text-slate-700">
          {reportDoc.rationales.map((r) => (
            <li key={r.pageId}>
              <strong>{r.title}:</strong> {r.text}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
