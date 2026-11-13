"use client";

import { useState } from "react";
import { Button, Card } from "./ui";

interface PropertyInput {
  name: string;
  brand: string;
  city: string;
  state: string;
  url: string;
}

interface Props {
  activeProperty: PropertyInput;
  onClose: () => void;
  onCompleted: () => void;
  onOpenStudio: () => void;
  onOpenVisibilityDeck: () => void;
}

type StepStatus = "idle" | "running" | "done" | "flagged" | "error" | "skipped";

interface StepState {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  outputUrl?: string | null;
  xlsxBase64?: string | null;
  jsonLdScript?: string | null;
}

const PIPELINE_STEPS: Array<{ id: string; label: string; defaultEnabled: boolean }> = [
  { id: "site-crawl", label: "1. Site Crawl (Robots, Sitemap & Pages)", defaultEnabled: true },
  { id: "technical-audit", label: "2. Technical SEO Audit", defaultEnabled: true },
  { id: "duplicate-content-audit", label: "3. Duplicate & Thin Content Audit", defaultEnabled: true },
  { id: "image-optimization", label: "4. Image & Alt Text Optimization", defaultEnabled: true },
  { id: "schema-markup", label: "5. Schema.org JSON-LD Markup", defaultEnabled: true },
  { id: "title-meta", label: "6. Title & Meta Description", defaultEnabled: true },
  { id: "heading-structure", label: "7. Heading Structure (H1–H6)", defaultEnabled: true },
];

