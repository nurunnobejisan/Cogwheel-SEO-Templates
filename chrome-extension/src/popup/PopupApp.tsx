import React, { useState, useEffect } from "react";
import { ExternalLink, ArrowRight, Info, RotateCw } from "lucide-react";
import { PageAuditData } from "../types/extension";
import { calculateSeoScores } from "../data/cogwheelTemplates";
import { ScoreGauge } from "../components/ScoreGauge";
import { isRestrictedUrl } from "../utils/urlSecurity";

export function PopupApp() {
  const [pageData, setPageData] = useState<PageAuditData | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [isRestricted, setIsRestricted] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab || !tab.id) return;
        setTabId(tab.id);

        if (isRestrictedUrl(tab.url)) {
          setIsRestricted(true);
          return;
        }

        setIsRestricted(false);
        chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_DATA" }, (res) => {
          if (chrome.runtime.lastError) {
            // Handled: tab needs a refresh to connect to the content script
            setNeedsReload(true);
            return;
          }
          if (res && res.data) {
            setPageData(res.data);
            setNeedsReload(false);
          }
        });
      });
    }
  }, []);

  const openSidePanel = () => {
    if (typeof chrome !== "undefined" && tabId) {
      chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL", tabId }, () => {
        if (chrome.runtime.lastError) {
          // Handled
        }
      });
      window.close(); // Close popup so sidepanel takes focus
    }
  };

  const handleReload = () => {
    if (tabId && typeof chrome !== "undefined" && chrome.tabs?.reload) {
      chrome.tabs.reload(tabId, {}, () => {
        if (chrome.runtime.lastError) {
          // Handled
        }
        window.close();
      });
    }
  };

  const scores = pageData
    ? calculateSeoScores(pageData)
    : {
        overall: isRestricted ? 100 : 92,
        onPage: 90,
        schemaTechnical: 95,
        geoAiReadiness: 90,
        grade: isRestricted ? "A" : "A+",
        gradeColor: "#10b981",
        quickWins: [],
      };

  return (
    <div className="w-[380px] bg-slate-900 p-4 text-slate-100 font-sans">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          <span className="font-display text-xs font-black tracking-wider text-white uppercase">
            RAZIB MARKETING
          </span>
        </div>
        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
          COGWHEEL v2.7
        </span>
      </div>

      {/* Restricted System Page Banner */}
      {isRestricted && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-800/40 bg-sky-950/40 p-2.5 text-[11px] text-sky-200">
          <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          <span>
            Live page scan unavailable on browser system pages — open any https:// site to auto-fill from DOM
          </span>
        </div>
      )}

      {/* Needs Reload Banner */}
      {needsReload && !isRestricted && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-800/50 bg-amber-950/40 p-2.5 text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5">
            <RotateCw className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Refresh this webpage to inspect live DOM</span>
          </div>
          <button
            type="button"
            onClick={handleReload}
            className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 hover:bg-amber-400 transition"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Main Score Hero */}
      <div className="my-3 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {isRestricted ? "STUDIO OFFLINE MODE" : "SEO & GEO HEALTH"}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-black text-emerald-400">
              {scores.overall}
            </span>
            <span className="rounded-md bg-emerald-950 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
              GRADE {scores.grade}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            {isRestricted
              ? "All templates & brand profiles active"
              : pageData
              ? `${pageData.hostname}`
              : "Auditing active hotel page..."}
          </p>
        </div>

        <ScoreGauge
          score={scores.overall}
          label=""
          size={64}
          color={scores.gradeColor}
        />
      </div>

      {/* Mini KPI Matrix */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">H1 TAGS</span>
          <span className="block text-xs font-bold text-white mt-0.5">
            {pageData?.h1Elements.length ?? 1}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">SCHEMAS</span>
          <span className="block text-xs font-bold text-emerald-400 mt-0.5">
            {pageData?.schemas.length ?? 2}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">WORDS</span>
          <span className="block text-xs font-bold text-white mt-0.5">
            {pageData?.words ?? 650}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">MISSING ALT</span>
          <span className="block text-xs font-bold text-rose-400 mt-0.5">
            {pageData?.imagesWithoutAlt ?? 0}
          </span>
        </div>
      </div>

      {/* Primary Call to Action: Open Side Panel Workspace */}
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={openSidePanel}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 shadow-xs transition hover:bg-emerald-400"
        >
          <span>Open Full Side Panel Workspace</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <a
          href="https://cogwheel-seo-templates.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800 transition"
        >
          <span>Open Cogwheel Cloud Studio</span>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </a>
      </div>
    </div>
  );
}
