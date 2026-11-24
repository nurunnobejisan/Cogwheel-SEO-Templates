"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import trainedPropertiesData from "@/data/trained-properties.json";
import { TASK_SECTIONS, TASKS_CONFIG, type TaskConfig, type TaskSection, type TaskStatus } from "@/tasks/tasks.config";
import { Button, Card } from "./ui";

interface TrainedProperty {
  name: string;
  brand: string;
  city: string;
  state: string;
  url: string;
  propertyType: string;
  category: string;
  projectType: string;
  status: string;
}

const TRAINED_PROPERTIES = trainedPropertiesData as TrainedProperty[];

const Studio = dynamic(() => import("./Studio"), {
  loading: () => (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />
    </div>
  ),
});
const SiteCrawlCard = dynamic(() => import("./SiteCrawlCard").then((m) => m.SiteCrawlCard));
const AiTrainingModal = dynamic(() => import("./AiTrainingModal").then((m) => m.AiTrainingModal));
const ClientDeliverablesModal = dynamic(() =>
  import("./ClientDeliverablesModal").then((m) => m.ClientDeliverablesModal),
);
const GeoReadinessRadar = dynamic(() =>
  import("./GeoReadinessRadar").then((m) => m.GeoReadinessRadar),
);
const CompsetRankingMatrix = dynamic(() =>
  import("./CompsetRankingMatrix").then((m) => m.CompsetRankingMatrix),
);
const RunHistoryDrawer = dynamic(() => import("./RunHistoryDrawer").then((m) => m.RunHistoryDrawer));
const AutoPilotModal = dynamic(() => import("./AutoPilotModal").then((m) => m.AutoPilotModal));
const ComingSoonModal = dynamic(() =>
  import("./ComingSoonModal").then((m) => m.ComingSoonModal),
);
const LabsView = dynamic(() => import("./LabsView").then((m) => m.LabsView));
const VisibilitySuiteModal = dynamic(() =>
  import("./VisibilitySuiteModal").then((m) => m.VisibilitySuiteModal),
);
const CommandPalette = dynamic(() =>
  import("./CommandPalette").then((m) => m.CommandPalette),
);
const SitemapAuditModal = dynamic(() =>
  import("./SitemapAuditModal").then((m) => m.SitemapAuditModal),
);
const KeywordResearchView = dynamic(() =>
  import("./KeywordResearchView").then((m) => m.KeywordResearchView),
);

const CRAWL_TASK_IDS = new Set([
  "title-meta",
  "heading-structure",
  "technical-audit",
  "image-optimization",
  "duplicate-content-audit",
  "schema-markup",
  "sitemap-navigation-optimization",
  "site-tech-re-audit-report",
  "compsets-keywords-analysis",
  "keyword-ranking-report-comp-set",
  "internal-kickoff-strategy-list",
  "email-outreach-formatting",
  "competitors-backlink-analysis",
  "backlinking-strategy-execution",
  "google-map-citation",
  "ai-seo-visibility-report",
  "final-seo-geo-project-report",
]);

const ACTIVE_PROPERTY_KEY = "razib_active_property_v1";

const QUICK_PROPERTY_PRESETS = [
  {
    name: "Renaissance Shoals Resort & Spa",
    brand: "Renaissance / Marriott",
    city: "Florence",
    state: "AL",
    url: "https://www.marriott.com/en-us/hotels/mslbr-renaissance-shoals-resort-and-spa/overview/",
  },
  {
    name: "The Curtis Denver",
    brand: "DoubleTree / Hilton",
    city: "Denver",
    state: "CO",
    url: "https://www.hilton.com/en/hotels/denchdt-the-curtis-denver/",
  },
  {
    name: "AC Hotel Bozeman Downtown",
    brand: "AC Hotels / Marriott",
    city: "Bozeman",
    state: "MT",
    url: "https://www.marriott.com/en-us/hotels/bznar-ac-hotel-bozeman-downtown/overview/",
  },
  {
    name: "Embassy Suites Minneapolis Downtown",
    brand: "Embassy Suites / Hilton",
    city: "Minneapolis",
    state: "MN",
    url: "https://www.hilton.com/en/hotels/mspsees-embassy-suites-minneapolis-downtown/",
  },
];

