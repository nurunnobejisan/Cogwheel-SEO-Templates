"use client";

import { useEffect, useState } from "react";
import { TASK_SECTIONS, TASKS_CONFIG, type TaskConfig, type TaskSection, type TaskStatus } from "@/tasks/tasks.config";
import { SiteCrawlCard } from "./SiteCrawlCard";
import Studio from "./Studio";
import { Button, Card } from "./ui";

interface TaskRunSummary {
  id: string;
  taskId: string;
  status: TaskStatus;
  outputUrl: string | null;
  flags: Array<{ code: string; message: string; severity: string }>;
  createdAt: string;
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  "Not started": "bg-slate-100 text-slate-600 border-slate-200",
  Running: "bg-sky-50 text-sky-700 border-sky-200",
  Done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Flagged: "bg-amber-50 text-amber-800 border-amber-200",
};

export default function PropertyDashboard() {
  const [view, setView] = useState<"dashboard" | "studio">("dashboard");
  const [studioStep, setStudioStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeTab, setActiveTab] = useState<TaskSection>("On Page");
  const [latestRuns, setLatestRuns] = useState<Record<string, TaskRunSummary>>({});
  const [showSiteCrawl, setShowSiteCrawl] = useState(false);
  const [showTitleMeta, setShowTitleMeta] = useState(false);
  const [tmProp, setTmProp] = useState({ name: "", brand: "", city: "", state: "" });
  const [tmBusy, setTmBusy] = useState(false);
  const [tmError, setTmError] = useState<string | null>(null);

  async function refreshRuns() {
    const implemented = TASKS_CONFIG.filter((t) => t.phase === 1);
    const entries = await Promise.all(
      implemented.map(async (task) => {
        try {
          const res = await fetch(`/api/tasks/${task.id}/runs`);
          if (!res.ok) return null;
          const data = (await res.json()) as { runs?: TaskRunSummary[] };
          const latest = data.runs?.[0];
          return latest ? ([task.id, latest] as const) : null;
        } catch {
          return null;
        }
      }),
    );
    const map: Record<string, TaskRunSummary> = {};
    for (const entry of entries) {
      if (entry) map[entry[0]] = entry[1];
    }
    setLatestRuns(map);
  }

  useEffect(() => {
    void refreshRuns();
  }, [view]);

  function handleRunTask(task: TaskConfig) {
    if (task.phase !== 1) return;
    if (task.id === "site-crawl") {
      setShowSiteCrawl(true);
      return;
    }
    if (task.id === "title-meta") {
      setShowTitleMeta(true);
      return;
    }
    if (task.id === "usp-headline-optimization") {
      setStudioStep(4);
    } else {
      setStudioStep(1);
    }
    setView("studio");
  }

  async function runTitleMeta() {
    setTmError(null);
    setTmBusy(true);
    try {
      const res = await fetch("/api/tasks/title-meta/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: {
            name: tmProp.name.trim(),
            brand: tmProp.brand.trim(),
            city: tmProp.city.trim(),
            state: tmProp.state.trim().toUpperCase(),
            allowedLocations: [],
            excludedLocations: [],
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Title & Meta generation failed.");
      await refreshRuns();
      setShowTitleMeta(false);
    } catch (e) {
      setTmError((e as Error).message);
    } finally {
      setTmBusy(false);
    }
  }

  const sectionTasks = TASKS_CONFIG.filter((t) => t.section === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
              Hotel SEO Automation Studio
            </h1>
            <p className="text-xs text-slate-500">
              Unified property workflow across On Page, Technical, Off Page, Local, and Reporting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={view === "dashboard" ? "primary" : "secondary"}
              onClick={() => setView("dashboard")}
            >
              Property Dashboard
            </Button>
            <Button
              variant={view === "studio" ? "primary" : "secondary"}
              onClick={() => {
                setStudioStep(1);
                setView("studio");
              }}
            >
              Keyword &amp; Content Studio
            </Button>
          </div>
        </div>
      </header>

      {view === "studio" ? (
        <Studio key={studioStep} initialStep={studioStep} />
      ) : (
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <nav aria-label="Task Sections" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {TASK_SECTIONS.map((section) => {
              const count = TASKS_CONFIG.filter((t) => t.section === section).length;
              const isActive = activeTab === section;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => setActiveTab(section)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {section} <span className="ml-1 text-xs opacity-75">({count})</span>
                </button>
              );
            })}
          </nav>

          {(activeTab === "Technical" || showSiteCrawl) && (
            <SiteCrawlCard onCompleted={() => void refreshRuns()} />
          )}

          {showTitleMeta && (
            <Card
              title="Title_Meta Description"
              subtitle="Uses the latest Site Crawl run and approved Keyword Research keywords."
              actions={
                <Button variant="ghost" onClick={() => setShowTitleMeta(false)}>
                  Close
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Property Name"
                    value={tmProp.name}
                    onChange={(e) => setTmProp({ ...tmProp, name: e.target.value })}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Brand (e.g. Tapestry Collection)"
                    value={tmProp.brand}
                    onChange={(e) => setTmProp({ ...tmProp, brand: e.target.value })}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="City"
                    value={tmProp.city}
                    onChange={(e) => setTmProp({ ...tmProp, city: e.target.value })}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="State (2-letter)"
                    value={tmProp.state}
                    onChange={(e) => setTmProp({ ...tmProp, state: e.target.value })}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
                  />
                </div>
                {tmError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                    {tmError}
                  </div>
                )}
                <Button variant="primary" disabled={tmBusy} onClick={() => void runTitleMeta()}>
                  {tmBusy ? "Generating..." : "Generate Title & Meta Doc"}
                </Button>
              </div>
            </Card>
          )}

          <Card
            title={`${activeTab} Tasks`}
            subtitle={`Phase 1 tasks are active. Phase 2 and Phase 3 tasks are registered and disabled until implemented.`}
          >
            <div className="divide-y divide-slate-100">
              {sectionTasks.map((task) => {
                const run = latestRuns[task.id];
                const effectiveStatus: TaskStatus = run?.status ?? (task.phase === 1 ? "Not started" : task.status);
                const disabled = task.phase !== 1;

                return (
                  <div
                    key={task.id}
                    className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-display text-sm font-bold text-slate-900">{task.name}</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[effectiveStatus]}`}
                        >
                          {effectiveStatus}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase text-slate-600">
                          {task.outputType}
                        </span>
                        {disabled && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Phase {task.phase}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{task.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>Sources: {task.dataSources.join(", ")}</span>
                        {task.dependsOn.length > 0 && <span>Depends on: {task.dependsOn.join(", ")}</span>}
                      </div>
                      {run && run.flags.length > 0 && (
                        <div className="mt-1 text-xs text-amber-700">
                          Flag Summary ({run.flags.length}): {run.flags.map((f) => f.message).slice(0, 2).join(" | ")}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {run?.outputUrl && (
                        <a
                          href={run.outputUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                        >
                          View Output
                        </a>
                      )}
                      <Button
                        variant={disabled ? "secondary" : "primary"}
                        disabled={disabled}
                        onClick={() => handleRunTask(task)}
                        title={disabled ? `Scheduled for Phase ${task.phase}` : `Run ${task.name}`}
                      >
                        Run
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </main>
      )}
    </div>
  );
}

