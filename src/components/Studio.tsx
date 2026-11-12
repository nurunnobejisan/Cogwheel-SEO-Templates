"use client";

import { useMemo, useState } from "react";
import sitemap from "@/config/sitemap.json";
import { postFormData, postJson } from "@/lib/api";
import {
  addToPool,
  assignKeyword,
  inlineEditMatrixKeyword,
  removeFromPool,
  setRowStatus,
  updatePoolKeyword,
  type MatrixState,
} from "@/lib/engine/matrix";
import { downloadText, matrixToCsv, poolToCsv } from "@/lib/export";
import type { Allocation, BucketSummary, IngestResult, KeywordRecord, MatrixRow, Property, SitemapPage, TemplateId } from "@/lib/types";
import { ApprovalMatrix } from "./ApprovalMatrix";
import { ContentStudio } from "./ContentStudio";
import { KeywordPool } from "./KeywordPool";
import { ReportResultCard, type ReportDocResult } from "./ReportResultCard";
import { Dropzone, PagesEditor, PropertySetup } from "./SetupStep";
import { TemplateSelector } from "./TemplateSelector";
import { Button, Card, Spinner, Stat } from "./ui";

type Step = 1 | 2 | 3 | 4;

const STEPS: Array<[Step, string]> = [
  [1, "Property & Files"],
  [2, "Template"],
  [3, "78-KW Pool & Matrix"],
  [4, "Content Studio"],
];

const EMPTY_PROPERTY: Property = {
  name: "",
  url: "",
  brand: "",
  city: "",
  state: "",
  notes: "",
  petFriendly: true,
  rationaleStyle: "catbird",
  templateDocUrl: "https://docs.google.com/document/d/1TIGp2n1UAfz_UKGyJl4ZK-jdcITxsjO6EgqRvy1CVSw/edit?usp=sharing",
  allowedLocations: [],
  excludedLocations: [],
};

