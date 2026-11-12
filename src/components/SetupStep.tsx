"use client";

import { useState } from "react";
import { HILTON_BRANDS, isHalfAndHalfEligible } from "@/config/hilton-rules";
import { DEFAULT_RULES } from "@/config/rules";
import { BUCKETS } from "@/lib/engine/bucket";
import type { Property, SitemapPage, TemplateId } from "@/lib/types";
import { Button, Card } from "./ui";

const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export function PropertySetup({
  property,
  onChange,
  template,
  onTemplateChange,
}: {
  property: Property;
  onChange: (p: Property) => void;
  template: TemplateId;
  onTemplateChange: (t: TemplateId) => void;
}) {
  const set = <K extends keyof Property>(k: K, v: Property[K]) => onChange({ ...property, [k]: v });
  return (
    <Card title="1. Property Setup" subtitle="Property details, report format, and home-market geo filters.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="md:col-span-3">
          <label className="label">Property name</label>
          <input className="input" value={property.name} onChange={(e) => set("name", e.target.value)} placeholder="Hotel X, Tapestry Collection by Hilton" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Property URL</label>
          <input className="input" type="url" value={property.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="https://www.hilton.com/en/hotels/..." />
        </div>
        <div className="md:col-span-2">
          <label className="label">Brand</label>
          <select className="input" value={property.brand} onChange={(e) => set("brand", e.target.value)}>
            <option value="">Select brand…</option>
            {HILTON_BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {property.brand && (
            <p className="mt-1 text-xs text-slate-500">
              Half &amp; Half: <strong>{isHalfAndHalfEligible(property.brand) ? "Yes" : "No"}</strong>
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="label">City</label>
          <input className="input" value={property.city} onChange={(e) => set("city", e.target.value)} placeholder="Gainesville" />
        </div>
        <div className="md:col-span-2">
          <label className="label">State (2-letter)</label>
          <input className="input uppercase" maxLength={2} value={property.state} onChange={(e) => set("state", e.target.value.toUpperCase())} placeholder="FL" />
        </div>
        <div className="md:col-span-6">
          <label className="label">Report Format</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onTemplateChange("A")}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm transition-all ${
                template === "A" ? "border-brand bg-brand-50 font-semibold text-slate-900 shadow-sm" : "border-slate-200 hover:border-brand/60"
              }`}
            >
              <div className="font-display">Standard Catbird / Arrive (Format A)</div>
              <div className="text-xs font-normal text-slate-500">2-col table (Page | Keyword) + Why did we do this? bullets</div>
            </button>
            <button
              type="button"
              onClick={() => onTemplateChange("B")}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm transition-all ${
                template === "B" ? "border-brand bg-brand-50 font-semibold text-slate-900 shadow-sm" : "border-slate-200 hover:border-brand/60"
              }`}
            >
              <div className="font-display">Cogwheel Reitz Union (Format B)</div>
              <div className="text-xs font-normal text-slate-500">Current Sitemap + 3-col table (Primary &amp; Secondary) + Comments</div>
            </button>
          </div>
        </div>
        <div className="md:col-span-6">
          <label className="label">Google Doc Template URL or ID (optional — defaults to Catbird/Hilton Master)</label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="md:col-span-3">
              <input
                className="input"
                value={property.templateDocUrl ?? ""}
                onChange={(e) => set("templateDocUrl", e.target.value)}
                placeholder="https://docs.google.com/document/d/1TIGp2n1UAfz_UKGyJl4ZK-jdcITxsjO6EgqRvy1CVSw/edit"
              />
            </div>
            <div className="md:col-span-2">
              <select
                className="input"
                value={property.rationaleStyle ?? (template === "B" ? "reitz" : "catbird")}
                onChange={(e) => set("rationaleStyle", e.target.value as Property["rationaleStyle"])}
              >
                <option value="catbird">Rationale: Catbird (with supporting KWs)</option>
                <option value="arrive">Rationale: Arrive (short &amp; direct)</option>
                <option value="reitz">Rationale: Reitz / Cogwheel (qualitative)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-1">
              <input
                type="checkbox"
                className="h-4 w-4 accent-slate-900"
                checked={property.petFriendly !== false}
                onChange={(e) => set("petFriendly", e.target.checked)}
              />
              Pet Friendly
            </label>
          </div>
        </div>
        <div className="md:col-span-6">
          <label className="label">Property Notes</label>
          <textarea
            className="input min-h-[68px]"
            value={property.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="USPs, rooftop bar opening, renovations, target personas, or client requests for rationale context…"
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Allowed locations</label>
          <textarea
            className="input min-h-[72px]"
            defaultValue={property.allowedLocations.join(", ")}
            onBlur={(e) => set("allowedLocations", splitList(e.target.value))}
            placeholder="university of florida, uf, midtown, archer road"
          />
          <p className="mt-1 text-xs text-slate-500">Neighborhoods, nearby towns, campuses, landmarks — comma separated.</p>
        </div>
        <div className="md:col-span-3">
          <label className="label">Excluded locations</label>
          <textarea
            className="input min-h-[72px]"
            defaultValue={property.excludedLocations.join(", ")}
            onBlur={(e) => set("excludedLocations", splitList(e.target.value))}
            placeholder="alachua, newberry, lake city"
          />
          <p className="mt-1 text-xs text-slate-500">Always dropped, in addition to wrong states and major cities.</p>
        </div>
      </div>
    </Card>
  );
}

export function Dropzone({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  const max = DEFAULT_RULES.maxFiles;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = Array.from(list).filter((f) => /\.(csv|xlsx|xls|tsv)$/i.test(f.name));
    const byName = new Map(files.map((f) => [f.name, f]));
    accepted.forEach((f) => byName.set(f.name, f));
    onChange([...byName.values()].slice(0, max));
  };

  return (
    <Card
      title="Semrush Exports"
      subtitle={`Up to ${max} CSV/XLSX files. No Group/Topic column? The filename becomes the bucket name.`}
      actions={
        <Button variant="secondary" disabled title="Ships in Phase 2">
          Sync Google Drive folder
        </Button>
      }
    >
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-[210px] cursor-pointer flex-col justify-between rounded-2xl border-2 p-6 text-center transition-all duration-300 ${
          files.length > 0
            ? "border-brand bg-brand-50 shadow-md"
            : over
              ? "scale-[1.02] border-brand bg-brand-50/60 shadow-lg"
              : "border-dashed border-slate-200 bg-white hover:-translate-y-1 hover:border-brand hover:shadow-card"
        }`}
      >
        <input type="file" multiple accept=".csv,.xlsx,.xls,.tsv" className="hidden" onChange={(e) => addFiles(e.target.files)} />
        <div className="flex w-full items-center justify-between">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-400">Multi-CSV</span>
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">Required</span>
        </div>
        <div className="my-auto py-4">
          <div className="font-display text-base font-bold text-slate-800">
            {files.length > 0 ? `${files.length} export${files.length === 1 ? "" : "s"} ready` : "Drop Semrush exports here"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            or click to browse · {files.length}/{max} files selected
          </div>
        </div>
        <div className="text-[11px] font-medium text-slate-400">CSV, XLSX, XLS, TSV</div>
      </label>
      {files.length > 0 && (
        <ul className="mt-4 max-h-56 divide-y divide-slate-100 overflow-auto rounded-md border border-slate-200">
          {files.map((f) => (
            <li key={f.name} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="truncate">{f.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</span>
                <button className="text-xs text-red-600 hover:underline" onClick={() => onChange(files.filter((x) => x !== f))}>
                  remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PagesEditor({ pages, onChange }: { pages: SitemapPage[]; onChange: (p: SitemapPage[]) => void }) {
  const update = (i: number, patch: Partial<SitemapPage>) => onChange(pages.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const activeCount = pages.filter((p) => p.active).length;
  return (
    <Card
      title="Active Sitemap Pages"
      subtitle={`${activeCount} active — each gets one primary keyword (matched in this order).`}
      actions={
        <Button
          variant="secondary"
          onClick={() =>
            onChange([...pages, { id: `page-${pages.length + 1}`, path: "/new-page/", title: "New Page", buckets: [], active: true }])
          }
        >
          + Add page
        </Button>
      }
    >
      <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-10">On</th>
              <th className="th">Title</th>
              <th className="th">Path</th>
              <th className="th">Eligible buckets</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                <td className="td">
                  <input type="checkbox" checked={p.active} onChange={(e) => update(i, { active: e.target.checked })} />
                </td>
                <td className="td">
                  <input className="input py-1" value={p.title} onChange={(e) => update(i, { title: e.target.value })} />
                </td>
                <td className="td">
                  <input className="input py-1 font-mono text-xs" value={p.path} onChange={(e) => update(i, { path: e.target.value })} />
                </td>
                <td className="td">
                  <BucketPicker value={p.buckets} onChange={(b) => update(i, { buckets: b })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BucketPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const remaining = BUCKETS.filter((b) => !value.includes(b.id));
  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
          {BUCKETS.find((b) => b.id === id)?.name ?? id}
          <button className="text-slate-400 hover:text-red-600" onClick={() => onChange(value.filter((x) => x !== id))} aria-label="remove">
            ×
          </button>
        </span>
      ))}
      {remaining.length > 0 && (
        <select className="rounded border border-dashed border-slate-300 bg-transparent px-1 py-0.5 text-xs text-slate-500" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">+ bucket</option>
          {remaining.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

