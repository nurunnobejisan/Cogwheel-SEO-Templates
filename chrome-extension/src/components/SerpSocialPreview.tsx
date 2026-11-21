import React, { useState } from "react";
import { Monitor, Smartphone, Share2 } from "lucide-react";
import { PageAuditData } from "../types/extension";
import { getTitlePixelStatus, getMetaDescPixelStatus } from "../utils/pixelCalculator";

interface Props {
  data: PageAuditData;
}

export function SerpSocialPreview({ data }: Props) {
  const [activeTab, setActiveTab] = useState<"desktop" | "mobile" | "social">("desktop");

  const displayTitle = data.title || "Page Title Missing";
  const displayDesc = data.metaDesc || "No meta description provided. Google will extract an unoptimized snippet from body text.";
  const displayUrl = data.url || "https://example.com";

  // Clean URL breadcrumb formatting
  const cleanHost = (data.hostname || "example.com").replace(/^www\./, "").trim();
  const rawPath = (data.pathname || "").trim();
  const cleanPath = rawPath && rawPath !== "/" ? (rawPath.startsWith("/") ? rawPath : `/${rawPath}`) : "";

  // Dynamic pixel budget calculations (580px desktop title / 920px meta desc)
  const titleBudget = getTitlePixelStatus(displayTitle);
  const descBudget = getMetaDescPixelStatus(displayDesc);

  const isTitleOverBudget = displayTitle.length > 60 || titleBudget.isOver;
  const isDescOverBudget = displayDesc.length > 158 || descBudget.isOver;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          LIVE SERP &amp; SOCIAL PREVIEW
        </span>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("desktop")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
              activeTab === "desktop"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Monitor className="h-3 w-3" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mobile")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
              activeTab === "mobile"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Smartphone className="h-3 w-3" />
            Mobile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("social")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
              activeTab === "social"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Share2 className="h-3 w-3" />
            Social OG
          </button>
        </div>
      </div>

      <div className="mt-3">
        {/* Desktop Google Preview */}
        {activeTab === "desktop" && (
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950 font-sans">
            <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 truncate">
              <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">{cleanHost}</span>
              {cleanPath && (
                <>
                  <span className="mx-1 text-slate-400 dark:text-slate-500 select-none">›</span>
                  <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{cleanPath}</span>
                </>
              )}
            </div>
            <h3 className="mt-1 line-clamp-1 text-base font-normal text-[#1a0dab] hover:underline dark:text-[#8ab4f8]">
              {displayTitle}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">
              {displayDesc}
            </p>
          </div>
        )}

        {/* Mobile Google Preview */}
        {activeTab === "mobile" && (
          <div className="max-w-xs mx-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {cleanHost.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                  {cleanHost}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {cleanHost}{cleanPath ? ` › ${cleanPath}` : ""}
                </div>
              </div>
            </div>
            <h4 className="mt-1.5 line-clamp-2 text-sm font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
              {displayTitle}
            </h4>
            <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">
              {displayDesc}
            </p>
          </div>
        )}

        {/* Social Card Preview */}
        {activeTab === "social" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
            {data.ogImage ? (
              <img
                src={data.ogImage}
                alt="OG Preview"
                className="h-28 w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-20 items-center justify-center bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">
                No OpenGraph Image Found
              </div>
            )}
            <div className="p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {cleanHost}
              </span>
              <h4 className="mt-0.5 line-clamp-1 text-xs font-bold text-slate-900 dark:text-white">
                {data.ogTitle || displayTitle}
              </h4>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                {data.ogDescription || displayDesc}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[10px]">
        <span className={isTitleOverBudget ? "font-bold text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}>
          Title: {displayTitle.length}/60 chars ({titleBudget.pixelWidth}px · {titleBudget.status})
        </span>
        <span className={isDescOverBudget ? "font-bold text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}>
          Desc: {displayDesc.length}/155 chars ({descBudget.pixelWidth}px · {descBudget.status})
        </span>
      </div>
    </div>
  );
}
