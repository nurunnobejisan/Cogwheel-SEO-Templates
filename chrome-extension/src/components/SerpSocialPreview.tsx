import React, { useState } from "react";
import { Monitor, Smartphone, Share2, Globe, Image as ImageIcon } from "lucide-react";
import { PageAuditData } from "../types/extension";
import { getTitlePixelStatus, getMetaDescPixelStatus } from "../utils/pixelCalculator";

interface Props {
  data: PageAuditData;
}

export function SerpSocialPreview({ data }: Props) {
  const [activeTab, setActiveTab] = useState<"desktop" | "mobile" | "social">("desktop");

  const displayTitle = data.title || "Page Title Missing";
  const displayDesc =
    data.metaDesc ||
    "No meta description provided. Google will extract an unoptimized snippet from body text.";
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

  // Mobile specific truncation (~380px mobile budget)
  const isMobileTitleTruncated = titleBudget.pixelWidth > 380;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          LIVE SERP &amp; SOCIAL PREVIEW
        </span>

        {/* Segmented Tab Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("desktop")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
              activeTab === "desktop"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Monitor className="h-3 w-3" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mobile")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
              activeTab === "mobile"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Smartphone className="h-3 w-3" />
            <span>Mobile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("social")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
              activeTab === "social"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Share2 className="h-3 w-3" />
            <span>Social OG</span>
          </button>
        </div>
      </div>

      <div className="mt-3">
        {/* 1. Desktop Google SERP Snippet (580px ceiling) */}
        {activeTab === "desktop" && (
          <div className="max-w-[580px] w-full rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950 font-sans">
            {/* Breadcrumb Header */}
            <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 truncate">
              <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">{cleanHost}</span>
              {cleanPath && (
                <>
                  <span className="mx-1 text-slate-400 dark:text-slate-500 select-none">›</span>
                  <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{cleanPath}</span>
                </>
              )}
            </div>

            {/* Title Link */}
            <h3 className="mt-1 line-clamp-1 text-base font-normal text-[#1a0dab] hover:underline dark:text-[#8ab4f8] cursor-pointer">
              {displayTitle}
            </h3>

            {/* Meta Description Snippet */}
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">
              {displayDesc}
            </p>
          </div>
        )}

        {/* 2. Mobile Google SERP Card with Favicon */}
        {activeTab === "mobile" && (
          <div className="max-w-[360px] mx-auto rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950 font-sans">
            {/* Mobile Header with Favicon Circle & Domain */}
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-700 shadow-2xs dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {cleanHost.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-slate-900 dark:text-white leading-tight truncate">
                  {cleanHost.split(".")[0].toUpperCase()}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                  {cleanHost}{cleanPath ? ` › ${cleanPath}` : ""}
                </div>
              </div>
            </div>

            {/* Mobile Title (16px, 2-line clamp) */}
            <h4 className="mt-2 line-clamp-2 text-[15px] font-medium leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
              {displayTitle}
            </h4>

            {/* Mobile Meta Description (12px, 3-line clamp) */}
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">
              {displayDesc}
            </p>

            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[9px] text-slate-400 dark:border-slate-800">
              <span>Mobile SERP Viewport (360px)</span>
              <span>{isMobileTitleTruncated ? "Multi-Line Truncation" : "Fits 1-2 Lines"}</span>
            </div>
          </div>
        )}

        {/* 3. Rich Open Graph Social Share Card */}
        {activeTab === "social" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
            {/* 1.91:1 OG Image Preview */}
            {data.ogImage ? (
              <div className="relative aspect-[1.91/1] w-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                <img
                  src={data.ogImage}
                  alt="Open Graph Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="flex aspect-[1.91/1] w-full flex-col items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <ImageIcon className="h-8 w-8 stroke-[1.5]" />
                <span className="mt-1 text-xs font-semibold">No og:image Specified</span>
                <span className="text-[10px]">Add a 1200x630 image tag for rich social cards</span>
              </div>
            )}

            {/* Card Content & Domain Attribution */}
            <div className="p-3 font-sans">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {cleanHost}
              </span>
              <h4 className="mt-0.5 line-clamp-1 text-xs font-bold text-slate-900 dark:text-white leading-snug">
                {data.ogTitle || displayTitle}
              </h4>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {data.ogDescription || displayDesc}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time SERP Width Status Strip */}
      <div className="mt-2.5 flex items-center justify-between text-[10px]">
        <span
          className={
            isTitleOverBudget
              ? "font-bold text-amber-600 dark:text-amber-400"
              : "text-slate-500 dark:text-slate-400"
          }
        >
          Title: {displayTitle.length}/60 chars ({titleBudget.pixelWidth}px · {titleBudget.status})
        </span>
        <span
          className={
            isDescOverBudget
              ? "font-bold text-amber-600 dark:text-amber-400"
              : "text-slate-500 dark:text-slate-400"
          }
        >
          Desc: {displayDesc.length}/155 chars ({descBudget.pixelWidth}px · {descBudget.status})
        </span>
      </div>
    </div>
  );
}