function downloadXlsx(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AutoPilotModal({
  activeProperty,
  onClose,
  onCompleted,
  onOpenStudio,
  onOpenVisibilityDeck,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(PIPELINE_STEPS.filter((s) => s.defaultEnabled).map((s) => s.id)),
  );
  const [steps, setSteps] = useState<StepState[]>(() =>
    PIPELINE_STEPS.map((s) => ({ id: s.id, label: s.label, status: "idle" })),
  );
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);

  const canRun = Boolean(activeProperty.name.trim() && activeProperty.url.trim());

  const updateStep = (id: string, patch: Partial<StepState>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  async function runSiteCrawlLoop(): Promise<string> {
    updateStep("site-crawl", { status: "running", detail: "Starting crawl..." });
    const startRes = await fetch("/api/tasks/site-crawl/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: activeProperty.url.trim(),
        maxPages: 50,
        crawlDepth: 3,
        batchSize: 10,
      }),
    });
    const startJson = (await startRes.json()) as {
      error?: string;
      data?: {
        crawlRunId: string;
        status: string;
        progress: { crawled: number; discovered: number };
      };
    };
    if (!startRes.ok || !startJson.data) {
      throw new Error(startJson.error || "Site crawl failed to start.");
    }

    let current = startJson.data;
    updateStep("site-crawl", {
      status: "running",
      detail: `Crawled ${current.progress.crawled} / ${current.progress.discovered} pages...`,
    });

    while (current.status === "running") {
      const stepRes = await fetch("/api/tasks/site-crawl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crawlRunId: current.crawlRunId,
          batchSize: 10,
        }),
      });
      const stepJson = (await stepRes.json()) as {
        error?: string;
        data?: {
          crawlRunId: string;
          status: string;
          progress: { crawled: number; discovered: number };
        };
      };
      if (!stepRes.ok || !stepJson.data) {
        throw new Error(stepJson.error || "Site crawl batch failed.");
      }
      current = stepJson.data;
      updateStep("site-crawl", {
        status: "running",
        detail: `Crawled ${current.progress.crawled} / ${current.progress.discovered} pages...`,
      });
    }

    updateStep("site-crawl", {
      status: "done",
      detail: `Completed (${current.progress.crawled} pages crawled)`,
    });
    return current.crawlRunId;
  }

  async function startAutoPilot() {
    if (!canRun) {
      setError("Pick a property with a Website URL in the Zero-Type Workspace first.");
      return;
    }
    setError(null);
    setRunning(true);
    setFinished(false);
    setSteps(PIPELINE_STEPS.map((s) => ({ id: s.id, label: s.label, status: "idle" })));

    let crawlRunId: string | undefined;

    try {
      if (selectedIds.has("site-crawl")) {
        crawlRunId = await runSiteCrawlLoop();
      } else {
        updateStep("site-crawl", { status: "skipped", detail: "Using latest existing Site Crawl" });
      }

      const propertyPayload = {
        name: activeProperty.name.trim(),
        brand: activeProperty.brand.trim() || "Independent",
        city: activeProperty.city.trim() || "US",
        state: (activeProperty.state.trim() || "US").slice(0, 2).toUpperCase(),
        url: activeProperty.url.trim(),
        allowedLocations: [],
        excludedLocations: [],
      };

      for (const step of PIPELINE_STEPS) {
        if (step.id === "site-crawl") continue;
        if (!selectedIds.has(step.id)) {
          updateStep(step.id, { status: "skipped" });
          continue;
        }

        updateStep(step.id, { status: "running", detail: "Running grounded AI + validation..." });
        try {
          const res = await fetch(`/api/tasks/${step.id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              property: propertyPayload,
              ...(crawlRunId ? { crawlRunId } : {}),
            }),
          });
          const json = (await res.json()) as {
            error?: string;
            data?: {
              status?: string;
              outputUrl?: string | null;
              flags?: Array<{ message: string }>;
              output?: { xlsxBase64?: string; combinedJsonLdScript?: string };
            };
          };
          if (!res.ok || !json.data) {
            throw new Error(json.error || `${step.label} failed`);
          }
          const isFlagged = json.data.status === "Flagged" || (json.data.flags?.length ?? 0) > 0;
          updateStep(step.id, {
            status: isFlagged ? "flagged" : "done",
            detail: isFlagged
              ? `${json.data.flags?.length ?? 1} flag(s) noted`
              : "Validated with 0 flags",
            outputUrl: json.data.outputUrl ?? null,
            xlsxBase64: json.data.output?.xlsxBase64 ?? null,
            jsonLdScript: json.data.output?.combinedJsonLdScript ?? null,
          });
        } catch (stepErr) {
          updateStep(step.id, {
            status: "error",
            detail: (stepErr as Error).message,
          });
        }
      }

      onCompleted();
      setFinished(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const completedCount = steps.filter((s) => s.status === "done" || s.status === "flagged").length;
  const activeTotal = selectedIds.size || 1;
  const pct = Math.min(100, Math.round((completedCount / activeTotal) * 100));

  return (
    <Card
      title="Auto-Pilot SEO Pipeline"
      subtitle="Automatically runs Site Crawl and chains your On-Page & Technical modules with zero typing."
      actions={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {canRun ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900">
            <span>
              Target Property: <strong>{activeProperty.name}</strong> ({activeProperty.url})
            </span>
            <span className="font-semibold">{pct}% complete</span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            Select a property with a URL from <strong>Pick Trained Client</strong> or <strong>1-Click Presets</strong> first.
          </div>
        )}

        {(running || finished) && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <div className="space-y-2">
          {steps.map((step) => {
            const checked = selectedIds.has(step.id);
            return (
              <div
                key={step.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5"
              >
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    disabled={running}
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(step.id);
                      else next.delete(step.id);
                      setSelectedIds(next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <span>{step.label}</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {step.detail && <span className="text-[11px] text-slate-500">{step.detail}</span>}
                  {step.status === "running" && (
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                      Running
                    </span>
                  )}
                  {step.status === "done" && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      Done
                    </span>
                  )}
                  {step.status === "flagged" && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Flagged
                    </span>
                  )}
                  {step.status === "error" && (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                      Error
                    </span>
                  )}
                  {step.outputUrl && (
                    <a
                      href={step.outputUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-hilton hover:bg-slate-100"
                    >
                      Open
                    </a>
                  )}
                  {step.xlsxBase64 && (
                    <button
                      type="button"
                      onClick={() => downloadXlsx(step.xlsxBase64!, `${step.id}.xlsx`)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      .xlsx
                    </button>
                  )}
                  {step.jsonLdScript && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(step.jsonLdScript!);
                        setCopiedStepId(step.id);
                        setTimeout(() => setCopiedStepId(null), 2000);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {copiedStepId === step.id ? "Copied" : "Copy JSON-LD"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <Button variant="primary" disabled={running || !canRun} onClick={() => void startAutoPilot()}>
            {running ? "Running Auto-Pilot..." : finished ? "Re-Run Auto-Pilot" : "Start Auto-Pilot"}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenStudio}>
              Next: Keyword Matrix &rarr;
            </Button>
            <Button variant="secondary" onClick={onOpenVisibilityDeck}>
              Next: Visibility Deck &rarr;
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

