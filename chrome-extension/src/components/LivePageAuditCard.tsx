import React, { useState, useEffect } from "react";
import {
  Globe,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  Eye,
  FileCode,
  ShieldCheck,
  Tag,
  Sparkles,
} from "lucide-react";
import { PageAuditData } from "../types/extension";
import { OtaConfigPayload } from "../types/updater.types";
import { calculatePixelWidth, TITLE_PIXEL_LIMIT, META_DESC_PIXEL_LIMIT } from "../utils/pixelCalculator";
import { UniversalHeadingAuditCard } from "./UniversalHeadingAuditCard";

interface Props {
  pageData: PageAuditData;
  activeTabId?: number;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function LivePageAuditCard({ pageData, activeTabId, onRefresh, isLoading = false }: Props) {
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [otaConfig, setOtaConfig] = useState<OtaConfigPayload | null>(null);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["cogwheel_ota_config"], (res) => {
        if (res && res["cogwheel_ota_config"]) {
          setOtaConfig(res["cogwheel_ota_config"] as OtaConfigPayload);
        }
      });
    }
  }, []);
  const [copiedSchemaIndex, setCopiedSchemaIndex] = useState<number | null>(null);
  const [expandedSchemaIndex, setExpandedSchemaIndex] = useState<number | null>(null);

  // SERP Pixel Calculations
  const titlePx = pageData.titlePixelWidth || calculatePixelWidth(pageData.title || "");
  const metaDescPx = pageData.metaDescPixelWidth || calculatePixelWidth(pageData.metaDesc || "");

  const otaTitleLimit = otaConfig?.pixelLimits?.titleMaxPx ?? TITLE_PIXEL_LIMIT;
  const titleMaxPx = deviceMode === "desktop" ? otaTitleLimit : 920;
  const metaMaxPx = deviceMode === "desktop" ? 960 : 850;

  const isTitleOverBudget = titlePx > titleMaxPx || (pageData.title || "").length > 60;
  const isMetaOverBudget = (pageData.metaDesc || "").length > 155;

  // Truncate title simulation
  const getTruncatedTitle = (title: string, isOver: boolean) => {
    if (!isOver) return title;
    return title.slice(0, 58) + "...";
  };

  const handleCopySchema = (schemaObj: Record<string, unknown>, index: number) => {
    navigator.clipboard.writeText(JSON.stringify(schemaObj, null, 2));
    setCopiedSchemaIndex(index);
    setTimeout(() => setCopiedSchemaIndex(null), 2000);
  };

  // Inspect schema coverage & errors
  const detectedSchemas = pageData.schemas || [];
  const hasHotelSchema = detectedSchemas.some((s) => {
    const t = String(s["@type"] || "");
    return ["Hotel", "LodgingBusiness", "Resort", "Motel"].some((k) => t.includes(k));
  });
  const hasFaqSchema = detectedSchemas.some((s) => String(s["@type"] || "").includes("FAQPage"));
  const hasBreadcrumb = detectedSchemas.some((s) => String(s["@type"] || "").includes("BreadcrumbList"));

  const schemaErrors = pageData.schemaErrors || [];

  return (
    <div className="space-y-4">
      {/* 1. Live Page Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Globe className="w-3 h-3" />
                LIVE TAB AUDIT
              </span>
              {pageData.detectedCmsLabel && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {pageData.detectedCmsLabel}
                </span>
              )}
              {pageData.siteCategoryLabel && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {pageData.siteCategoryLabel}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-white truncate" title={pageData.title}>
              {pageData.title || "Untitled Page"}
            </h2>
            <p className="text-xs text-slate-400 truncate mt-0.5" title={pageData.url}>
              {pageData.url}
            </p>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            title="Re-audit current browser tab DOM"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Auditing..." : "Re-Audit"}
          </button>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Headings</span>
            <div className="text-sm font-bold text-white mt-0.5">
              {pageData.h1Elements?.length || 0} H1 / {pageData.h2Elements?.length || 0} H2
            </div>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Title Budget</span>
            <div className={`text-sm font-bold mt-0.5 ${isTitleOverBudget ? "text-amber-400" : "text-emerald-400"}`}>
              {titlePx}px
            </div>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Schemas</span>
            <div className={`text-sm font-bold mt-0.5 ${detectedSchemas.length > 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {detectedSchemas.length} Types
            </div>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Images Alt</span>
            <div className={`text-sm font-bold mt-0.5 ${pageData.imagesWithoutAlt === 0 ? "text-emerald-400" : "text-amber-400"}`}>
              {pageData.totalImages - pageData.imagesWithoutAlt}/{pageData.totalImages}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Real-Time SERP Truncation Preview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              Real-Time SERP Truncation Preview
            </span>
          </div>

          {/* Device Toggle */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setDeviceMode("desktop")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                deviceMode === "desktop"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Monitor className="w-3 h-3" />
              Desktop
            </button>
            <button
              onClick={() => setDeviceMode("mobile")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                deviceMode === "mobile"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Smartphone className="w-3 h-3" />
              Mobile
            </button>
          </div>
        </div>

        {/* Google SERP Snippet Box */}
        <div className="bg-white rounded-lg p-3 text-slate-900 font-sans shadow-inner border border-slate-200">
          <div className="text-[12px] text-slate-600 truncate flex items-center gap-1 mb-0.5">
            <span className="text-slate-500 font-normal">{pageData.origin || "https://example.com"}</span>
            <span>›</span>
            <span className="text-slate-800 font-medium">
              {pageData.pathname?.replace(/^\//, "").split("/")[0] || "hotels"}
            </span>
          </div>
          <div className="text-base text-[#1a0dab] hover:underline cursor-pointer font-medium leading-snug line-clamp-2">
            {getTruncatedTitle(pageData.title || "No Title Tag Detected", isTitleOverBudget)}
          </div>
          <div className="text-[13px] text-[#4d5156] mt-1 leading-normal line-clamp-2">
            {pageData.metaDesc || "No meta description found. Search engines will generate an automatic snippet from page copy."}
          </div>
        </div>

        {/* Pixel & Character Budgets */}
        <div className="mt-3 space-y-2 text-xs">
          <div>
            <div className="flex justify-between text-slate-400 mb-1 font-medium">
              <span>Title Pixel Width: <strong className="text-white">{titlePx}px</strong> / {titleMaxPx}px ({pageData.title?.length || 0} chars)</span>
              <span className={isTitleOverBudget ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
                {isTitleOverBudget ? "Over Budget (Truncation Risk)" : "Optimal Fit"}
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all ${isTitleOverBudget ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, (titlePx / titleMaxPx) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1 font-medium">
              <span>Meta Description: <strong className="text-white">{metaDescPx}px</strong> ({pageData.metaDesc?.length || 0} chars / 155 max)</span>
              <span className={isMetaOverBudget ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
                {isMetaOverBudget ? "Truncation Warning" : "Optimal Length"}
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all ${isMetaOverBudget ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, ((pageData.metaDesc?.length || 0) / 155) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Heading Structure Hierarchy */}
      <UniversalHeadingAuditCard
        hierarchy={pageData.headingHierarchy}
        issues={pageData.headingIssues}
        h1Count={pageData.h1Elements?.length || 0}
        h2Count={pageData.h2Elements?.length || 0}
        h3Count={pageData.h3Elements?.length || 0}
      />

      {/* 4. JSON-LD Schema & Error Validator */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              JSON-LD Schema &amp; Error Validator
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
            {detectedSchemas.length} Detected
          </span>
        </div>

        {/* Schema Status Checklist */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className={`p-2 rounded-lg border text-center ${hasHotelSchema ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
            <div className="text-[10px] uppercase font-bold">Hotel / Lodging</div>
            <div className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
              {hasHotelSchema ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {hasHotelSchema ? "Valid" : "Missing"}
            </div>
          </div>

          <div className={`p-2 rounded-lg border text-center ${hasFaqSchema ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
            <div className="text-[10px] uppercase font-bold">FAQPage Schema</div>
            <div className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
              {hasFaqSchema ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {hasFaqSchema ? "Valid" : "Missing"}
            </div>
          </div>

          <div className={`p-2 rounded-lg border text-center ${hasBreadcrumb ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-800/40 border-slate-800 text-slate-400"}`}>
            <div className="text-[10px] uppercase font-bold">BreadcrumbList</div>
            <div className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
              {hasBreadcrumb ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {hasBreadcrumb ? "Valid" : "Optional"}
            </div>
          </div>
        </div>

        {/* Error Banners if Any */}
        {schemaErrors.length > 0 && (
          <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              Detected Schema Issues:
            </div>
            {schemaErrors.map((err, i) => (
              <div key={i} className="pl-5 text-[11px] list-disc">
                • {err}
              </div>
            ))}
          </div>
        )}

        {/* Schema Objects List */}
        <div className="space-y-2">
          {detectedSchemas.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-500">
              No JSON-LD schemas detected in active tab DOM.
            </div>
          ) : (
            detectedSchemas.map((schema, idx) => {
              const typeStr = String(schema["@type"] || "Schema Object");
              const isExpanded = expandedSchemaIndex === idx;

              return (
                <div key={idx} className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                  <div
                    onClick={() => setExpandedSchemaIndex(isExpanded ? null : idx)}
                    className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        {typeStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopySchema(schema, idx);
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="Copy JSON-LD"
                      >
                        {copiedSchemaIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-[11px] font-mono text-slate-300 max-h-56 overflow-y-auto">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(schema, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
