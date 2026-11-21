import React, { useState } from "react";
import { Monitor, Smartphone, Share2, Image as ImageIcon } from "lucide-react";
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
    <div className="rounded-xl border border-[#27272A] bg-[#111113] p-3 text-[#FAFAFA]">
      <div className="flex items-center justify-between border-b border-[#27272A] pb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
          Live SERP &amp; Social Preview
        </span>

        {/* Segmented Tab Switcher */}
        <div className="flex items-center gap-0.5 rounded-lg border border-[#27272A] bg-[#18181B] p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("desktop")}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition ${
              activeTab === "desktop"
                ? "bg-[#27272A] text-[#FAFAFA] shadow-xs"
                : "text-[#A1A1AA] hover:text-[#FAFAFA]"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mobile")}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition ${
              activeTab === "mobile"
                ? "bg-[#27272A] text-[#FAFAFA] shadow-xs"
                : "text-[#A1A1AA] hover:text-[#FAFAFA]"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Mobile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("social")}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition ${
              activeTab === "social"
                ? "bg-[#27272A] text-[#FAFAFA] shadow-xs"
                : "text-[#A1A1AA] hover:text-[#FAFAFA]"
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Social OG</span>
          </button>
        </div>
      </div>

      <div className="mt-3">
        {/* 1. Desktop Google SERP Snippet (580px ceiling) */}
        {activeTab === "desktop" && (
          <div className="max-w-[580px] w-full rounded-lg border border-[#27272A] bg-[#09090B] p-3 font-sans">
            {/* Breadcrumb Header */}
            <div className="flex items-center text-xs text-[#A1A1AA] truncate">
              <span className="font-semibold text-[#FAFAFA] shrink-0">{cleanHost}</span>
              {cleanPath && (
                <>
                  <span className="mx-1 text-[#71717A] select-none">›</span>
                  <span className="truncate text-[11px] text-[#A1A1AA]">{cleanPath}</span>
                </>
              )}
            </div>

            {/* Title Link */}
            <h3 className="mt-1 line-clamp-1 text-sm font-medium text-[#8ab4f8] hover:underline cursor-pointer">
              {displayTitle}
            </h3>

            {/* Meta Description Snippet */}
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#bdc1c6]">
              {displayDesc}
            </p>
          </div>
        )}

        {/* 2. Mobile Google SERP Card with Favicon */}
        {activeTab === "mobile" && (
          <div className="max-w-[360px] mx-auto rounded-lg border border-[#27272A] bg-[#09090B] p-3 font-sans">
            {/* Mobile Header with Favicon Circle & Domain */}
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-[10px] font-bold text-[#FAFAFA] border border-[#27272A]">
                {cleanHost.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#FAFAFA] leading-tight truncate">
                  {cleanHost.split(".")[0].toUpperCase()}
                </div>
                <div className="text-[10px] text-[#A1A1AA] truncate leading-tight">
                  {cleanHost}{cleanPath ? ` › ${cleanPath}` : ""}
                </div>
              </div>
            </div>

            {/* Mobile Title */}
            <h4 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-[#8ab4f8]">
              {displayTitle}
            </h4>

            {/* Mobile Meta Description */}
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[#bdc1c6]">
              {displayDesc}
            </p>

            <div className="mt-2.5 flex items-center justify-between border-t border-[#27272A] pt-2 text-[9px] text-[#71717A]">
              <span>Mobile SERP Viewport (360px)</span>
              <span>{isMobileTitleTruncated ? "Multi-Line Truncation" : "Fits 1-2 Lines"}</span>
            </div>
          </div>
        )}

        {/* 3. Rich Open Graph Social Share Card */}
        {activeTab === "social" && (
          <div className="overflow-hidden rounded-lg border border-[#27272A] bg-[#09090B]">
            {/* 1.91:1 OG Image Preview */}
            {data.ogImage ? (
              <div className="relative aspect-[1.91/1] w-full bg-[#18181B] overflow-hidden">
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
              <div className="flex aspect-[1.91/1] w-full flex-col items-center justify-center bg-[#18181B] text-[#71717A] border-b border-[#27272A]">
                <ImageIcon className="h-6 w-6 stroke-[1.5]" />
                <span className="mt-1 text-xs font-medium text-[#A1A1AA]">No og:image Specified</span>
                <span className="text-[10px]">Add a 1200x630 image tag for rich social cards</span>
              </div>
            )}

            {/* Card Content & Domain Attribution */}
            <div className="p-3 font-sans">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A]">
                {cleanHost}
              </span>
              <h4 className="mt-0.5 line-clamp-1 text-xs font-semibold text-[#FAFAFA] leading-snug">
                {data.ogTitle || displayTitle}
              </h4>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#A1A1AA]">
                {data.ogDescription || displayDesc}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time SERP Width Status Strip */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#A1A1AA]">
        <span
          className={`tabular-nums ${
            isTitleOverBudget ? "font-medium text-amber-400" : "text-[#A1A1AA]"
          }`}
        >
          Title: {displayTitle.length}/60 chars ({titleBudget.pixelWidth}px · {titleBudget.status})
        </span>
        <span
          className={`tabular-nums ${
            isDescOverBudget ? "font-medium text-amber-400" : "text-[#A1A1AA]"
          }`}
        >
          Desc: {displayDesc.length}/155 chars ({descBudget.pixelWidth}px · {descBudget.status})
        </span>
      </div>
    </div>
  );
}
