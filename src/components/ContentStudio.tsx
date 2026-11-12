"use client";

import { useMemo, useState } from "react";
import {
  HILTON_BRANDS,
  isHalfAndHalfEligible,
  SECTION_RULES,
  type HiltonSectionId,
} from "@/config/hilton-rules";
import { parseDiffSegments, validateSection } from "@/lib/hilton-validator";
import type { MatrixRow, Property } from "@/lib/types";
import { Button, Card, Spinner } from "./ui";

const EDITABLE_SECTIONS: HiltonSectionId[] = [
  "home-headline",
  "home-description",
  "usp-callout",
  "location",
  "dining-main",
  "dining-outlet",
  "rooms",
  "suites",
  "events",
];

interface Props {
  property: Property;
  onPropertyChange: (p: Property) => void;
  matrix: MatrixRow[];
  runId: string | null;
}

function keywordFor(sectionId: HiltonSectionId, matrix: MatrixRow[]): string {
  const find = (ids: string[]) => matrix.find((m) => ids.includes(m.pageId))?.primary?.keyword ?? "";
  switch (sectionId) {
    case "home-headline":
    case "home-description":
      return find(["home"]);
    case "location":
      return find(["location"]);
    case "dining-main":
    case "dining-outlet":
      return find(["dining", "bar"]);
    case "rooms":
      return find(["rooms"]);
    case "suites":
      return find(["suites", "rooms"]);
    case "events":
      return find(["events", "meetings", "weddings"]);
    default:
      return "";
  }
}

