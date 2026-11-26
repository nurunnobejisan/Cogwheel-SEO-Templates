import React, { useState, useEffect } from "react";
import {
  ExternalLink,
  ArrowRight,
  Info,
  RotateCw,
  Globe,
  Layers,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Cpu,
  Code,
  Image as ImageIcon,
  Heading,
} from "lucide-react";
import { PageAuditData } from "../types/extension";
import { calculateSeoScores } from "../data/seoStudioTemplates";
import { checkPageRestriction } from "../utils/urlSecurity";
import {
  calculatePixelWidth,
  TITLE_PIXEL_LIMIT,
  META_DESC_PIXEL_LIMIT,
} from "../utils/pixelCalculator";

export function PopupApp() {
  const [pageData, setPageData] = useState<PageAuditData | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [isRestricted, setIsRestricted] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState<string | undefined>();
  const [needsReload, setNeedsReload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeOverlays, setActiveOverlays] = useState<{
    headings: boolean;
    missingAlts: boolean;
    schemas: boolean;
  }>({
    headings: false,
    missingAlts: false,
    schemas: false,
  });

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
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ tabId }).catch(() => {
          chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL", tabId });
        });
      } else {
        chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL", tabId }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
      setTimeout(() => window.close(), 100);
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

  const toggleOverlay = (type: "headings" | "missingAlts" | "schemas") => {
    if (!tabId) return;
    const newState = !activeOverlays[type];
    setActiveOverlays((prev) => ({ ...prev, [type]: newState }));
    chrome.tabs.sendMessage(tabId, {
      type: "TOGGLE_OVERLAY",
      overlayType: type,
      enabled: newState,
    }, () => {
      if (chrome.runtime.lastError) {
        // Silently handled
      }
    });
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

  // Google SERP Pixel Metrics
  const titlePx = pageData?.titlePixelWidth || (pageData?.title ? calculatePixelWidth(pageData.title) : 0);
  const metaDescPx = pageData?.metaDescPixelWidth || (pageData?.metaDesc ? calculatePixelWidth(pageData.metaDesc) : 0);
  const titlePercent = Math.min(100, Math.round((titlePx / TITLE_PIXEL_LIMIT) * 100));
  const metaDescPercent = Math.min(100, Math.round((metaDescPx / META_DESC_PIXEL_LIMIT) * 100));

  // Radial SVG Parameters (Radius = 34, Circumference ~ 213.6)
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (scores.overall / 100) * circumference;

  return (
    <div className="w-[390px] max-h-[600px] overflow-y-auto bg-slate-950 p-4 text-slate-100 font-sans shadow-2xl selection:bg-emerald-500 selection:text-slate-950">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
          <span className="font-display text-xs font-black tracking-wider text-white uppercase">
            NURUNNOBE JISAN
          </span>
          <span className="text-[10px] text-slate-500">|</span>
          <span className="text-[10px] font-bold text-slate-400">STUDIO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => tabId && auditTab(tabId)}
            title="Re-scan live DOM"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RotateCw className={`h-3 w-3 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
          <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
            v3.0.0
          </span>
        </div>
      </div>

      {/* Universal URL, CMS & Category Bar */}
      <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-900/70 p-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="truncate text-xs font-semibold text-slate-200">
              {isRestricted ? "Browser System Page" : pageData?.hostname || "Auditing active page..."}
            </span>
          </div>
          <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase">
            {isRestricted ? "SYSTEM" : pageData?.protocol.replace(":", "").toUpperCase() || "LIVE"}
          </span>
        </div>

        {/* CMS & Category Intelligence Pills */}
        {!isRestricted && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800/60 pt-2 text-[10px]">
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-300 truncate">
                {pageData?.siteCategoryLabel || (loading ? "Detecting Category..." : "Universal Site")}
              </span>
            </div>
            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 border border-slate-700/60">
              {pageData?.detectedCmsLabel || (loading ? "Analyzing CMS..." : "Web Application")}
            </span>
          </div>
        )}
      </div>

      {/* Restricted System Page Banner */}
      {isRestricted && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-sky-800/40 bg-sky-950/40 p-2.5 text-[11px] text-sky-200">
          <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          <span>
            {restrictionReason
              ? `RESTRICTED_PAGE: ${restrictionReason}. Open any https:// website to audit live DOM.`
              : "RESTRICTED_PAGE: Live page scan unavailable on internal browser pages. Open any live website to inspect DOM."}
          </span>
        </div>
      )}

      {/* Needs Reload Banner */}
      {needsReload && !isRestricted && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-800/50 bg-amber-950/40 p-2.5 text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5">
            <RotateCw className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Connection reset. Click refresh to inspect.</span>
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

      {/* Main Score Hero Card with Radial Gauge */}
      <div className="my-2.5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 p-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                SEO &amp; GEO HEALTH
              </span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider ${
                  scores.overall >= 90
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : scores.overall >= 70
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}
              >
                {scores.overall >= 90 ? "OPTIMAL" : scores.overall >= 70 ? "NEEDS REVIEW" : "CRITICAL"}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-black text-white tracking-tight tabular-nums font-mono">
                {loading && !pageData ? "..." : scores.overall}
              </span>
              <span className="text-xs font-semibold text-slate-400">/ 100</span>
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs"
                style={{
                  backgroundColor: scores.gradeColor + "20",
                  color: scores.gradeColor,
                  borderColor: scores.gradeColor + "40",
                  borderWidth: "1px",
                }}
              >
                GRADE {loading && !pageData ? "..." : scores.grade}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 truncate">
              {isRestricted
                ? "Studio offline templates active"
                : loading && !pageData
                ? "Extracting DOM, schemas & pixel metrics..."
                : pageData
                ? `100-Point Audit • ${pageData.protocol}//${pageData.hostname}`
                : "Ready to inspect"}
            </p>
          </div>

          {/* Precision SVG Radial Gauge */}
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            <svg className="h-20 w-20 -rotate-90 transform" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke={loading && !pageData ? "#3b82f6" : scores.gradeColor}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={loading && !pageData ? circumference * 0.25 : strokeOffset}
                strokeLinecap="round"
                fill="transparent"
                className={`transition-all duration-700 ${loading && !pageData ? "animate-spin origin-center" : ""}`}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="font-mono text-base font-black text-white tabular-nums">
                {loading && !pageData ? "--" : scores.overall}
              </span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">SCORE</span>
            </div>
          </div>
        </div>

        {/* Tri-Pillar Score Cards */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-slate-800/80 pt-2.5">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2">
            <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase">
              <span className="flex items-center gap-1">
                <FileText className="h-2.5 w-2.5 text-blue-400" />
                <span>On-Page</span>
              </span>
              <span className="font-mono text-slate-200">{scores.onPage}%</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${scores.onPage}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2">
            <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase">
              <span className="flex items-center gap-1">
                <Code className="h-2.5 w-2.5 text-emerald-400" />
                <span>Schema</span>
              </span>
              <span className="font-mono text-slate-200">{scores.schemaTechnical}%</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${scores.schemaTechnical}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2">
            <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase">
              <span className="flex items-center gap-1">
                <Cpu className="h-2.5 w-2.5 text-purple-400" />
                <span>GEO AI</span>
              </span>
              <span className="font-mono text-slate-200">{scores.geoAiReadiness}%</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: `${scores.geoAiReadiness}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Google SERP Pixel Budget Card */}
      {pageData && (
        <div className="mb-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5 space-y-2 text-[10px]">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">
              Google SERP Pixel Budget
            </span>
            <span className="text-[9px] text-slate-500">Desktop Viewport</span>
          </div>

          {/* Title Pixel Meter */}
          <div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="truncate text-slate-400 max-w-[200px]">
                Title: <strong className="text-white font-mono">{pageData.title.length}</strong> chars
              </span>
              <span
                className={`font-mono text-[9px] font-bold ${
                  titlePx <= TITLE_PIXEL_LIMIT ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {titlePx}px / 580px
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  titlePx <= TITLE_PIXEL_LIMIT
                    ? "bg-emerald-500"
                    : titlePx <= 620
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${titlePercent}%` }}
              />
            </div>
          </div>

          {/* Meta Description Pixel Meter */}
          <div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="truncate text-slate-400 max-w-[200px]">
                Desc: <strong className="text-white font-mono">{pageData.metaDesc.length}</strong> chars
              </span>
              <span
                className={`font-mono text-[9px] font-bold ${
                  metaDescPx <= META_DESC_PIXEL_LIMIT ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {metaDescPx}px / 920px
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metaDescPx <= META_DESC_PIXEL_LIMIT ? "bg-emerald-500" : "bg-rose-500"
                }`}
                style={{ width: `${metaDescPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mini KPI Matrix */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">H1 TAGS</span>
          <span
            className={`block text-xs font-bold mt-0.5 font-mono ${
              pageData?.h1Elements.length === 1 ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {loading && !pageData ? "..." : pageData ? pageData.h1Elements.length : 0}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">SCHEMAS</span>
          <span className="block text-xs font-bold text-emerald-400 mt-0.5 font-mono">
            {loading && !pageData ? "..." : pageData ? pageData.schemas.length : 0}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">WORDS</span>
          <span
            className={`block text-xs font-bold mt-0.5 font-mono ${
              (pageData?.words || 0) >= 450 ? "text-emerald-400" : "text-white"
            }`}
          >
            {loading && !pageData ? "..." : pageData ? pageData.words : 0}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
          <span className="block text-[8px] font-bold text-slate-400 uppercase">MISSING ALT</span>
          <span
            className={`block text-xs font-bold mt-0.5 font-mono ${
              (pageData?.imagesWithoutAlt || 0) === 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {loading && !pageData ? "..." : pageData ? pageData.imagesWithoutAlt : 0}
          </span>
        </div>
      </div>

      {/* 1-Click Live Visual DOM Overlays */}
      <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
          <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-[9px]">
            <Eye className="h-3 w-3 text-emerald-400" />
            <span>Highlight Live on Page:</span>
          </span>
          <span className="text-[9px] text-slate-500">Instant DOM Badges</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => toggleOverlay("headings")}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[10px] font-bold transition border ${
              activeOverlays.headings
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
            }`}
          >
            <Heading className="h-3 w-3" />
            <span>Headings</span>
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay("missingAlts")}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[10px] font-bold transition border ${
              activeOverlays.missingAlts
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
            }`}
          >
            <ImageIcon className="h-3 w-3" />
            <span>Images Alt</span>
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay("schemas")}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[10px] font-bold transition border ${
              activeOverlays.schemas
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
            }`}
          >
            <Code className="h-3 w-3" />
            <span>Schemas</span>
          </button>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={openSidePanel}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-950/40 transition hover:bg-emerald-400 active:scale-[0.99]"
        >
          <span>Open Full Side Panel Workspace</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <a
          href="https://seo-studio-one.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <span>Open SEO Studio Cloud Studio</span>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </a>
      </div>
    </div>
  );
}
