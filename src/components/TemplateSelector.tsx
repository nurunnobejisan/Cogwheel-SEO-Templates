"use client";

import { useState } from "react";
import { TEMPLATES } from "@/config/templates";
import { postJson } from "@/lib/api";
import type { TemplateId } from "@/lib/types";
import { Button, Card, Spinner } from "./ui";

interface InspectedDoc {
  docId: string;
  title: string;
  headings: Array<{ level: number; text: string }>;
  tableCount: number;
  paragraphCount: number;
  hasHeader: boolean;
  hasFooter: boolean;
  placeholders: string[];
}

export function TemplateSelector({
  value,
  onChange,
  masterTemplateUrl,
  onMasterTemplateUrlChange,
}: {
  value: TemplateId;
  onChange: (t: TemplateId) => void;
  masterTemplateUrl?: string;
  onMasterTemplateUrlChange?: (url: string) => void;
}) {
  const [masterUrl, setMasterUrl] = useState(
    masterTemplateUrl ?? "https://docs.google.com/document/d/1TIGp2n1UAfz_UKGyJl4ZK-jdcITxsjO6EgqRvy1CVSw/edit?usp=sharing",
  );
  const [example1Url, setExample1Url] = useState("");
  const [example2Url, setExample2Url] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<{ master: InspectedDoc; examples: InspectedDoc[] } | null>(null);

  async function handleInspect() {
    setInspecting(true);
    setInspectError(null);
    try {
      const res = await postJson<{ master: InspectedDoc; examples: InspectedDoc[] }>("/api/templates/inspect", {
        masterTemplateUrl: masterUrl,
        example1Url,
        example2Url,
      });
      setInspection(res);
      onMasterTemplateUrlChange?.(masterUrl);
    } catch (e) {
      setInspectError((e as Error).message);
    } finally {
      setInspecting(false);
    }
  }

  return (
    <div className="space-y-6">
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
                className={`rounded-2xl border-2 p-5 text-left transition-all ${selected ? "border-brand bg-brand-50 shadow-sm" : "border-slate-200 hover:border-brand/60"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-display font-bold text-slate-900">{t.name}</div>
                  <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-slate-900 bg-brand" : "border-slate-300"}`} />
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

      <Card
        title="Google Docs Template Manager & Preview"
        subtitle="Validate permissions and inspect Master Template + Example Output Documents without modifying the originals."
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Master Template Document URL</label>
            <input
              type="url"
              value={masterUrl}
              onChange={(e) => {
                setMasterUrl(e.target.value);
                onMasterTemplateUrlChange?.(e.target.value);
              }}
              placeholder="https://docs.google.com/document/d/.../edit"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Example Output Document 1 (optional)</label>
              <input
                type="url"
                value={example1Url}
                onChange={(e) => setExample1Url(e.target.value)}
                placeholder="https://docs.google.com/document/d/.../edit"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Example Output Document 2 (optional)</label>
              <input
                type="url"
                value={example2Url}
                onChange={(e) => setExample2Url(e.target.value)}
                placeholder="https://docs.google.com/document/d/.../edit"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleInspect} disabled={!masterUrl.trim() || inspecting}>
              {inspecting ? <Spinner /> : null}
              Inspect & Preview Template
            </Button>
            {inspectError && <span className="text-xs text-red-700">{inspectError}</span>}
          </div>

          {inspection && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900">
                Master: {inspection.master.title} ({inspection.master.tableCount} tables · {inspection.master.paragraphCount} paragraphs ·{" "}
                {inspection.master.hasHeader ? "Header ✓" : "No Header"} · {inspection.master.hasFooter ? "Footer ✓" : "No Footer"})
              </div>
              {inspection.master.placeholders.length > 0 && (
                <div>
                  <strong>Detected Placeholders:</strong> {inspection.master.placeholders.join(", ")}
                </div>
              )}
              {inspection.master.headings.length > 0 && (
                <div>
                  <strong>Headings:</strong> {inspection.master.headings.map((h) => `H${h.level}: ${h.text}`).join(" · ")}
                </div>
              )}
              {inspection.examples.map((ex) => (
                <div key={ex.docId} className="border-t border-slate-200 pt-2">
                  <strong>Example:</strong> {ex.title} ({ex.tableCount} tables, {ex.headings.length} headings)
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
