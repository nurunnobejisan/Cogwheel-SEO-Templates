"use client";

import { TEMPLATES } from "@/config/templates";
import type { TemplateId } from "@/lib/types";
import { Card } from "./ui";

export function TemplateSelector({ value, onChange }: { value: TemplateId; onChange: (t: TemplateId) => void }) {
  return (
    <Card title="2. Report Template" subtitle="Format B also allocates one secondary keyword per page into the 78-keyword pool.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => {
          const t = TEMPLATES[id];
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`rounded-lg border-2 p-4 text-left transition ${selected ? "border-hilton bg-hilton-light/60" : "border-slate-200 hover:border-slate-300"}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{t.name}</div>
                <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-hilton bg-hilton" : "border-slate-300"}`} />
              </div>
              <div className="text-xs text-slate-500">{t.clients}</div>
              <p className="mt-2 text-sm text-slate-600">{t.description}</p>
              <div className="mt-3 overflow-hidden rounded border border-slate-200 bg-white text-xs">
                {t.includeCurrentSitemap && <div className="border-b border-slate-200 bg-slate-50 px-2 py-1 font-medium">Current Sitemap</div>}
                <div className="grid" style={{ gridTemplateColumns: `repeat(${t.tableColumns.length}, minmax(0, 1fr))` }}>
                  {t.tableColumns.map((c) => (
                    <div key={c} className="border-r border-slate-200 bg-slate-100 px-2 py-1 font-semibold last:border-r-0">{c}</div>
                  ))}
                  {t.tableColumns.map((c) => (
                    <div key={c} className="border-r border-t border-slate-200 px-2 py-1 text-slate-400 last:border-r-0">…</div>
                  ))}
                </div>
                <div className="border-t border-slate-200 px-2 py-1">
                  <span className="font-medium">{t.rationaleHeading}</span>
                  <span className="text-slate-400"> — {t.rationaleStyle === "bullets" ? "• bullet list" : "paragraphs"}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