const OUTPUT_BADGE_STYLES: Record<string, string> = {
  slides: "bg-amber-50 text-amber-800 border-amber-200/80",
  pptx: "bg-orange-50 text-orange-800 border-orange-200/80",
  sheet: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
  doc: "bg-sky-50 text-sky-800 border-sky-200/80",
  json: "bg-violet-50 text-violet-800 border-violet-200/80",
};

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
  const [mainTab, setMainTab] = useState<"home" | "tasks" | "crawl" | "studio" | "geo" | "compset" | "labs" | "keywords">("home");
  const [labsSubTab, setLabsSubTab] = useState<"geo" | "compset" | "sandbox">("geo");
  const [studioStep, setStudioStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeTab, setActiveTab] = useState<TaskSection>("On Page");
  const [latestRuns, setLatestRuns] = useState<Record<string, TaskRunSummary>>({});
  const [showAiTraining, setShowAiTraining] = useState(false);
  const [deliverablesTab, setDeliverablesTab] = useState<"pptx" | "slides" | "preview" | "memo" | "email" | "deck" | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showAutoPilot, setShowAutoPilot] = useState(false);
  const [showVisibilitySuite, setShowVisibilitySuite] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSitemapAudit, setShowSitemapAudit] = useState(false);
  const [activeCrawlTask, setActiveCrawlTask] = useState<TaskConfig | null>(null);
  const [historyTask, setHistoryTask] = useState<TaskConfig | null>(null);
  const [comingSoonTask, setComingSoonTask] = useState<TaskConfig | null>(null);
  const [activeProperty, setActiveProperty] = useState({
    name: "",
    brand: "",
    city: "",
    state: "",
    url: "",
  });
  const [autofillUrl, setAutofillUrl] = useState("");
  const [autofillBusy, setAutofillBusy] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [showPropertyDetails, setShowPropertyDetails] = useState(false);
  const [tmProp, setTmProp] = useState({ name: "", brand: "", city: "", state: "" });
  const [tmBusy, setTmBusy] = useState(false);
  const [tmError, setTmError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "ready" | "upcoming">("ready");
  const [aiStatus, setAiStatus] = useState<{ provider: string; activeRules: number }>({
    provider: "Online AI",
    activeRules: 5,
  });

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("cogwheel_theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
        setIsDark(true);
        document.documentElement.classList.add("dark");
      } else {
        setIsDark(false);
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // ignore localStorage
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      try {
        window.localStorage.setItem("cogwheel_theme", "dark");
      } catch { }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        window.localStorage.setItem("cogwheel_theme", "light");
      } catch { }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false);
        setShowSitemapAudit(false);
        setShowAiTraining(false);
        setShowVisibilitySuite(false);
        setDeliverablesTab(null);
        setShowAutoPilot(false);
        setActiveCrawlTask(null);
        setHistoryTask(null);
        setComingSoonTask(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ACTIVE_PROPERTY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<typeof activeProperty>;
        setActiveProperty((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore invalid localStorage
    }
  }, []);

  const updateActiveProperty = (patch: Partial<typeof activeProperty>) => {
    setActiveProperty((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(ACTIVE_PROPERTY_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  async function handleAutoDetectProperty() {
    const target = autofillUrl.trim() || activeProperty.url.trim();
    if (!target) {
      setAutofillError("Paste a hotel URL first.");
      return;
    }
    setAutofillError(null);
    setAutofillBusy(true);
    try {
      const res = await fetch("/api/property-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const json = (await res.json()) as {
        error?: string;
        property?: { name: string; brand: string; city: string; state: string; url: string };
      };
      if (!res.ok || !json.property) {
        throw new Error(json.error || "Could not auto-detect property.");
      }
      updateActiveProperty(json.property);
      setAutofillUrl(json.property.url);
    } catch (err) {
      setAutofillError((err as Error).message);
    } finally {
      setAutofillBusy(false);
    }
  }

  const refreshRuns = useCallback(async () => {
    try {
      const [summaryRes, trainingRes] = await Promise.all([
        fetch("/api/tasks/summary", { cache: "no-store" }),
        fetch("/api/ai-training", { cache: "no-store" }),
      ]);
      if (summaryRes.ok) {
        const data = (await summaryRes.json()) as { runs?: Record<string, TaskRunSummary> };
        if (data.runs) setLatestRuns(data.runs);
      }
      if (trainingRes.ok) {
        const tData = (await trainingRes.json()) as {
          provider?: string;
          rules?: Array<{ active: boolean }>;
        };
        setAiStatus({
          provider: tData.provider || "Online AI",
          activeRules: (tData.rules ?? []).filter((r) => r.active).length,
        });
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    void refreshRuns();
  }, [mainTab, refreshRuns]);

  function handleRunTask(task: TaskConfig) {
    const isImplemented = task.phase === 1 || task.status === "Done";
    if (!isImplemented) {
      setComingSoonTask(task);
      return;
    }
    if (task.id === "seo-baseline-ai-visibility") {
      setDeliverablesTab("slides");
      return;
    }
    if (task.id === "seo-only-visibility-report") {
      setDeliverablesTab("pptx");
      return;
    }
    if (task.id === "site-crawl") {
      setMainTab("crawl");
      return;
    }
    if (CRAWL_TASK_IDS.has(task.id)) {
      setTmError(null);
      setTmProp({
        name: activeProperty.name || tmProp.name,
        brand: activeProperty.brand || tmProp.brand,
        city: activeProperty.city || tmProp.city,
        state: activeProperty.state || tmProp.state,
      });
      setActiveCrawlTask(task);
      return;
    }
    if (task.id === "keyword-research") {
      setMainTab("keywords");
      return;
    }
    if (task.id === "usp-headline-optimization") {
      setStudioStep(4);
    } else {
      setStudioStep(1);
    }
    setMainTab("studio");
  }

  async function runCrawlBasedTask() {
    if (!activeCrawlTask) return;
    setTmError(null);
    setTmBusy(true);
    try {
      const res = await fetch(`/api/tasks/${activeCrawlTask.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: {
            name: tmProp.name.trim(),
            brand: tmProp.brand.trim(),
            city: tmProp.city.trim(),
            state: tmProp.state.trim().toUpperCase(),
            ...(activeProperty.url.trim() ? { url: activeProperty.url.trim() } : {}),
            allowedLocations: [],
            excludedLocations: [],
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Task execution failed.");
      await refreshRuns();
      const completedTask = activeCrawlTask;
      setActiveCrawlTask(null);
      setHistoryTask(completedTask);
    } catch (e) {
      setTmError((e as Error).message);
    } finally {
      setTmBusy(false);
    }
  }

  const sectionTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TASKS_CONFIG.filter((t) => {
      if (t.section !== activeTab) return false;
      const isImplemented = t.phase === 1 || t.status === "Done";
      if (filterMode === "ready" && !isImplemented) return false;
      if (filterMode === "upcoming" && isImplemented) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.dataSources.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [activeTab, filterMode, searchQuery]);
  const readyCount = TASKS_CONFIG.filter((t) => t.phase === 1 || t.status === "Done").length;
  const runList = Object.values(latestRuns);
  const flaggedCount = runList.filter((r) => r.flags.length > 0 || r.status === "Flagged").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b0f19] dark:text-slate-100 transition-colors">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/95">
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
            <div className="hidden h-7 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  Hotel SEO &amp; GEO Studio
                </h1>
                <span className="rounded-full border border-brand/40 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-slate-800 dark:border-brand/30 dark:bg-brand-950/40 dark:text-brand-light">
                  v2.6.0
                </span>
                <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 md:inline-block">
                  Hospitality Automation
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Direct-booking growth workflows across On Page, Technical, Off Page, Local &amp; Reporting
              </p>
            </div>
          </div>
          <nav aria-label="Main Navigation" className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: "home", label: "Home" },
                { id: "keywords", label: "Keywords" },
                { id: "tasks", label: `Tasks (${readyCount})` },
                { id: "labs", label: "Labs" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMainTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${mainTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
              >
                {tab.label}
              </button>
            ))}
            <Link
              href="/templates"
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Templates
            </Link>
            <Link
              href="/strategy-matrix"
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Matrix
            </Link>
            <Link
              href="/architecture"
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Architecture
            </Link>
            <button
              type="button"
              onClick={() => setShowAiTraining((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${showAiTraining
                ? "bg-slate-900 text-brand-light shadow-sm dark:bg-slate-700 dark:text-brand-light"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
            >
              Train AI ({aiStatus.activeRules})
            </button>
            <a
              href="/cogwheel-chrome-extension.zip"
              download="cogwheel-chrome-extension.zip"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Download Chrome Extension (100-Point Live Inspector)"
            >
              <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Extension</span>
            </a>
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Open Command Palette (Cmd + K)"
            >
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-mono text-[10px] text-slate-400">Cmd K</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </nav>
        </div>
      </header>

      {mainTab === "studio" ? (
        <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Keyword Research Studio</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">78-keyword pool allocation, page-to-keyword matrix &amp; Hilton copy engine.</p>
            </div>
            <button
              type="button"
              onClick={() => setMainTab("tasks")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              &larr; Back to Tasks
            </button>
          </div>
          <Studio key={studioStep} initialStep={studioStep} initialProperty={activeProperty} />
        </div>
      ) : (
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-7">
          {mainTab === "home" && (
            <>
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between lg:items-center">
                  {/* Left: label + title + preset row */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-light dark:bg-brand dark:text-slate-950">
                        Active Property
                      </span>
                      <span className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-white">
                        {activeProperty.name
                          ? `${activeProperty.name}${activeProperty.brand ? ` · ${activeProperty.brand}` : ""}${activeProperty.city
                            ? ` · ${activeProperty.city}${activeProperty.state ? `, ${activeProperty.state}` : ""}`
                            : ""
                          }`
                          : "Select a client or paste a hotel URL"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        aria-label="Pick Trained Client Property"
                        value=""
                        onChange={(e) => {
                          const picked = TRAINED_PROPERTIES.find((p) => p.name === e.target.value);
                          if (picked) {
                            updateActiveProperty({
                              name: picked.name,
                              brand: picked.brand,
                              city: picked.city,
                              state: picked.state,
                              url: picked.url,
                            });
                            setAutofillUrl(picked.url);
                            setAutofillError(null);
                          }
                        }}
                        className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:border-brand focus:outline-none"
                      >
                        <option value="">Pick Trained Client ({TRAINED_PROPERTIES.length})...</option>
                        {TRAINED_PROPERTIES.map((p) => (
                          <option key={`${p.name}-${p.category}`} value={p.name}>
                            {p.name}
                            {p.category ? ` [${p.category}]` : ""}
                            {p.url ? " • URL" : ""}
                          </option>
                        ))}
                      </select>
                      {QUICK_PROPERTY_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            updateActiveProperty(preset);
                            setAutofillUrl(preset.url);
                            setAutofillError(null);
                          }}
                          className={`h-8 rounded-lg border px-2.5 text-xs font-semibold transition ${activeProperty.name === preset.name
                            ? "border-brand bg-brand-50 text-slate-900 dark:border-brand/60 dark:bg-brand-950/40 dark:text-brand-light"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                            }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: URL input + Auto-Fill + Edit — always a tight single row */}
                  <div className="flex shrink-0 items-center gap-2">
                    <input
                      type="url"
                      placeholder="Paste hotel URL..."
                      value={autofillUrl}
                      onChange={(e) => setAutofillUrl(e.target.value)}
                      className="h-8 w-44 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 sm:w-52"
                    />
                    <Button
                      variant="primary"
                      disabled={autofillBusy}
                      onClick={() => void handleAutoDetectProperty()}
                      className="h-8 shrink-0 py-0 text-xs"
                    >
                      {autofillBusy ? "Detecting..." : "Auto-Fill"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowPropertyDetails((v) => !v)}
                      className="h-8 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      {showPropertyDetails ? "Hide" : "Edit"}
                    </button>
                  </div>
                </div>

                {autofillError && (
                  <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                    {autofillError}
                  </div>
                )}

                {showPropertyDetails && (
                  <div className="mt-3 grid gap-2.5 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
                    <input
                      type="text"
                      placeholder="Property Name"
                      value={activeProperty.name}
                      onChange={(e) => updateActiveProperty({ name: e.target.value })}
                      className="input text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Brand"
                      value={activeProperty.brand}
                      onChange={(e) => updateActiveProperty({ brand: e.target.value })}
                      className="input text-xs"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={activeProperty.city}
                      onChange={(e) => updateActiveProperty({ city: e.target.value })}
                      className="input text-xs"
                    />
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="State"
                      value={activeProperty.state}
                      onChange={(e) => updateActiveProperty({ state: e.target.value.toUpperCase() })}
                      className="input text-xs uppercase"
                    />
                    <input
                      type="url"
                      placeholder="https://property-url.com"
                      value={activeProperty.url}
                      onChange={(e) => updateActiveProperty({ url: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                )}
              </section>

              <Card
                title="Automated SEO Workflow"
                subtitle="Follow steps 1 to 4 or launch Auto-Run Pipeline to execute Crawl + Audits automatically."
                actions={
                  <Button variant="primary" onClick={() => setShowAutoPilot(true)}>
                    Auto-Run Pipeline
                  </Button>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setMainTab("crawl")}
                    className="card-hover group flex flex-col justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white/80 p-4 text-left backdrop-blur-xs transition hover:border-brand dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-brand"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400">STEP 1</span>
                      {latestRuns["site-crawl"] ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                      )}
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-slate-900 group-hover:text-brand-dark dark:text-white dark:group-hover:text-brand">Site Crawl</div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Crawl pages, robots.txt &amp; sitemap.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMainTab("keywords");
                    }}
                    className="card-hover group flex flex-col justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white/80 p-4 text-left backdrop-blur-xs transition hover:border-brand dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-brand"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400">STEP 2</span>
                      {latestRuns["keyword-research"] ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                      )}
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-slate-900 group-hover:text-brand-dark dark:text-white dark:group-hover:text-brand">Keyword Research</div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Trained client benchmarks &amp; page mapping.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMainTab("tasks")}
                    className="card-hover group flex flex-col justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white/80 p-4 text-left backdrop-blur-xs transition hover:border-brand dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-brand"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400">STEP 3</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {Array.from(CRAWL_TASK_IDS).filter((id) => Boolean(latestRuns[id])).length}/
                        {CRAWL_TASK_IDS.size} Done
                      </span>
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-slate-900 group-hover:text-brand-dark dark:text-white dark:group-hover:text-brand">
                        On-Page &amp; Technical
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Title/Meta, Headings, Schema &amp; Audits.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliverablesTab("pptx")}
                    className="card-hover group flex flex-col justify-between gap-2 rounded-2xl border border-brand/50 bg-brand-50/50 p-4 text-left backdrop-blur-xs transition hover:border-brand hover:bg-brand-50 dark:border-brand/40 dark:bg-brand-950/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold tracking-wider text-brand-dark uppercase dark:text-brand">STEP 4</span>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
                      </span>
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-slate-900 group-hover:text-brand-dark dark:text-white dark:group-hover:text-brand">
                        Deliverables Studio
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        PPTX Deck, Slide Preview, Memo &amp; Email Dispatcher.
                      </p>
                    </div>
                  </button>
                </div>
              </Card>

              {/* Executive Intelligence & Visibility Suite Suite */}
              <section className="grid gap-4 sm:grid-cols-3">
                <div className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200 border-t-4 border-t-purple-500 bg-white p-5 shadow-sm dark:border-slate-800 dark:border-t-purple-500 dark:bg-slate-900">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                        AI Citation Engine
                      </span>
                      <span className="font-mono text-xs font-bold text-purple-700 dark:text-purple-400">
                        78% Ready
                      </span>
                    </div>
                    <h3 className="mt-2.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                      AI &amp; GEO Readiness Radar
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Audit ChatGPT Search, Google AI Overviews &amp; Perplexity citations across 5 schema pillars.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setLabsSubTab("geo");
                        setMainTab("labs");
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                      Inspect AI Readiness <span>&rarr;</span>
                    </button>
                  </div>
                </div>

                <div className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200 border-t-4 border-t-blue-500 bg-white p-5 shadow-sm dark:border-slate-800 dark:border-t-blue-500 dark:bg-slate-900">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        Local Comp-Set
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        84% Win
                      </span>
                    </div>
                    <h3 className="mt-2.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                      Local Comp-Set Intelligence
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Benchmark organic positions against top 3 local properties with keyword battleground metrics.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setLabsSubTab("compset");
                        setMainTab("labs");
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View Local Matrix <span>&rarr;</span>
                    </button>
                  </div>
                </div>

                <div className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200 border-t-4 border-t-brand bg-white p-5 shadow-sm dark:border-slate-800 dark:border-t-brand dark:bg-slate-900">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        VisibilitySuite.ai
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Connected
                      </span>
                    </div>
                    <h3 className="mt-2.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                      VisibilitySuite Data Connector
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Sync batch prompts, comp-set radars, and citation snapshots directly with your dashboard.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowVisibilitySuite(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      Connect &amp; Sync Data <span>&rarr;</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVisibilitySuite(true)}
                      className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                      Drop Batch File
                    </button>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-hover rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Active Modules
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">{readyCount}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">/ {TASKS_CONFIG.length} tasks</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.round((readyCount / TASKS_CONFIG.length) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {readyCount} Active &bull; {TASKS_CONFIG.length - readyCount} Coming Soon
                  </p>
                </div>

                <div className="card-hover rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Recorded Runs
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">{runList.length}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">latest executions</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Synced with Run History</p>
                </div>

                <div className="card-hover rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Attention Needed
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">{flaggedCount}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">flagged runs</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Auto-validated Flag Summaries</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAiTraining(true)}
                  className="card-hover rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-left shadow-card transition hover:border-emerald-300 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Online AI Engine
                  </div>
                  <div className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                    {aiStatus.provider}
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    {aiStatus.activeRules} trained rules active &rarr;
                  </p>
                </button>
              </section>
            </>
          )}

          {mainTab === "keywords" && (
            <KeywordResearchView
              activeProperty={activeProperty}
              onBackToDashboard={() => setMainTab("home")}
              onOpenCopyStudio={() => {
                setStudioStep(4);
                setMainTab("studio");
              }}
              onSelectProperty={(p) => updateActiveProperty(p)}
            />
          )}

          {(mainTab === "labs" || mainTab === "geo" || mainTab === "compset") && (
            <LabsView
              property={activeProperty}
              activeSubTab={mainTab === "geo" ? "geo" : mainTab === "compset" ? "compset" : labsSubTab}
              onSubTabChange={(tab) => setLabsSubTab(tab)}
              onRunDeckGeneration={() => setDeliverablesTab("pptx")}
              onExportMemo={() => setDeliverablesTab("memo")}
            />
          )}

          {mainTab === "crawl" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Site Crawl &amp; Auto-Pilot</h2>
                  <p className="text-xs text-slate-500">
                    Crawl your hotel website first, or run the full automated pipeline in one click.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setShowSitemapAudit(true)}>
                    Audit XML Sitemap
                  </Button>
                  <Button variant="primary" onClick={() => setShowAutoPilot(true)}>
                    Auto-Run Full Pipeline
                  </Button>
                </div>
              </div>
              <SiteCrawlCard defaultUrl={activeProperty.url} onCompleted={() => void refreshRuns()} />
            </div>
          )}

          {mainTab === "tasks" && (
            <>
              {/* Studio & Crawl Utilities inside Tasks */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Task Utilities
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Access underlying site crawler and 78-keyword matrix allocation for this property.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSitemapAudit(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-purple-400 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Audit /sitemap.xml
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainTab("crawl")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    Launch Site Crawl
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudioStep(1);
                      setMainTab("studio");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Open Keyword Studio
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
                <nav aria-label="Task Sections" className="flex flex-wrap gap-2">
                  {TASK_SECTIONS.map((section) => {
                    const count = TASKS_CONFIG.filter((t) => t.section === section).length;
                    const isActive = activeTab === section;
                    return (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setActiveTab(section)}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${isActive
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

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter tasks..."
                    aria-label="Filter tasks"
                    className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                  />
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-900">
                    {[
                      { id: "all", label: `All (${TASKS_CONFIG.length})` },
                      { id: "ready", label: `Active (${readyCount})` },
                      { id: "upcoming", label: `Coming Soon (${TASKS_CONFIG.length - readyCount})` },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setFilterMode(mode.id as "all" | "ready" | "upcoming")}
                        className={`rounded-lg px-2.5 py-1 transition ${filterMode === mode.id
                          ? "bg-slate-900 text-white dark:bg-brand dark:text-slate-950"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Card
                title={`${activeTab} Tasks`}
                subtitle="Active enterprise production modules run through the shared validation pipeline with automatic Flag Summaries and live LLM grounding."
              >
                {sectionTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-800/40">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {filterMode === "ready" && (activeTab === "Off Page" || activeTab === "Local")
                        ? `All ${activeTab} modules are upcoming roadmap releases (Coming Soon).`
                        : `No tasks match this filter in ${activeTab}.`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {filterMode === "ready" && (activeTab === "Off Page" || activeTab === "Local")
                        ? `Switch to "Coming Soon" or "All" to inspect the specifications and data inputs for these modules.`
                        : `Switch filter or clear your search query to preview other tasks.`}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={() => {
                          setFilterMode("all");
                          setSearchQuery("");
                        }}
                      >
                        Show All {activeTab} Tasks
                      </Button>
                      {(activeTab === "Off Page" || activeTab === "Local") && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setFilterMode("upcoming");
                            setSearchQuery("");
                          }}
                        >
                          View Coming Soon Modules
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {sectionTasks.map((task) => {
                      const run = latestRuns[task.id];
                      const isImplemented = task.phase === 1 || task.status === "Done";
                      const effectiveStatus: TaskStatus = run?.status ?? (task.phase === 1 ? "Not started" : task.status);
                      const disabled = !isImplemented;

                      return (
                        <div
                          key={task.id}
                          onClick={() => {
                            if (disabled) handleRunTask(task);
                          }}
                          className={`animate-fade-in flex flex-col justify-between gap-4 rounded-2xl border p-5 transition-all ${disabled
                            ? "cursor-pointer border-slate-200/80 bg-slate-50/70 hover:border-amber-300 hover:bg-white hover:shadow-card dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-amber-600/60 dark:hover:bg-slate-900"
                            : effectiveStatus === "Flagged"
                              ? "border-slate-200 border-l-4 border-l-amber-500 bg-white shadow-sm hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-card dark:border-slate-800 dark:bg-slate-900"
                              : effectiveStatus === "Done"
                                ? "border-slate-200 border-l-4 border-l-emerald-500 bg-white shadow-sm hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-card dark:border-slate-800 dark:bg-slate-900"
                                : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-card dark:border-slate-800 dark:bg-slate-900"
                            }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <span className="font-display text-sm font-bold text-slate-900 dark:text-white">{task.name}</span>
                              <div className="flex items-center gap-1.5">
                                {disabled ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Coming Soon
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[effectiveStatus]}`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${effectiveStatus === "Done"
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
                                )}
                                <span
                                  className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${disabled
                                    ? "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                    : OUTPUT_BADGE_STYLES[task.outputType] ?? "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                    }`}
                                >
                                  {disabled ? `Phase ${task.phase}` : task.outputType}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{task.description}</p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {task.dataSources.map((src) => (
                                <span
                                  key={src}
                                  className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400"
                                >
                                  {src}
                                </span>
                              ))}
                              {task.dependsOn.length > 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  Requires: {task.dependsOn.join(", ")}
                                </span>
                              )}
                            </div>
                            {run && run.flags.length > 0 && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                                Flag Summary ({run.flags.length}): {run.flags.map((f) => f.message).slice(0, 2).join(" | ")}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
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
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                  {disabled ? `Roadmap: Scheduled for Phase ${task.phase}` : "Ready to run"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isImplemented && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHistoryTask(task);
                                  }}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                                >
                                  History
                                </button>
                              )}
                              <Button
                                variant={disabled ? "secondary" : "primary"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRunTask(task);
                                }}
                                title={disabled ? `Coming Soon (Phase ${task.phase} Roadmap) — Click to inspect specifications` : `Run ${task.name}`}
                              >
                                {disabled ? "Coming Soon" : "Run Task"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-brand" />
              <span>
                Powered by <strong className="text-slate-700 dark:text-slate-200">Razib Marketing</strong> — Digital Marketing &amp; SEO Automation for Hotels
              </span>
            </div>
            <a
              href="https://razibmarketing.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:decoration-slate-700 dark:hover:text-white"
            >
              razibmarketing.com
            </a>
          </footer>
        </main>
      )}

      {(activeCrawlTask || showAiTraining || deliverablesTab || showAutoPilot || historyTask || comingSoonTask) && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-10 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveCrawlTask(null);
              setShowAiTraining(false);
              setDeliverablesTab(null);
              setShowAutoPilot(false);
              setHistoryTask(null);
              setComingSoonTask(null);
            }
          }}
        >
          <div className="w-full max-w-4xl">
            {activeCrawlTask && (
              <Card
                title={activeCrawlTask.name}
                subtitle="Uses the latest Site Crawl run and approved Keyword Research keywords."
                actions={
                  <Button variant="ghost" onClick={() => setActiveCrawlTask(null)}>
                    Close
                  </Button>
                }
              >
                <div className="space-y-4">
                  {tmProp.name && tmProp.brand && tmProp.city && tmProp.state ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900">
                      <span>
                        Ready for <strong>{tmProp.name}</strong> ({tmProp.brand} · {tmProp.city}, {tmProp.state})
                      </span>
                      <button
                        type="button"
                        onClick={() => setTmProp({ name: "", brand: "", city: "", state: "" })}
                        className="font-semibold underline underline-offset-2 hover:text-emerald-700"
                      >
                        Change Property
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-4">
                      <input
                        type="text"
                        placeholder="Property Name"
                        value={tmProp.name}
                        onChange={(e) => setTmProp({ ...tmProp, name: e.target.value })}
                        className="input text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Brand (e.g. Tapestry Collection)"
                        value={tmProp.brand}
                        onChange={(e) => setTmProp({ ...tmProp, brand: e.target.value })}
                        className="input text-xs"
                      />
                      <input
                        type="text"
                        placeholder="City"
                        value={tmProp.city}
                        onChange={(e) => setTmProp({ ...tmProp, city: e.target.value })}
                        className="input text-xs"
                      />
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="State (2-letter)"
                        value={tmProp.state}
                        onChange={(e) => setTmProp({ ...tmProp, state: e.target.value.toUpperCase() })}
                        className="input text-xs uppercase"
                      />
                    </div>
                  )}
                  {tmError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                      {tmError}
                    </div>
                  )}
                  <Button variant="primary" disabled={tmBusy} onClick={() => void runCrawlBasedTask()}>
                    {tmBusy ? "Generating..." : `Run ${activeCrawlTask.name}`}
                  </Button>
                </div>
              </Card>
            )}

            {showAiTraining && <AiTrainingModal onClose={() => setShowAiTraining(false)} />}

            {deliverablesTab && (
              <ClientDeliverablesModal
                initialTab={deliverablesTab}
                defaultProperty={{
                  name: activeProperty.name,
                  url: activeProperty.url,
                  city: activeProperty.city,
                  state: activeProperty.state,
                }}
                onClose={() => setDeliverablesTab(null)}
                onCompleted={() => void refreshRuns()}
              />
            )}

            {showAutoPilot && (
              <AutoPilotModal
                activeProperty={activeProperty}
                onClose={() => setShowAutoPilot(false)}
                onCompleted={() => void refreshRuns()}
                onOpenStudio={() => {
                  setShowAutoPilot(false);
                  setStudioStep(1);
                  setMainTab("studio");
                }}
                onOpenVisibilityDeck={() => {
                  setShowAutoPilot(false);
                  setActiveTab("Reporting");
                  setDeliverablesTab("pptx");
                }}
              />
            )}

            {historyTask && (
              <RunHistoryDrawer task={historyTask} onClose={() => setHistoryTask(null)} />
            )}

            {comingSoonTask && (
              <ComingSoonModal
                task={comingSoonTask}
                onClose={() => setComingSoonTask(null)}
                onPrioritized={() => void refreshRuns()}
              />
            )}
          </div>
        </div>
      )}

      {showVisibilitySuite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVisibilitySuite(false);
          }}
        >
          <div className="w-full max-w-2xl">
            <VisibilitySuiteModal
              property={activeProperty}
              onClose={() => setShowVisibilitySuite(false)}
              onImportBatch={(batch) => {
                updateActiveProperty(batch.property);
                if (batch.competitors && batch.competitors.length > 0) {
                  try {
                    window.localStorage.setItem("cogwheel_compset_override", JSON.stringify(batch.competitors));
                  } catch { }
                }
              }}
            />
          </div>
        </div>
      )}

      {showSitemapAudit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSitemapAudit(false);
          }}
        >
          <div className="w-full max-w-3xl">
            <SitemapAuditModal
              defaultUrl={activeProperty.url}
              onClose={() => setShowSitemapAudit(false)}
            />
          </div>
        </div>
      )}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onSelectProperty={(prop) => updateActiveProperty(prop)}
        onNavigateTab={(t) => setMainTab(t)}
        onNavigateLabsSubTab={(st) => setLabsSubTab(st)}
        onOpenDeliverables={(tab) => setDeliverablesTab(tab || "deck")}
        onOpenVisibilitySuite={() => setShowVisibilitySuite(true)}
        onOpenSitemapAudit={() => setShowSitemapAudit(true)}
        onOpenAiTraining={() => setShowAiTraining(true)}
        onRunAutoPilot={() => setShowAutoPilot(true)}
        onSelectTask={(task) => {
          if (task.id === "keyword-research") {
            setMainTab("keywords");
            return;
          }
          setActiveTab(task.section);
          setMainTab("tasks");
        }}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}