export default function Studio() {
  const [step, setStep] = useState<Step>(1);
  const [property, setProperty] = useState<Property>(EMPTY_PROPERTY);
  const [pages, setPages] = useState<SitemapPage[]>(sitemap.pages as SitemapPage[]);
  const [files, setFiles] = useState<File[]>([]);
  const [template, setTemplate] = useState<TemplateId>("A");

  const [ingest, setIngest] = useState<IngestResult | null>(null);
  const [bucketed, setBucketed] = useState<KeywordRecord[]>([]);
  const [summary, setSummary] = useState<BucketSummary[]>([]);
  const [state, setState] = useState<MatrixState | null>(null);
  const [builtFor, setBuiltFor] = useState<{ template: TemplateId; pagesKey: string } | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [reportDoc, setReportDoc] = useState<ReportDocResult | null>(null);

  const pagesKey = useMemo(() => JSON.stringify(pages), [pages]);
  const propReady = Boolean(property.name.trim() && property.city.trim() && property.state.trim().length === 2);
  const hasKeywordsSource = files.length > 0 || ingest !== null;
  const setupValid = propReady && hasKeywordsSource;
  const stale = !!state && !!builtFor && (builtFor.template !== template || builtFor.pagesKey !== pagesKey);
  const allApproved = !!state && state.matrix.length > 0 && state.matrix.every((r) => r.status === "approved");

  async function handleCrawlProperty() {
    if (!property.url?.trim()) return;
    setError(null);
    setBusy("Auto-discovering sitemap, city/state, and pet policy from URL…");
    try {
      const res = await postJson<{
        blocked: boolean;
        title: string;
        city: string;
        state: string;
        petFriendly: boolean | null;
        pages?: SitemapPage[];
        warnings: string[];
      }>("/api/crawl-property", { url: property.url });

      setProperty((prev) => ({
        ...prev,
        city: prev.city || res.city || prev.city,
        state: prev.state || res.state || prev.state,
        petFriendly: res.petFriendly !== null ? res.petFriendly : prev.petFriendly,
      }));
      if (res.pages?.length) setPages(res.pages);
      setNotice(
        res.warnings.length > 0
          ? `URL scan complete (${res.warnings.join(" ")})`
          : `Auto-discovered ${res.city}, ${res.state} and active sitemap pages.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleDriveSync(folderUrlOrId: string) {
    if (!propReady) {
      setError("Enter Property Name, City, and 2-letter State before syncing Drive.");
      return;
    }
    setError(null);
    setBusy("Syncing Semrush exports from Google Drive folder…");
    try {
      const data = await postJson<IngestResult>("/api/drive-sync", { folderUrlOrId, property });
      setIngest(data);
      await runBucketAndSelect(data);
      setStep(3);
      setNotice(`Synced ${data.stats.files} file(s) from Google Drive.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleSemrushPull() {
    if (!propReady) {
      setError("Enter Property Name, City, and 2-letter State before pulling from Semrush API.");
      return;
    }
    setError(null);
    setBusy("Pulling keywords directly from Semrush API…");
    try {
      const data = await postJson<IngestResult>("/api/semrush-pull", { property });
      setIngest(data);
      await runBucketAndSelect(data);
      setStep(3);
      setNotice(`Pulled ${data.stats.kept} keywords across ${data.stats.files} buckets from Semrush API.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function uploadAndIngest(): Promise<IngestResult> {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("property", JSON.stringify(property));
    const data = await postFormData<IngestResult>("/api/ingest", form);
    setIngest(data);
    return data;
  }

  async function bucketAndSelect(source: IngestResult, autoApprove = false): Promise<MatrixState> {
    const b = await postJson<{ keywords: KeywordRecord[]; summary: BucketSummary[]; allocation: Allocation }>("/api/bucket", {
      keywords: source.keywords,
      pages,
      template,
    });
    setBucketed(b.keywords);
    setSummary(b.summary);

    const s = await postJson<{ matrix: MatrixRow[]; allocation: Allocation }>("/api/select-kw", {
      keywords: b.keywords,
      pages,
      template,
    });
    const matrix = autoApprove ? s.matrix.map((r) => ({ ...r, status: "approved" as const })) : s.matrix;
    const nextState: MatrixState = { matrix, allocation: s.allocation };
    setState(nextState);
    setBuiltFor({ template, pagesKey });
    setSavedRunId(null);
    return nextState;
  }

  async function autoGenerateFullReport() {
    if (!setupValid) return;
    setError(null);
    setBusy("Zero-Touch Auto-Generate: Ingest → Bucket → Select → Generate Google Doc…");
    try {
      const currentIngest = ingest ?? (await uploadAndIngest());
      const nextState = await bucketAndSelect(currentIngest, true);
      const doc = await postJson<ReportDocResult>("/api/generate-kr", {
        property,
        pages,
        template,
        allocation: { pool: nextState.allocation.pool },
        matrix: nextState.matrix,
      });
      setReportDoc(doc);
      setStep(3);
      setNotice("Zero-Touch Report generated! Review the Google Doc link and Flag Summary below.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runIngest() {
    setError(null);
    setBusy("Parsing, deduplicating and filtering exports…");
    try {
      const data = await uploadAndIngest();
      await bucketAndSelect(data);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runBucketAndSelect(source: IngestResult | null = ingest) {
    if (!source) return;
    setError(null);
    setBusy("Bucketing keywords and allocating the 78-keyword pool…");
    try {
      await bucketAndSelect(source);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function mutate(fn: (s: MatrixState) => MatrixState) {
    if (!state) return;
    try {
      setError(null);
      setSavedRunId(null);
      setState(fn(state));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveRun() {
    if (!state || !ingest) return;
    setBusy("Saving run to Supabase…");
    setError(null);
    try {
      const r = await postJson<{ runId: string; status: string }>("/api/runs", {
        property,
        pages,
        template,
        stats: ingest.stats,
        allocation: { pool: state.allocation.pool },
        matrix: state.matrix,
      });
      setSavedRunId(r.runId);
      setNotice(`Run saved (${r.status}) — id ${r.runId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function generateKeywordReport() {
    if (!state || !allApproved) return;
    setBusy("Generating rationales (Claude) and building Google Doc…");
    setError(null);
    try {
      const payload = savedRunId
        ? { runId: savedRunId }
        : {
            property,
            pages,
            template: builtFor?.template ?? template,
            allocation: { pool: state.allocation.pool },
            matrix: state.matrix,
          };
      const res = await postJson<{
        docId: string;
        docUrl: string;
        rationales: Array<{ pageId: string; title: string; text: string }>;
      }>("/api/generate-kr", payload);
      setReportDoc(res);
      setNotice("Keyword Report Google Doc generated!");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const slug = (property.name || "property").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  function resetAll() {
    setProperty(EMPTY_PROPERTY);
    setPages(sitemap.pages as SitemapPage[]);
    setFiles([]);
    setTemplate("A");
    setIngest(null);
    setBucketed([]);
    setSummary([]);
    setState(null);
    setBuiltFor(null);
    setSavedRunId(null);
    setReportDoc(null);
    setError(null);
    setNotice(null);
    setStep(1);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass-nav sticky top-0 z-30 border-b border-slate-200/80">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-brand font-display text-[19px] font-black text-slate-900 shadow-sm"
              style={{ letterSpacing: "-1px" }}
            >
              KR
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-display text-[18px] font-black uppercase leading-none tracking-tight text-slate-900">
                KEYWORD RESEARCH
              </span>
              <span className="mt-1 font-display text-[11px] font-light uppercase leading-none tracking-[0.24em] text-slate-600">
                SEO/GEO STUDIO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 p-1">
              {STEPS.map(([n, label]) => {
                const enabled = n === 1 || n === 2 || (n === 3 && !!state) || (n === 4 && allApproved);
                return (
                  <button
                    key={n}
                    disabled={!enabled}
                    onClick={() => setStep(n)}
                    className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      step === n
                        ? "bg-slate-900 text-white shadow-sm"
                        : enabled
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-300"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        step === n ? "bg-brand text-slate-900" : "bg-white text-slate-500"
                      }`}
                    >
                      {n}
                    </span>
                    <span className="hidden md:inline">{label}</span>
                  </button>
                );
              })}
            </nav>
            {(propReady || files.length > 0 || state) && (
              <button
                type="button"
                onClick={resetAll}
                className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                Reset All
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-grow space-y-6 px-6 py-8">
        {error && (
          <div className="flex items-start justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-700">×</button>
          </div>
        )}
        {notice && (
          <div className="flex items-start justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="ml-4 text-emerald-500">×</button>
          </div>
        )}

        {step === 1 && (
          <>
            <PropertySetup
              property={property}
              onChange={setProperty}
              template={template}
              onTemplateChange={setTemplate}
              onCrawlUrl={handleCrawlProperty}
              crawling={!!busy}
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <Dropzone
                  files={files}
                  onChange={(next) => {
                    setFiles(next);
                    setIngest(null);
                    setState(null);
                    setSavedRunId(null);
                    setReportDoc(null);
                  }}
                  onDriveSync={handleDriveSync}
                  onSemrushPull={handleSemrushPull}
                  syncing={!!busy}
                  canPullSemrush={propReady}
                />
              </div>
              <div className="lg:col-span-3">
                <PagesEditor pages={pages} onChange={setPages} />
              </div>
            </div>
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg lg:flex-row">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${propReady ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${propReady ? "bg-emerald-400" : "bg-slate-500"}`} />
                  Property {propReady ? "✓" : "Required"}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${hasKeywordsSource ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${hasKeywordsSource ? "bg-emerald-400" : "bg-slate-500"}`} />
                  Exports ({files.length || ingest?.stats.files || 0}) {hasKeywordsSource ? "✓" : "Required"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/15 px-3 py-1.5 font-medium text-brand-light">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  Format {template} ✓
                </span>
              </div>
              <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto">
                <Button variant="secondary" onClick={() => setStep(2)} disabled={!setupValid} className="px-4 py-3">
                  Review Mode →
                </Button>
                <Button onClick={autoGenerateFullReport} disabled={!setupValid || !!busy} className="px-6 py-3">
                  {busy ? <Spinner /> : null}
                  Auto-Generate (Skip Checkpoint)
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <TemplateSelector value={template} onChange={setTemplate} />
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={state && !stale ? () => setStep(3) : ingest ? () => runBucketAndSelect().then(() => setStep(3)) : runIngest} disabled={!setupValid || !!busy}>
                {busy ? <Spinner /> : null}
                {state && !stale ? "Continue to matrix →" : ingest ? "Rebuild pool & matrix →" : "Build 78-keyword pool →"}
              </Button>
            </div>
          </>
        )}

        {step === 3 && state && ingest && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
              <Stat label="Files" value={ingest.stats.files} />
              <Stat label="Raw rows" value={ingest.stats.rawRows.toLocaleString()} />
              <Stat label="Dupes merged" value={ingest.stats.duplicatesMerged.toLocaleString()} />
              <Stat label="KD N/A cleaned" value={ingest.stats.kdCleaned} />
              <Stat label="Geo dropped" value={ingest.stats.dropped.geo} tone="warn" />
              <Stat label="Low-SV dropped" value={ingest.stats.dropped["low-volume"]} tone="warn" />
              <Stat label="Eligible" value={bucketed.length.toLocaleString()} />
              <Stat
                label="Pool"
                value={`${state.allocation.pool.length}/${state.allocation.quota}`}
                tone={state.allocation.pool.length === state.allocation.quota ? "good" : "warn"}
              />
            </div>

            {ingest.files.some((f) => f.error) && (
              <Card title="File errors">
                <ul className="list-disc pl-5 text-sm text-red-700">
                  {ingest.files.filter((f) => f.error).map((f) => (
                    <li key={f.fileName}>
                      <strong>{f.fileName}</strong>: {f.error}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {stale && (
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span>Template or sitemap changed since this matrix was built. Rebuilding discards manual edits.</span>
                <Button variant="secondary" onClick={() => runBucketAndSelect()}>Rebuild</Button>
              </div>
            )}

            <ApprovalMatrix
              matrix={state.matrix}
              pages={pages}
              pool={state.allocation.pool}
              reserve={state.allocation.reserve}
              template={builtFor?.template ?? template}
              onAssign={(pageId, slot, id) => mutate((s) => assignKeyword(s, pageId, slot, id))}
              onInlineEdit={(pageId, slot, patch) => mutate((s) => inlineEditMatrixKeyword(s, pageId, slot, patch))}
              onApprove={(pageId, ok) => mutate((s) => setRowStatus(s, pageId, ok))}
            />

            <KeywordPool
              pool={state.allocation.pool}
              reserve={state.allocation.reserve}
              quota={state.allocation.quota}
              summary={summary}
              dropped={ingest.dropped}
              onRemove={(id) => mutate((s) => removeFromPool(s, id))}
              onAdd={(id) => mutate((s) => addToPool(s, id))}
              onUpdateKeyword={(id, patch) => mutate((s) => updatePoolKeyword(s, id, patch))}
            />

            {reportDoc && (
              <ReportResultCard
                reportDoc={reportDoc}
                template={builtFor?.template ?? template}
                matrix={state.matrix}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => downloadText(`${slug}-matrix.csv`, matrixToCsv(state.matrix, builtFor?.template ?? template))}>
                  Export matrix CSV
                </Button>
                <Button variant="secondary" onClick={() => downloadText(`${slug}-78-keyword-pool.csv`, poolToCsv(state.allocation))}>
                  Export pool CSV
                </Button>
                <Button variant="secondary" onClick={saveRun} disabled={!!busy}>
                  Save run
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={generateKeywordReport} disabled={!allApproved || !!busy}>
                  {busy ? <Spinner /> : null}
                  {allApproved ? "Generate Keyword Report (Google Doc)" : "Approve every page to generate"}
                </Button>
                <Button variant="secondary" onClick={() => setStep(4)} disabled={!allApproved}>
                  Content Studio →
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 4 && state && (
          <ContentStudio
            property={property}
            onPropertyChange={setProperty}
            matrix={state.matrix}
            runId={savedRunId}
          />
        )}
      </main>

      {busy && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          <Spinner />
          {busy}
        </div>
      )}
    </div>
  );
}

