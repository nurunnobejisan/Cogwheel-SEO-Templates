import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Layers,
  Eye,
  PlayCircle,
  Settings,
  RotateCw,
  Moon,
  Sun,
  ExternalLink,
  Info,
  AlertCircle,
} from "lucide-react";
import { PageAuditData, ClientProfile } from "../types/extension";
import { PRESET_CLIENT_PROFILES, calculateSeoScores } from "../data/cogwheelTemplates";
import { ScoreGauge } from "../components/ScoreGauge";
import { SerpSocialPreview } from "../components/SerpSocialPreview";
import { QuickWinsList } from "../components/QuickWinsList";
import { TemplateStudio } from "../components/TemplateStudio";
import { DomOverlayInspector } from "../components/DomOverlayInspector";
import { AutomationBulkRunner } from "../components/AutomationBulkRunner";
import { SettingsBrandProfiles } from "../components/SettingsBrandProfiles";
import { isRestrictedUrl } from "../utils/urlSecurity";

export function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "studio" | "overlay" | "automation" | "settings"
  >("dashboard");

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [targetTemplateId, setTargetTemplateId] = useState<string | undefined>();
  const [activeProfile, setActiveProfile] = useState<ClientProfile>(PRESET_CLIENT_PROFILES[0]);
  const [activeTabId, setActiveTabId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [isRestrictedTab, setIsRestrictedTab] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  // Default fallback mock data
  const [pageData, setPageData] = useState<PageAuditData>({
    url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    origin: "https://www.marriott.com",
    pathname: "/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    protocol: "https:",
    hostname: "www.marriott.com",
    title: "Beachfront Hotels Panama City Beach | SpringHill Suites Panama City Beachfront",
    metaDesc: "Stay beachfront at SpringHill Suites Panama City Beach. Enjoy oceanfront suites, lazy river pool, free breakfast, and direct Gulf access. Book direct & save.",
    canonical: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    h1Elements: ["SpringHill Suites Panama City Beachfront"],
    h2Elements: [
      "Oceanfront Suites & Amenities",
      "Resort Amenities & Lazy River",
      "Dining & Beachfront Bar",
      "Panama City Beach Attractions Nearby",
    ],
    h3Elements: ["King Suite", "Double Queen Suite", "Gulf View Studio"],
    totalImages: 24,
    imagesWithoutAlt: 2,
    oversizedImages: 1,
    words: 680,
    schemas: [
      {
        "@type": "Hotel",
        name: "SpringHill Suites Panama City Beachfront",
        address: { addressLocality: "Panama City Beach", addressRegion: "FL" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Home" }, { name: "Panama City Beach Hotels" }],
      },
    ],
    links: { internal: 42, external: 8, nofollow: 2 },
    hasViewport: true,
    hasOgTitle: true,
    hasOgImage: true,
    ogTitle: "SpringHill Suites Panama City Beachfront",
    ogDescription: "Stay beachfront with oceanfront suites and lazy river.",
    ogImage: "https://cache.marriott.com/content/dam/marriott-renditions/ECPSB/ecpsb-exterior-001.jpg",
  });

  const fetchActivePage = async () => {
    setLoading(true);
    try {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          setActiveTabId(tab.id);

          if (isRestrictedUrl(tab.url)) {
            setIsRestrictedTab(true);
            setNeedsReload(false);
            setLoading(false);
            return;
          }

          setIsRestrictedTab(false);
          chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_DATA" }, (res) => {
            if (chrome.runtime.lastError) {
              setNeedsReload(true);
              setLoading(false);
              return;
            }
            if (res && res.data) {
              setPageData(res.data);
              setNeedsReload(false);
              // Update badge
              const sc = calculateSeoScores(res.data);
              chrome.runtime.sendMessage({
                type: "UPDATE_BADGE",
                tabId: tab.id,
                score: sc.overall,
              }, () => {
                if (chrome.runtime.lastError) {}
              });
            }
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivePage();

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      const listener = (msg: any) => {
        if (msg.type === "AUTO_PAGE_CONTEXT_UPDATED" && msg.data) {
          setPageData(msg.data);
          if (msg.tabId) setActiveTabId(msg.tabId);
        } else if (msg.type === "NAVIGATE_TAB") {
          if (msg.tab) setActiveTab(msg.tab);
          if (msg.templateId) setTargetTemplateId(msg.templateId);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  const scores = calculateSeoScores(pageData);

  const handleFixWithTemplate = (templateId: string) => {
    setTargetTemplateId(templateId);
    setActiveTab("studio");
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      <div className="flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 p-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_8px_#10b981]" />
              <span className="font-display text-xs font-black tracking-wider text-slate-900 dark:text-white uppercase">
                COGWHEEL SEO STUDIO
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                v2.6
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={fetchActivePage}
                title="Re-scan active page"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Toggle Theme"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                {isDarkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
              </button>
            </div>
          </div>

          {/* Active URL bar */}
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {isRestrictedTab ? "SYSTEM" : pageData.protocol.replace(":", "").toUpperCase()}
            </span>
            <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
              {isRestrictedTab ? "System / New Tab Page" : pageData.hostname}
            </span>
            <span className="truncate text-[10px] text-slate-400">
              {isRestrictedTab ? "(Offline Studio Mode)" : pageData.pathname}
            </span>
          </div>

          {/* System Page Notice Banner */}
          {isRestrictedTab && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-sky-800/40 bg-sky-950/40 p-2.5 text-[11px] text-sky-200">
              <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
              <span>
                Live page scan unavailable on browser system pages — open any https:// site to auto-fill from DOM. Template Studio and Brand Profiles below are active.
              </span>
            </div>
          )}

          {/* Needs Tab Reload Notice Banner */}
          {needsReload && !isRestrictedTab && (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-800/50 bg-amber-950/40 p-2.5 text-[11px] text-amber-200">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="truncate">Refresh this webpage to inspect live DOM</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeTabId && typeof chrome !== "undefined" && chrome.tabs?.reload) {
                    chrome.tabs.reload(activeTabId, {}, () => {
                      if (chrome.runtime.lastError) {}
                      setNeedsReload(false);
                      setTimeout(fetchActivePage, 750);
                    });
                  }
                }}
                className="shrink-0 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 hover:bg-amber-400 transition"
              >
                Refresh Page
              </button>
            </div>
          )}
        </header>

        {/* 5 Tab Navigation Bar */}
        <nav className="sticky top-[73px] z-40 flex items-center justify-between border-b border-slate-200 bg-slate-100/90 p-1 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "dashboard"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("studio")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "studio"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("overlay")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "overlay"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Overlays</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("automation")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "automation"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Batch</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "settings"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Tab Body */}
        <main className="flex-1 p-3.5 space-y-4">
          {/* TAB 1: Audit & Radial Gauges */}
          {activeTab === "dashboard" && (
            <div className="space-y-4">
              {/* 4 Radial Gauges */}
              <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    RADIAL SEO &amp; GEO GAUGES
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-black"
                    style={{ backgroundColor: `${scores.gradeColor}20`, color: scores.gradeColor }}
                  >
                    GRADE {scores.grade}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ScoreGauge
                    score={scores.overall}
                    label="Overall Health"
                    sublabel="/100"
                    color={scores.gradeColor}
                  />
                  <ScoreGauge
                    score={scores.onPage}
                    label="On-Page Structure"
                    sublabel="/100"
                    color="#0284c7"
                  />
                  <ScoreGauge
                    score={scores.schemaTechnical}
                    label="Schema & Technical"
                    sublabel="/100"
                    color="#10b981"
                  />
                  <ScoreGauge
                    score={scores.geoAiReadiness}
                    label="GEO AI Readiness"
                    sublabel="/100"
                    color="#8b5cf6"
                  />
                </div>
              </div>

              {/* SERP & Social Card Preview */}
              <SerpSocialPreview data={pageData} />

              {/* Quick Wins / Detected Issues */}
              <QuickWinsList
                quickWins={scores.quickWins}
                onFixWithTemplate={handleFixWithTemplate}
              />
            </div>
          )}

          {/* TAB 2: Cogwheel Template Studio */}
          {activeTab === "studio" && (
            <TemplateStudio
              pageData={pageData}
              activeProfile={activeProfile}
              initialTemplateId={targetTemplateId}
              activeTabId={activeTabId}
            />
          )}

          {/* TAB 3: Visual On-Page Overlays */}
          {activeTab === "overlay" && (
            <DomOverlayInspector data={pageData} activeTabId={activeTabId} />
          )}

          {/* TAB 4: Automation & Batch Runner */}
          {activeTab === "automation" && (
            <AutomationBulkRunner pageData={pageData} activeProfile={activeProfile} />
          )}

          {/* TAB 5: Settings & Brand Profiles */}
          {activeTab === "settings" && (
            <SettingsBrandProfiles
              activeProfile={activeProfile}
              onSelectProfile={(p) => setActiveProfile(p)}
              isDarkMode={isDarkMode}
              onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