function DiffPreview({ text }: { text: string }) {
  const segments = parseDiffSegments(text);
  if (!text.trim()) return <span className="italic text-slate-400">No proposed copy yet.</span>;
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
      {segments.map((seg, i) => {
        if (seg.kind === "added") {
          return (
            <strong key={i} className="rounded bg-emerald-100 px-0.5 font-semibold text-emerald-900">
              {seg.text}
            </strong>
          );
        }
        if (seg.kind === "removed") {
          return (
            <del key={i} className="rounded bg-red-100 px-0.5 text-red-700 line-through">
              {seg.text}
            </del>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </div>
  );
}

export function ContentStudio({ property, onPropertyChange, matrix, runId }: Props) {
  const [demandGenerators, setDemandGenerators] = useState(property.notes ?? "");
  const [usp1, setUsp1] = useState("");
  const [usp2, setUsp2] = useState("");
  const [liveCopy, setLiveCopy] = useState<Record<string, string>>({});
  const [proposedCopy, setProposedCopy] = useState<Record<string, string>>({});
  const [grandfatheredOutlet, setGrandfatheredOutlet] = useState(false);
  const [editingProposed, setEditingProposed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docResult, setDocResult] = useState<{
    docUrl: string | null;
    warning?: string | null;
    strippedCount?: number;
  } | null>(null);

  const usps = useMemo(() => [usp1, usp2].map((u) => u.trim()).filter(Boolean), [usp1, usp2]);
  const halfAndHalf = isHalfAndHalfEligible(property.brand);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-hc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: runId ?? undefined,
          property,
          matrix: matrix.map((m) => ({
            pageId: m.pageId,
            path: m.path,
            title: m.title,
            primary: m.primary ? { keyword: m.primary.keyword, volume: m.primary.volume, kd: m.primary.kd } : null,
            secondary: m.secondary ? { keyword: m.secondary.keyword, volume: m.secondary.volume, kd: m.secondary.kd } : null,
          })),
          discoveryNotes: { demandGenerators, usps },
          liveCopy,
          grandfatheredOutlet,
          generateDoc: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hilton copy generation failed");
      setProposedCopy(data.sections ?? {});
      setDocResult({
        docUrl: data.docUrl ?? null,
        warning: data.googleWarning ?? null,
        strippedCount: data.strippedInstructionsCount ?? 0,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card
        title="4. Hilton SEO/GEO Content Studio"
        subtitle="Inherits approved Stage 1 keywords, enforces Hilton character/USP QA, and outputs diff-marked copy to Google Docs."
        actions={
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? <Spinner /> : null}
            Generate Hilton Copy &amp; Google Doc
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="label">Hilton Brand</label>
            <select
              className="input"
              value={property.brand}
              onChange={(e) => onPropertyChange({ ...property, brand: e.target.value })}
            >
              <option value="">Select brand…</option>
              {HILTON_BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <span className="text-slate-500">Half &amp; Half Eligibility:</span>
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  halfAndHalf ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {halfAndHalf ? "Yes" : "No"}
              </span>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="label">USP #1 (Required for Dining &amp; Rooms)</label>
            <input
              className="input"
              value={usp1}
              onChange={(e) => setUsp1(e.target.value)}
              placeholder="e.g. Rooftop cocktail bar overlooking downtown"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">USP #2 (Required for Dining &amp; Rooms)</label>
            <input
              className="input"
              value={usp2}
              onChange={(e) => setUsp2(e.target.value)}
              placeholder="e.g. Steps from University of Florida campus"
            />
          </div>

          <div className="md:col-span-6">
            <label className="label">Discovery Notes (Demand Generators &amp; Property Context)</label>
            <textarea
              className="input min-h-[72px]"
              value={demandGenerators}
              onChange={(e) => setDemandGenerators(e.target.value)}
              placeholder="Nearby hospitals, universities, stadiums, corporate offices, dining concepts, renovations…"
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Inherited Approved Keywords ({matrix.length} pages)
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {matrix.map((m) => (
              <span key={m.pageId} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs">
                <strong className="text-slate-700">{m.title}:</strong>{" "}
                <span className="text-hilton">{m.primary?.keyword ?? "—"}</span>
              </span>
            ))}
          </div>
        </div>

        {docResult && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            {docResult.docUrl ? (
              <>
                <span className="text-emerald-900">
                  Hilton Google Doc ready
                  {docResult.strippedCount ? ` (stripped ${docResult.strippedCount} instruction blocks)` : ""}.
                </span>
                <a
                  href={docResult.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
                >
                  Open Hilton Google Doc →
                </a>
              </>
            ) : (
              <span className="text-amber-800">{docResult.warning || "Copy generated."}</span>
            )}
          </div>
        )}
      </Card>

      {EDITABLE_SECTIONS.map((sectionId) => {
        const rule = SECTION_RULES[sectionId];
        const keyword = keywordFor(sectionId, matrix);
        const current = liveCopy[sectionId] ?? "";
        const proposed = proposedCopy[sectionId] ?? "";
        const check = validateSection({
          sectionId,
          text: proposed || current,
          keyword,
          usps,
          brand: property.brand,
          grandfathered: grandfatheredOutlet,
        });

        return (
          <Card
            key={sectionId}
            title={
              <div className="flex flex-wrap items-center gap-2">
                <span>{rule.label}</span>
                {keyword && (
                  <span className="rounded-full bg-hilton-light px-2.5 py-0.5 text-xs font-medium text-hilton">
                    Target: {keyword}
                  </span>
                )}
              </div>
            }
            subtitle={rule.notes}
            actions={
              <div className="flex items-center gap-2">
                {sectionId === "dining-outlet" && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={grandfatheredOutlet}
                      onChange={(e) => setGrandfatheredOutlet(e.target.checked)}
                    />
                    Grandfathered (400 chars)
                  </label>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                    check.overLimit
                      ? "bg-red-100 text-red-700"
                      : check.charCount > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {check.charCount} chars · {check.limitLabel}
                </span>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="label">Current Live Copy</label>
                <textarea
                  className="input min-h-[110px]"
                  value={current}
                  onChange={(e) => setLiveCopy({ ...liveCopy, [sectionId]: e.target.value })}
                  placeholder={`Paste existing live ${rule.label} copy…`}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="label mb-0">Proposed Diff Copy (**additions**, ~~removals~~)</span>
                  <button
                    type="button"
                    className="text-xs text-hilton hover:underline"
                    onClick={() =>
                      setEditingProposed({ ...editingProposed, [sectionId]: !editingProposed[sectionId] })
                    }
                  >
                    {editingProposed[sectionId] ? "View diff" : "Edit raw"}
                  </button>
                </div>

                {editingProposed[sectionId] ? (
                  <textarea
                    className="input min-h-[110px] font-mono text-xs"
                    value={proposed}
                    onChange={(e) => setProposedCopy({ ...proposedCopy, [sectionId]: e.target.value })}
                  />
                ) : (
                  <div className="min-h-[110px] rounded-md border border-slate-200 bg-slate-50 p-3">
                    <DiffPreview text={proposed} />
                  </div>
                )}

                {proposed && !check.valid && (
                  <ul className="mt-2 space-y-0.5 text-xs text-red-600">
                    {check.violations.map((v, i) => (
                      <li key={i}>• {v}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

