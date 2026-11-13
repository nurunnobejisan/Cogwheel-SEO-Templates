"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { TASK_SECTIONS, TASKS_CONFIG, type TaskConfig, type TaskSection, type TaskStatus } from "@/tasks/tasks.config";
import { SiteCrawlCard } from "./SiteCrawlCard";
import { SeoVisibilityReportModal } from "./SeoVisibilityReportModal";
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
  const [showVisibilityReport, setShowVisibilityReport] = useState(false);
  const [activeCrawlTask, setActiveCrawlTask] = useState<"title-meta" | "heading-structure" | null>(null);
  const [tmProp, setTmProp] = useState({ name: "", brand: "", city: "", state: "" });
  const [tmBusy, setTmBusy] = useState(false);
  const [tmError, setTmError] = useState<string | null>(null);

  async function refreshRuns() {
    const implemented = TASKS_CONFIG.filter((t) => t.phase === 1 || t.status === "Done");
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
    if (task.phase !== 1 && task.status !== "Done") return;
    if (task.id === "seo-only-visibility-report") {
      setShowVisibilityReport(true);
      return;
    }
    if (task.id === "site-crawl") {
      setShowSiteCrawl(true);
      return;
    }
    if (task.id === "title-meta" || task.id === "heading-structure") {
      setActiveCrawlTask(task.id);
      return;
    }
    if (task.id === "usp-headline-optimization") {
      setStudioStep(4);
    } else {
      setStudioStep(1);
    }
    setView("studio");
  }

  async function runCrawlBasedTask() {
    if (!activeCrawlTask) return;
    setTmError(null);
    setTmBusy(true);
    try {
      const res = await fetch(`/api/tasks/${activeCrawlTask}/run`, {
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
      if (!res.ok) throw new Error(json.error || "Task execution failed.");
      await refreshRuns();
      setActiveCrawlTask(null);
    } catch (e) {
      setTmError((e as Error).message);
    } finally {
      setTmBusy(false);
    }
  }

  const sectionTasks = TASKS_CONFIG.filter((t) => t.section === activeTab);
  const readyCount = TASKS_CONFIG.filter((t) => t.phase === 1 || t.status === "Done").length;
  const runList = Object.values(latestRuns);
  const flaggedCount = runList.filter((r) => r.flags.length > 0 || r.status === "Flagged").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-4">
            <a
              href="https://razibmarketing.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center transition-opacity hover:opacity-90"
              title="Razib Marketing"
            >
              <Image
                src="/razib-marketing-logo.png"
                alt="Razib Marketing"
                width={172}
                height={42}
                priority
                className="h-9 w-auto object-contain"
              />
            </a>
            <div className="hidden h-7 w-px bg-slate-200 sm:block" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-bold tracking-tight text-slate-900">
                  Hotel SEO &amp; GEO Studio
                </h1>
                <span className="rounded-full border border-brand/40 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800">
                  Hospitality Automation
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Direct-booking growth workflows across On Page, Technical, Off Page, Local &amp; Reporting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                view === "dashboard"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Property Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                setStudioStep(1);
                setView("studio");
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                view === "studio"
                  ? "bg-brand text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Keyword &amp; Content Studio
            </button>
          </div>
        </div>
      </header>

      {view === "studio" ? (
        <Studio key={studioStep} initialStep={studioStep} />
      ) : (
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-hilton-dark p-6 text-white shadow-card sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/20 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-light">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  Razib Marketing · Hospitality SEO &amp; GEO
                </div>
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Automate Direct-Booking SEO, Audits &amp; Client Decks
                </h2>
                <p className="text-sm text-slate-300">
                  Run grounded site crawls, 78-keyword research matrices, on-page optimizations, and monthly PowerPoint visibility reports from one unified workspace.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-medium text-slate-300">
                  <span className="rounded-lg bg-white/10 px-2.5 py-1">1. Site Crawl</span>
                  <span className="text-slate-500">&rarr;</span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1">2. Keyword Matrix</span>
                  <span className="text-slate-500">&rarr;</span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1">3. On-Page &amp; Technical</span>
                  <span className="text-slate-500">&rarr;</span>
                  <span className="rounded-lg bg-brand/20 px-2.5 py-1 text-brand-light">4. Visibility Deck</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    setStudioStep(1);
                    setView("studio");
                  }}
                >
                  Open Keyword &amp; Content Studio
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("Reporting");
                    setShowVisibilityReport(true);
                  }}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Monthly Visibility Deck
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Active Modules
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-extrabold text-slate-900">{readyCount}</span>
                <span className="text-xs text-slate-500">/ {TASKS_CONFIG.length} tasks</span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.round((readyCount / TASKS_CONFIG.length) * 100)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Recorded Runs
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-extrabold text-slate-900">{runList.length}</span>
                <span className="text-xs text-slate-500">latest executions</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Synced with task history &amp; audit trail</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Attention Needed
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-extrabold text-slate-900">{flaggedCount}</span>
                <span className="text-xs text-slate-500">flagged runs</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Auto-validated with Flag Summaries</p>
            </div>

            <div className="rounded-2xl border border-brand/40 bg-gradient-to-br from-brand-50 via-white to-hilton-light/40 p-4 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Razib Marketing Focus
              </div>
              <div className="mt-1 font-display text-sm font-bold text-slate-900">
                Direct Bookings &amp; AI/GEO Readiness
              </div>
              <a
                href="https://razibmarketing.com/"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-hilton underline decoration-hilton/40 underline-offset-2 hover:text-hilton-dark"
              >
                razibmarketing.com
              </a>
            </div>
          </section>

          <nav aria-label="Task Sections" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {TASK_SECTIONS.map((section) => {
              const count = TASKS_CONFIG.filter((t) => t.section === section).length;
              const isActive = activeTab === section;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => setActiveTab(section)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {isActive && <span className="h-2 w-2 rounded-full bg-brand" />}
                  <span>{section}</span>
                  <span className="text-xs opacity-75">({count})</span>
                </button>
              );
            })}
          </nav>

          {(activeTab === "Technical" || showSiteCrawl) && (
            <SiteCrawlCard onCompleted={() => void refreshRuns()} />
          )}

          {activeCrawlTask && (
            <Card
              title={activeCrawlTask === "title-meta" ? "Title_Meta Description" : "Heading Structure Optimization"}
              subtitle="Uses the latest Site Crawl run and approved Keyword Research keywords."
              actions={
                <Button variant="ghost" onClick={() => setActiveCrawlTask(null)}>
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
                <Button variant="primary" disabled={tmBusy} onClick={() => void runCrawlBasedTask()}>
                  {tmBusy ? "Generating..." : "Run Task"}
                </Button>
              </div>
            </Card>
          )}

          {showVisibilityReport && (
            <SeoVisibilityReportModal
              onClose={() => setShowVisibilityReport(false)}
              onCompleted={() => void refreshRuns()}
            />
          )}

          <Card
            title={`${activeTab} Tasks`}
            subtitle={`Active modules run through the shared validation pipeline with automatic Flag Summaries.`}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {sectionTasks.map((task) => {
                const run = latestRuns[task.id];
                const isImplemented = task.phase === 1 || task.status === "Done";
                const effectiveStatus: TaskStatus = run?.status ?? (task.phase === 1 ? "Not started" : task.status);
                const disabled = !isImplemented;

                return (
                  <div
                    key={task.id}
                    className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 transition-all ${
                      disabled
                        ? "border-slate-200/70 bg-slate-50/60 opacity-80"
                        : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-card"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="font-display text-sm font-bold text-slate-900">{task.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[effectiveStatus]}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                effectiveStatus === "Done"
                                  ? "bg-emerald-500"
                                  : effectiveStatus === "Flagged"
                                    ? "bg-amber-500"
                                    : effectiveStatus === "Running"
                                      ? "animate-pulse bg-sky-500"
                                      : "bg-slate-400"
                              }`}
                            />
                            {effectiveStatus}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {task.outputType}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">{task.description}</p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {task.dataSources.map((src) => (
                          <span
                            key={src}
                            className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                          >
                            {src}
                          </span>
                        ))}
                        {task.dependsOn.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            Requires: {task.dependsOn.join(", ")}
                          </span>
                        )}
                      </div>
                      {run && run.flags.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Flag Summary ({run.flags.length}): {run.flags.map((f) => f.message).slice(0, 2).join(" | ")}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        {run?.outputUrl ? (
                          <a
                            href={run.outputUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-hilton underline decoration-hilton/40 underline-offset-2 hover:text-hilton-dark"
                          >
                            View Output
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {disabled ? `Scheduled for Phase ${task.phase}` : "Ready to run"}
                          </span>
                        )}
                      </div>
                      <Button
                        variant={disabled ? "secondary" : "primary"}
                        disabled={disabled}
                        onClick={() => handleRunTask(task)}
                        title={disabled ? `Scheduled for Phase ${task.phase}` : `Run ${task.name}`}
                      >
                        {disabled ? `Phase ${task.phase}` : "Run Task"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-brand" />
              <span>
                Powered by <strong className="text-slate-700">Razib Marketing</strong> — Digital Marketing &amp; SEO Automation for Hotels
              </span>
            </div>
            <a
              href="https://razibmarketing.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              razibmarketing.com
            </a>
          </footer>
        </main>
      )}
    </div>
  );
}

