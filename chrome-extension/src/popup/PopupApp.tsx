import React, { useState, useEffect } from "react";
import { ExternalLink, ArrowRight, Info, RotateCw } from "lucide-react";
import { PageAuditData } from "../types/extension";
import { calculateSeoScores } from "../data/cogwheelTemplates";
import { ScoreGauge } from "../components/ScoreGauge";
import { checkPageRestriction, isRestrictedUrl } from "../utils/urlSecurity";

export function PopupApp() {
  const [pageData, setPageData] = useState<PageAuditData | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [isRestricted, setIsRestricted] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState<string | undefined>();
  const [needsReload, setNeedsReload] = useState(false);
  const [loading, setLoading] = useState(true);

  const auditTab = (targetTabId: number) => {
    setLoading(true);
    setNeedsReload(false);

    chrome.tabs.sendMessage(targetTabId, { type: "EXTRACT_PAGE_DATA" }, async (res) => {
      if (!chrome.runtime.lastError && res && res.data) {
        setPageData(res.data);
        setNeedsReload(false);
        setLoading(false);
        return;
      }

      // If content script was not already running (e.g. tab opened before extension load/update),
      // dynamically inject content.js on the fly via chrome.scripting
      if (chrome.scripting && chrome.scripting.executeScript) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ["content.js"],
          });

          // Wait 120ms for listener initialization and retry extraction
          setTimeout(() => {
            chrome.tabs.sendMessage(targetTabId, { type: "EXTRACT_PAGE_DATA" }, (retryRes) => {
              if (!chrome.runtime.lastError && retryRes && retryRes.data) {
                setPageData(retryRes.data);
                setNeedsReload(false);
              } else {
                setNeedsReload(true);
              }
              setLoading(false);
            });
          }, 120);
          return;
        } catch {
          setNeedsReload(true);
          setLoading(false);
          return;
        }
      }

      setNeedsReload(true);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab || !tab.id) {
          setLoading(false);
          return;
        }
        setTabId(tab.id);

        const check = checkPageRestriction(tab.url);
        if (check.isRestricted) {
          setIsRestricted(true);
          setRestrictionReason(check.reason);
          setLoading(false);
          return;
        }

        setIsRestricted(false);
        auditTab(tab.id);
      });
    } else {
      setLoading(false);
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
      setLoading(true);
      setNeedsReload(false);
      chrome.tabs.reload(tabId, {}, () => {
        setTimeout(() => {
          if (tabId) auditTab(tabId);
        }, 1200);
      });
    }
  };

  const scores = pageData
    ? calculateSeoScores(pageData)
    : {
        overall: isRestricted ? 100 : 0,
        onPage: isRestricted ? 100 : 0,
        schemaTechnical: isRestricted ? 100 : 0,
        geoAiReadiness: isRestricted ? 100 : 0,
        grade: isRestricted ? "A" : "—",
        gradeColor: isRestricted ? "#10b981" : "#64748b",
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
        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
          COGWHEEL v3.0.0
        </span>
      </div>

      {/* Universal Category & CMS Pill */}
      {pageData && !isRestricted && (
        <div className="mt-2.5 flex items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-300 truncate">
              {pageData.siteCategoryLabel || "Universal Site"}
            </span>
          </div>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-300">
            {pageData.detectedCmsLabel || "Web Application"}
          </span>
        </div>
      )}
      {loading && !pageData && !isRestricted && (
        <div className="mt-2.5 flex items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
            <span className="font-semibold text-blue-300">
              Auditing Active DOM...
            </span>
          </div>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
            Detecting CMS...
          </span>
        </div>
      )}

      {/* Restricted System Page Banner */}
      {isRestricted && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-800/40 bg-sky-950/40 p-2.5 text-[11px] text-sky-200">
          <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          <span>
            {restrictionReason
              ? `RESTRICTED_PAGE: ${restrictionReason}. Open any https:// site to auto-fill from DOM.`
              : "RESTRICTED_PAGE: Live page scan unavailable on browser system pages — open any https:// site to auto-fill from DOM."}
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
              {loading && !pageData ? "..." : scores.overall}
            </span>
            <span className="rounded-md bg-emerald-950 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
              GRADE {loading && !pageData ? "..." : scores.grade}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            {isRestricted
              ? "All templates & brand profiles active"
              : loading && !pageData
              ? "Scanning DOM & structured data..."
              : pageData
              ? `${pageData.hostname}`
              : "Ready"}
          </p>
        </div>

        <ScoreGauge
          score={loading && !pageData ? 0 : scores.overall}
          label=""
          size={64}
          color={loading && !pageData ? "#3b82f6" : scores.gradeColor}
        />
      </div>

      {/* Mini KPI Matrix */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">H1 TAGS</span>
          <span className="block text-xs font-bold text-white mt-0.5">
            {loading && !pageData ? "..." : pageData ? pageData.h1Elements.length : 0}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">SCHEMAS</span>
          <span className="block text-xs font-bold text-emerald-400 mt-0.5">
            {loading && !pageData ? "..." : pageData ? pageData.schemas.length : 0}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">WORDS</span>
          <span className="block text-xs font-bold text-white mt-0.5">
            {loading && !pageData ? "..." : pageData ? pageData.words : 0}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">MISSING ALT</span>
          <span className="block text-xs font-bold text-rose-400 mt-0.5">
            {loading && !pageData ? "..." : pageData ? pageData.imagesWithoutAlt : 0}
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
