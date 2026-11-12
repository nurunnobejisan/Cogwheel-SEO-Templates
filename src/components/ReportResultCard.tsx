"use client";

import { TEMPLATES } from "@/config/templates";
import type { MatrixRow, TemplateId } from "@/lib/types";
import { Card } from "./ui";

export interface ReportDocResult {
  docId: string;
  docUrl: string;
  rationales: Array<{ pageId: string; title: string; text: string }>;
}

interface ReportResultCardProps {
  reportDoc: ReportDocResult;
  template: TemplateId;
  matrix: MatrixRow[];
}

export function ReportResultCard({ reportDoc, template, matrix }: ReportResultCardProps) {
  const flaggedRows = matrix.filter((m) => m.flags.length > 0);

  return (
    <Card
      title="Keyword Report Generated"
      subtitle={`Template ${template} — ${TEMPLATES[template].rationaleHeading}`}
      actions={
        <a
          href={reportDoc.docUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Open Google Doc →
        </a>
      }
    >
      <div className="space-y-4">
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

