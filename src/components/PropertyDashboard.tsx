"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import trainedPropertiesData from "@/data/trained-properties.json";
import { TASK_SECTIONS, TASKS_CONFIG, type TaskConfig, type TaskSection, type TaskStatus } from "@/tasks/tasks.config";
import { Button, Card, Stat } from "./ui";

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
const ImageOptimizationAuditModal = dynamic(() =>
  import("./ImageOptimizationAuditModal").then((m) => m.ImageOptimizationAuditModal),
);
const HeadingStructureAuditModal = dynamic(() =>
  import("./HeadingStructureAuditModal").then((m) => m.HeadingStructureAuditModal),
);
const KeywordResearchView = dynamic(() =>
  import("./KeywordResearchView").then((m) => m.KeywordResearchView),
);
const UnifiedSeoSuiteView = dynamic(() =>
  import("./UnifiedSeoSuiteView").then((m) => m.UnifiedSeoSuiteView),
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

const ACTIVE_PROPERTY_KEY = "seo_studio_active_property_v1";

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
  const [mainTab, setMainTab] = useState<"home" | "tasks" | "crawl" | "studio" | "geo" | "compset" | "labs" | "keywords" | "unified-seo">("home");
  const [labsSubTab, setLabsSubTab] = useState<"geo" | "compset" | "sandbox" | "templates" | "matrix" | "architecture">("geo");
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
  const [showImageAudit, setShowImageAudit] = useState(false);
  const [showHeadingAudit, setShowHeadingAudit] = useState(false);
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
    provider: "Checking…",
    activeRules: 0,
  });

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("seo_studio_theme");
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
        window.localStorage.setItem("seo_studio_theme", "dark");
      } catch { }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        window.localStorage.setItem("seo_studio_theme", "light");
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
          provider: tData.provider || "Provider not configured",
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
    if (task.id === "image-optimization") {
      setShowImageAudit(true);
      return;
    }
    if (task.id === "heading-structure") {
      setShowHeadingAudit(true);
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
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <a
              href="https://razibmarketing.com/"
              target="_blank"
              rel="noreferrer"
              title="Razib Marketing"
              className="shrink-0"
            >
              <Image
                src="/razib-marketing-logo.png"
                alt="Razib Marketing"
                width={172}
                height={42}
                priority
                className="h-8 w-auto object-contain"
              />
            </a>
            <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
            <div className="hidden min-w-0 sm:block">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-h3 font-bold tracking-tight text-slate-900 dark:text-white">
                  Hotel SEO &amp; GEO Studio
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-50 px-2 py-0.5 text-eyebrow font-semibold text-brand-800 dark:border-brand/30 dark:bg-brand-950/50 dark:text-brand-light">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  v3.0.0
                </span>
                <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-eyebrow font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 md:inline-block">
                  Hospitality Automation
                </span>
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2 py-0.5 text-eyebrow font-semibold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 lg:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Unified AI Engine Live
                </span>
              </div>
              <p className="mt-0.5 truncate text-caption text-slate-500 dark:text-slate-400">
                Direct-booking growth workflows across On-Page, Technical, Off-Page, Local &amp; Reporting
              </p>
            </div>
          </div>

          <nav aria-label="Main Navigation" className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
            {(
              [
                { id: "home", label: "Home" },
                { id: "unified-seo", label: "Unified SEO Suite" },
                { id: "keywords", label: "Keywords" },
                { id: "tasks", label: `Tasks (${readyCount})` },
                { id: "labs", label: "Labs" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMainTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-caption font-semibold transition-all ${
                  mainTab === tab.id
                    ? "bg-white text-slate-900 shadow-soft dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAiTraining((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-caption font-semibold transition-all ${
                showAiTraining
                  ? "bg-slate-900 text-brand-light shadow-soft dark:bg-slate-700 dark:text-brand-light"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
              }`}
            >
              Train AI ({aiStatus.activeRules})
            </button>
            <a
              href="/seo-studio.zip"
              download="seo-studio.zip"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-caption font-semibold text-slate-700 shadow-soft transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-caption font-semibold text-slate-700 shadow-soft transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Open Command Palette (Cmd + K)"
            >
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-mono text-eyebrow text-slate-400">Cmd K</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-soft transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
              <p className="text-caption text-slate-500 dark:text-slate-400">78-keyword pool allocation, page-to-keyword matrix &amp; Hilton copy engine.</p>
            </div>
            <button
              type="button"
              onClick={() => setMainTab("tasks")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              <section className="card overflow-hidden">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="eyebrow shrink-0">Active Property</span>
                      <span className="min-w-0 truncate font-display text-h3 font-bold text-slate-900 dark:text-white">
                        {activeProperty.name
                          ? `${activeProperty.name}${activeProperty.brand ? ` \u00b7 ${activeProperty.brand}` : ""}${
                              activeProperty.city
                                ? ` \u00b7 ${activeProperty.city}${activeProperty.state ? `, ${activeProperty.state}` : ""}`
                                : ""
                            }`
                          : (
                            <span className="font-sans font-normal text-slate-400 dark:text-slate-500">
                              Select a client or paste a hotel URL
                            </span>
                          )}
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
                        className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-caption font-semibold text-slate-700 transition focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="">Pick Trained Client ({TRAINED_PROPERTIES.length})...</option>
                        {TRAINED_PROPERTIES.map((p, idx) => (
                          <option key={`${p.name}-${p.category}-${idx}`} value={p.name}>
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
                          className={`h-9 rounded-xl border px-3 text-caption font-semibold transition ${
                            activeProperty.name === preset.name
                              ? "border-brand bg-brand-50 text-slate-900 dark:border-brand/60 dark:bg-brand-950/40 dark:text-brand-light"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex w-full items-center gap-2 lg:w-auto lg:shrink-0">
                    <input
                      type="url"
                      placeholder="Paste hotel URL..."
                      value={autofillUrl}
                      onChange={(e) => setAutofillUrl(e.target.value)}
                      className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-caption text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 lg:w-60"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={autofillBusy}
                      onClick={() => void handleAutoDetectProperty()}
                      className="h-9 shrink-0"
                    >
                      {autofillBusy ? "Detecting..." : "Auto-Fill"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowPropertyDetails((v) => !v)}
                      className="h-9 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-caption font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      {showPropertyDetails ? "Hide" : "Edit"}
                    </button>
                  </div>
                </div>

                {autofillError && (
                  <div className="mx-5 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-caption text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    {autofillError}
                  </div>
                )}

                {showPropertyDetails && (
                  <div className="grid gap-2.5 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Property Name"
                      value={activeProperty.name}
                      onChange={(e) => updateActiveProperty({ name: e.target.value })}
                      className="input text-caption"
                    />
                    <input
                      type="text"
                      placeholder="Brand"
                      value={activeProperty.brand}
                      onChange={(e) => updateActiveProperty({ brand: e.target.value })}
                      className="input text-caption"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={activeProperty.city}
                      onChange={(e) => updateActiveProperty({ city: e.target.value })}
                      className="input text-caption"
                    />
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="State"
                      value={activeProperty.state}
                      onChange={(e) => updateActiveProperty({ state: e.target.value.toUpperCase() })}
                      className="input text-caption uppercase"
                    />
                    <input
                      type="url"
                      placeholder="https://property-url.com"
                      value={activeProperty.url}
                      onChange={(e) => updateActiveProperty({ url: e.target.value })}
                      className="input text-caption"
                    />
                  </div>
                )}
              </section>

              <Card
                title="Automated SEO Workflow"
                subtitle="Follow steps 1–4, or launch the Auto-Run Pipeline to execute crawl and audits automatically."
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
                    className="card-hover group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/70 p-4 text-left shadow-soft transition-colors hover:border-emerald-500 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60 dark:hover:border-emerald-500/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-eyebrow font-bold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Step 1
                      </span>
                      {latestRuns["site-crawl"] ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        <span className="font-display text-h3 font-bold text-slate-900 transition-colors group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400">
                          Site Crawl
                        </span>
                      </div>
                      <p className="mt-1 text-caption text-slate-500 text-pretty dark:text-slate-400">
                        Autonomous crawl of pages, robots.txt &amp; sitemap.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-caption font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <span>Robots &amp; Sitemaps</span>
                      <span className="text-emerald-600 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400">&rarr;</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMainTab("keywords")}
                    className="card-hover group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/70 p-4 text-left shadow-soft transition-colors hover:border-blue-500 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60 dark:hover:border-blue-500/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-eyebrow font-bold uppercase text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        Step 2
                      </span>
                      {latestRuns["keyword-research"] ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        <span className="font-display text-h3 font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                          Keyword Research
                        </span>
                      </div>
                      <p className="mt-1 text-caption text-slate-500 text-pretty dark:text-slate-400">
                        78-formula matrix &amp; trained client benchmarks.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-caption font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <span>78 Mapped Queries</span>
                      <span className="text-blue-600 transition-transform group-hover:translate-x-0.5 dark:text-blue-400">&rarr;</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMainTab("tasks")}
                    className="card-hover group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/70 p-4 text-left shadow-soft transition-colors hover:border-brand dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60 dark:hover:border-brand/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-eyebrow font-bold uppercase text-slate-900 dark:bg-brand-950/60 dark:text-brand-light">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        Step 3
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-eyebrow font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {Array.from(CRAWL_TASK_IDS).filter((id) => Boolean(latestRuns[id])).length}/{CRAWL_TASK_IDS.size} Done
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-brand-dark dark:text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span className="font-display text-h3 font-bold text-slate-900 transition-colors group-hover:text-brand-dark dark:text-white dark:group-hover:text-brand">
                          On-Page &amp; Technical
                        </span>
                      </div>
                      <p className="mt-1 text-caption text-slate-500 text-pretty dark:text-slate-400">
                        Headings, Title/Meta, Schema &amp; Image Audits.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-caption font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <span>Pixel &amp; Alt Guardrails</span>
                      <span className="text-brand-dark transition-transform group-hover:translate-x-0.5 dark:text-brand">&rarr;</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliverablesTab("pptx")}
                    className="card-hover group flex flex-col justify-between rounded-2xl border border-purple-200/90 bg-gradient-to-b from-purple-50/60 via-white to-purple-50/20 p-4 text-left shadow-soft transition-colors hover:border-purple-500 dark:border-purple-900/60 dark:from-slate-900 dark:to-purple-950/20 dark:hover:border-purple-500/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2 py-0.5 text-eyebrow font-bold uppercase text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                        Step 4
                      </span>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        <span className="font-display text-h3 font-bold text-slate-900 transition-colors group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
                          Deliverables Studio
                        </span>
                      </div>
                      <p className="mt-1 text-caption text-slate-600 text-pretty dark:text-slate-400">
                        PPTX Deck, Slide Preview, Memo &amp; Email Dispatcher.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-purple-100 pt-2 text-caption font-medium text-purple-700 dark:border-purple-900/40 dark:text-purple-300">
                      <span>Export Suite</span>
                      <span>&rarr;</span>
                    </div>
                  </button>
                </div>
              </Card>

              {/* Executive intelligence & visibility */}
              <section className="grid gap-4 sm:grid-cols-3">
                <article className="card card-hover flex flex-col justify-between border-t-4 border-t-purple-500 p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-eyebrow font-bold uppercase text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                        AI Citation Engine
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-eyebrow font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        Not measured
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-h3 font-bold text-slate-900 dark:text-white">
                      AI &amp; GEO Readiness Radar
                    </h3>
                    <p className="mt-1.5 text-caption text-slate-500 text-pretty dark:text-slate-400">
                      Parse JSON-LD, answer coverage and entity signals. AI citations appear only when a visibility
                      provider is connected.
                    </p>
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-caption text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      No GEO measurement yet — run the audit in Labs.
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setLabsSubTab("geo");
                        setMainTab("labs");
                      }}
                      className="inline-flex items-center gap-1 text-caption font-semibold text-purple-700 transition-all hover:gap-2 dark:text-purple-400"
                    >
                      Inspect AI Readiness <span>&rarr;</span>
                    </button>
                  </div>
                </article>

                <article className="card card-hover flex flex-col justify-between border-t-4 border-t-blue-500 p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-eyebrow font-bold uppercase text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        Local Comp-Set
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-eyebrow font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        No data
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-h3 font-bold text-slate-900 dark:text-white">
                      Local Comp-Set Intelligence
                    </h3>
                    <p className="mt-1.5 text-caption text-slate-500 text-pretty dark:text-slate-400">
                      Compare verified organic positions against the competitors you enter.
                    </p>
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-caption text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      Add competitors and ranked keywords to calculate share of voice.
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setLabsSubTab("compset");
                        setMainTab("labs");
                      }}
                      className="inline-flex items-center gap-1 text-caption font-semibold text-blue-700 transition-all hover:gap-2 dark:text-blue-400"
                    >
                      View Local Matrix <span>&rarr;</span>
                    </button>
                  </div>
                </article>

                <article className="card card-hover flex flex-col justify-between border-t-4 border-t-brand p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-eyebrow font-bold uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        VisibilitySuite.ai
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-eyebrow font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Sync
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-h3 font-bold text-slate-900 dark:text-white">
                      VisibilitySuite Data Connector
                    </h3>
                    <p className="mt-1.5 text-caption text-slate-500 text-pretty dark:text-slate-400">
                      Sync batch prompts, comp-set radars, and citation snapshots directly with your dashboard.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-eyebrow text-slate-500 dark:text-slate-400">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">Batch Sync</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">JSON/CSV</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">Citation Radars</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowVisibilitySuite(true)}
                      className="inline-flex items-center gap-1 text-caption font-semibold text-emerald-700 transition-all hover:gap-2 dark:text-emerald-400"
                    >
                      Connect &amp; Sync Data <span>&rarr;</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVisibilitySuite(true)}
                      className="rounded-lg bg-emerald-50 px-2.5 py-1 text-eyebrow font-bold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                      Drop Batch File
                    </button>
                  </div>
                </article>
              </section>

              {/* Unified SEO Suite hero */}
              <section className="hero-gradient relative overflow-hidden rounded-3xl border border-brand/30 bg-white p-6 shadow-card sm:p-7 dark:border-brand/40 dark:bg-slate-900">
                <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-eyebrow font-bold uppercase text-slate-950">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                        Next-Gen Engine
                      </span>
                      <span className="rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-caption font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                        Claude-SEO + Open-SEO + FastMCP Search Console
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-title font-extrabold text-slate-900 dark:text-white">
                        Unified 11-Dimension Website Audit &amp; AI Search Engine
                      </h3>
                      <p className="mt-1.5 max-w-2xl text-body text-slate-600 text-pretty dark:text-slate-300">
                        Execute full multi-tier audits across technical health, headings, images, Search Console
                        cannibalization, and Generative Engine Optimization (GEO) with one click.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {[
                        "FastMCP GSC Server",
                        "20 Specialized SEO Agents",
                        "Open-SEO Diagnostic Catalog",
                        "Fine-Tuned SFT Model",
                      ].map((chip) => (
                        <span
                          key={chip}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-caption font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMainTab("unified-seo")}
                    className="inline-flex flex-shrink-0 items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-display text-body font-bold text-slate-900 shadow-glow transition-all duration-200 ease-out-expo hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
                  >
                    <span>Open Unified SEO Suite</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Active Modules"
                  value={
                    <>
                      {readyCount}
                      <span className="ml-1 text-body font-semibold text-slate-400 dark:text-slate-500">/ {TASKS_CONFIG.length}</span>
                    </>
                  }
                  tone="brand"
                  progress={Math.round((readyCount / TASKS_CONFIG.length) * 100)}
                  subtext={`${readyCount} active \u2022 ${TASKS_CONFIG.length - readyCount} coming soon`}
                />
                <Stat label="Recorded Runs" value={runList.length} subtext="Synced with Run History" />
                <Stat
                  label="Attention Needed"
                  value={flaggedCount}
                  tone={flaggedCount > 0 ? "warn" : "good"}
                  subtext="Auto-validated flag summaries"
                />
                <button
                  type="button"
                  onClick={() => setShowAiTraining(true)}
                  className="group flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-left shadow-soft transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow text-emerald-700 dark:text-emerald-400">Online AI Engine</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="mt-2 truncate font-display text-h3 font-bold text-slate-900 dark:text-white">
                    {aiStatus.provider}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-caption font-semibold text-emerald-700 dark:text-emerald-400">
                    {aiStatus.activeRules} trained rules active
                    <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </div>
                </button>
              </section>
            </>
          )}

          {mainTab === "unified-seo" && (
            <UnifiedSeoSuiteView
              property={activeProperty}
              onBackToDashboard={() => setMainTab("home")}
              onOpenImageAudit={() => setShowImageAudit(true)}
              onOpenHeadingAudit={() => setShowHeadingAudit(true)}
            />
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
              activeSubTab={
                mainTab === "geo"
                  ? "geo"
                  : mainTab === "compset"
                  ? "compset"
                  : labsSubTab
              }
              onSubTabChange={(tab) => setLabsSubTab(tab)}
              onRunDeckGeneration={() => setDeliverablesTab("pptx")}
              onExportMemo={() => setDeliverablesTab("memo")}
              onOpenImageAudit={() => setShowImageAudit(true)}
              onOpenHeadingAudit={() => setShowHeadingAudit(true)}
            />
          )}

          {mainTab === "crawl" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Site Crawl &amp; Auto-Pilot</h2>
                  <p className="text-caption text-slate-500">
                    Crawl your hotel website first, or run the full automated pipeline in one click.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setShowHeadingAudit(true)}>
                    Audit Headings
                  </Button>
                  <Button variant="secondary" onClick={() => setShowImageAudit(true)}>
                    Audit Images
                  </Button>
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
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-tiny font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Task Utilities
                  </span>
                  <span className="text-caption text-slate-500 dark:text-slate-400">
                    Access underlying site crawler and 78-keyword matrix allocation for this property.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHeadingAudit(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-caption font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                    </svg>
                    Audit Headings
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImageAudit(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-caption font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Audit Images
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSitemapAudit(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-caption font-semibold text-slate-700 transition hover:border-purple-400 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Audit /sitemap.xml
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainTab("crawl")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-caption font-semibold text-slate-700 transition hover:border-brand hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-caption font-semibold text-slate-700 transition hover:border-brand hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
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
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-body font-semibold transition-all ${isActive
                          ? "bg-slate-900 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                      >
                        {isActive && <span className="h-2 w-2 rounded-full bg-brand" />}
                        <span>{section}</span>
                        <span className="text-caption opacity-75">({count})</span>
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
                    className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                  />
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-tiny font-semibold dark:border-slate-800 dark:bg-slate-900">
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
                    <p className="text-body font-semibold text-slate-800 dark:text-slate-200">
                      {filterMode === "ready" && (activeTab === "Off Page" || activeTab === "Local")
                        ? `All ${activeTab} modules are upcoming roadmap releases (Coming Soon).`
                        : `No tasks match this filter in ${activeTab}.`}
                    </p>
                    <p className="text-caption text-slate-500 dark:text-slate-400">
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
                              <span className="font-display text-body font-bold text-slate-900 dark:text-white">{task.name}</span>
                              <div className="flex items-center gap-1.5">
                                {disabled ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-0.5 text-tiny font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Coming Soon
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-tiny font-semibold ${STATUS_STYLES[effectiveStatus]}`}
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
                                  className={`rounded-md border px-2 py-0.5 text-micro font-bold uppercase tracking-wide ${disabled
                                    ? "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                    : OUTPUT_BADGE_STYLES[task.outputType] ?? "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                    }`}
                                >
                                  {disabled ? `Phase ${task.phase}` : task.outputType}
                                </span>
                              </div>
                            </div>
                            <p className="text-caption leading-relaxed text-slate-600 dark:text-slate-400">{task.description}</p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {task.dataSources.map((src) => (
                                <span
                                  key={src}
                                  className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-micro font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400"
                                >
                                  {src}
                                </span>
                              ))}
                              {task.dependsOn.length > 0 && (
                                <span className="text-micro text-slate-400 dark:text-slate-500">
                                  Requires: {task.dependsOn.join(", ")}
                                </span>
                              )}
                            </div>
                            {run && run.flags.length > 0 && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-caption text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
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
                                  className="text-caption font-semibold text-hilton underline decoration-hilton/40 underline-offset-2 hover:text-hilton-dark"
                                >
                                  View Output
                                </a>
                              ) : (
                                <span className="text-tiny text-slate-400 dark:text-slate-500">
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
                                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-caption font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
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

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-6 text-caption text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-caption text-emerald-900">
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
                        className="input text-caption"
                      />
                      <input
                        type="text"
                        placeholder="Brand (e.g. Tapestry Collection)"
                        value={tmProp.brand}
                        onChange={(e) => setTmProp({ ...tmProp, brand: e.target.value })}
                        className="input text-caption"
                      />
                      <input
                        type="text"
                        placeholder="City"
                        value={tmProp.city}
                        onChange={(e) => setTmProp({ ...tmProp, city: e.target.value })}
                        className="input text-caption"
                      />
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="State (2-letter)"
                        value={tmProp.state}
                        onChange={(e) => setTmProp({ ...tmProp, state: e.target.value.toUpperCase() })}
                        className="input text-caption uppercase"
                      />
                    </div>
                  )}
                  {tmError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-caption text-rose-700">
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
                    window.localStorage.setItem("seo_studio_compset_override", JSON.stringify(batch.competitors));
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

      {showImageAudit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImageAudit(false);
          }}
        >
          <div className="w-full max-w-5xl">
            <ImageOptimizationAuditModal
              defaultUrl={activeProperty.url}
              onClose={() => setShowImageAudit(false)}
            />
          </div>
        </div>
      )}

      {showHeadingAudit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHeadingAudit(false);
          }}
        >
          <div className="w-full max-w-6xl">
            <HeadingStructureAuditModal
              defaultUrl={activeProperty.url}
              onClose={() => setShowHeadingAudit(false)}
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

