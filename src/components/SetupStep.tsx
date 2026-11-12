"use client";

import { useMemo, useState } from "react";
import { HILTON_BRANDS, isHalfAndHalfEligible } from "@/config/hilton-rules";
import portfolioProperties from "@/config/properties.json";
import { DEFAULT_RULES } from "@/config/rules";
import { BUCKETS } from "@/lib/engine/bucket";
import type { Property, SitemapPage, TemplateId } from "@/lib/types";
import { Button, Card } from "./ui";

const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

interface PortfolioEntry {
  name: string;
  url: string;
  propertyType?: string;
  managementGroup?: string;
  brand?: string;
  city?: string;
  state?: string;
  seoAssignee?: string;
}

const PORTFOLIO = portfolioProperties as PortfolioEntry[];

export function PropertySetup({
  property,
  onChange,
  template,
  onTemplateChange,
  onCrawlUrl,
  crawling,
}: {
  property: Property;
  onChange: (p: Property) => void;
  template: TemplateId;
  onTemplateChange: (t: TemplateId) => void;
  onCrawlUrl?: () => void;
  crawling?: boolean;
}) {
  const [portfolioFilter, setPortfolioFilter] = useState("");
  const filteredPortfolio = useMemo(() => {
    const q = portfolioFilter.trim().toLowerCase();
    if (!q) return PORTFOLIO;
    return PORTFOLIO.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.url.toLowerCase().includes(q) ||
        (p.managementGroup ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q),
    );
  }, [portfolioFilter]);

  const set = <K extends keyof Property>(k: K, v: Property[K]) => onChange({ ...property, [k]: v });

  function selectPortfolioProperty(name: string) {
    const picked = PORTFOLIO.find((p) => p.name === name);
    if (!picked) return;
    const metaNotes = [
      picked.propertyType ? `Type: ${picked.propertyType}` : "",
      picked.managementGroup ? `Group: ${picked.managementGroup}` : "",
      picked.seoAssignee ? `SEO: ${picked.seoAssignee}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    onChange({
      ...property,
      name: picked.name,
      url: picked.url,
      brand: picked.brand ?? property.brand ?? "",
      city: picked.city ?? "",
      state: picked.state ?? "",
      notes: property.notes?.trim() ? property.notes : metaNotes,
    });
  }

  return (
    <Card title="1. Property Setup" subtitle="Quick-pick from your 91-property portfolio or enter details manually.">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Portfolio Quick-Pick ({filteredPortfolio.length} of {PORTFOLIO.length} properties)
          </label>
          <input
            type="search"
            value={portfolioFilter}
            onChange={(e) => setPortfolioFilter(e.target.value)}
            placeholder="Filter by name, city, Sage, Palisociety…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:w-64"
          />
        </div>
        <select
          className="input bg-white"
          value={PORTFOLIO.some((p) => p.name === property.name) ? property.name : ""}
          onChange={(e) => selectPortfolioProperty(e.target.value)}
        >
          <option value="">Select a property from portfolio…</option>
          {filteredPortfolio.map((p) => (
            <option key={`${p.name}-${p.url}`} value={p.name}>
              {p.name}
              {p.propertyType ? ` [${p.propertyType}]` : ""}
              {p.city && p.state ? ` — ${p.city}, ${p.state}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="md:col-span-3">
          <label className="label">Property name</label>
          <input className="input" value={property.name} onChange={(e) => set("name", e.target.value)} placeholder="Hotel X, Tapestry Collection by Hilton" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Property URL</label>
          <div className="flex gap-2">
            <input className="input" type="url" value={property.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="https://www.hilton.com/en/hotels/..." />
            {onCrawlUrl && (
              <Button
                variant="secondary"
                className="shrink-0 px-3 text-xs"
                disabled={!property.url?.trim() || crawling}
                onClick={onCrawlUrl}
                title="Auto-detect City, State, Pet Policy & Sitemap Pages from URL"
              >
                {crawling ? "Scanning…" : "Auto-Discover"}
              </Button>
            )}
          </div>
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
            key={`allowed-${property.allowedLocations.join(",")}`}
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
            key={`excluded-${property.excludedLocations.join(",")}`}
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

export function Dropzone({
  files,
  onChange,
  onDriveSync,
  onSemrushPull,
  syncing,
  canPullSemrush,
}: {
  files: File[];
  onChange: (f: File[]) => void;
  onDriveSync?: (folderUrlOrId: string) => void;
  onSemrushPull?: () => void;
  syncing?: boolean;
  canPullSemrush?: boolean;
}) {
  const [over, setOver] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteBucket, setPasteBucket] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [driveFolder, setDriveFolder] = useState("");
  const max = DEFAULT_RULES.maxFiles;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = Array.from(list).filter((f) => /\.(csv|xlsx|xls|tsv|txt|json)$/i.test(f.name));
    const byName = new Map(files.map((f) => [f.name, f]));
    accepted.forEach((f) => byName.set(f.name, f));
    onChange([...byName.values()].slice(0, max));
  };

  const addPastedData = () => {
    if (!pasteText.trim()) return;
    const baseName = (pasteBucket.trim() || `pasted-${files.length + 1}`).replace(/[^a-z0-9_-]+/gi, "_");
    const file = new File([pasteText], `${baseName}.csv`, { type: "text/csv" });
    onChange([...files.filter((f) => f.name !== file.name), file].slice(0, max));
    setPasteText("");
    setPasteBucket("");
    setShowPaste(false);
  };

  return (
    <Card
      title="Keyword Data Sources"
      subtitle={`Drop up to ${max} CSV/XLSX/TSV/TXT/JSON files, paste raw keywords, sync Google Drive, or pull Semrush API.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setShowPaste((v) => !v)}>
            Paste Data
          </Button>
          {onDriveSync && (
            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setShowDrive((v) => !v)}>
              Sync Google Drive
            </Button>
          )}
          {onSemrushPull && (
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={!canPullSemrush || syncing}
              onClick={onSemrushPull}
              title="Pull keywords directly via SEMRUSH_API_KEY"
            >
              Pull Semrush API
            </Button>
          )}
        </div>
      }
    >
      {showPaste && (
        <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input
            className="input py-1.5 text-xs"
            value={pasteBucket}
            onChange={(e) => setPasteBucket(e.target.value)}
            placeholder="Bucket / Group name (optional — e.g. Rooftop Bar Denver)"
          />
          <textarea
            className="input min-h-[84px] font-mono text-xs"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Paste CSV/TSV rows or 1 keyword per line…\nKeyword,Volume,KD\nrooftop bar denver,1900,23"}
          />
          <div className="flex justify-end">
            <Button className="px-3 py-1.5 text-xs" disabled={!pasteText.trim()} onClick={addPastedData}>
              Add Pasted Data
            </Button>
          </div>
        </div>
      )}
      {showDrive && onDriveSync && (
        <div className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input
            className="input py-1.5 text-xs"
            value={driveFolder}
            onChange={(e) => setDriveFolder(e.target.value)}
            placeholder="Paste Google Drive folder URL or ID (reads 01-semrush/ automatically)…"
          />
          <Button
            className="shrink-0 px-3 py-1.5 text-xs"
            disabled={!driveFolder.trim() || syncing}
            onClick={() => onDriveSync(driveFolder)}
          >
            {syncing ? "Syncing…" : "Sync"}
          </Button>
        </div>
      )}
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
        <input type="file" multiple accept=".csv,.xlsx,.xls,.tsv,.txt,.json" className="hidden" onChange={(e) => addFiles(e.target.files)} />
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

