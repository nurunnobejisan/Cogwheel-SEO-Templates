import React, { useState } from "react";
import {
  Image as ImageIcon,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { DetailedImageItem, CoreWebVitalsAudit } from "../types/extension";

interface Props {
  images?: DetailedImageItem[];
  vitals?: CoreWebVitalsAudit;
  totalImages: number;
  imagesWithoutAlt: number;
  hostname: string;
}

export function UniversalImageAuditCard({
  images = [],
  vitals,
  totalImages,
  imagesWithoutAlt,
  hostname,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "issues" | "missing-alt">("all");

  const filteredImages = images.filter((img) => {
    if (filter === "missing-alt") return !img.alt && !img.isDecorative;
    if (filter === "issues") return img.issues.length > 0;
    return true;
  });

  const handleExportCsv = () => {
    // Exact 6-column reference format matching standard Google Sheet
    const headers = ["Image", "URL", "Title", "Length", "Optimized ALT Text", "Length"];
    const rows = images.map((img) => {
      const title = img.targetFilename || img.src.split("/").pop()?.split("?")[0] || "image-asset";
      const alt = img.proposedAlt || "";
      return [
        `=IMAGE("${img.src}")`,
        `"${img.src.replace(/"/g, '""')}"`,
        `"${title.replace(/"/g, '""')}"`,
        title.length,
        `"${alt.replace(/"/g, '""')}"`,
        alt.length,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `image-optimization-audit-${hostname || "site"}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA] shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272A] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
            <ImageIcon className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
              IMAGE OPTIMIZATION &amp; WCAG 2.2 AA AUDIT
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-[#FAFAFA]">
                {totalImages} Assets Inspected
              </span>
              {vitals?.estimatedSavingsKb ? (
                <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-300">
                  ~{vitals.estimatedSavingsKb} KB Potential WebP Savings
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          title="Export standard 6-column spreadsheet"
          className="flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-xs font-semibold text-[#FAFAFA] hover:bg-[#27272A] transition"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
          <span>Export .CSV</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-xs">
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">MISSING ALT</span>
          <span
            className={`block text-sm font-bold mt-0.5 ${
              imagesWithoutAlt > 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {imagesWithoutAlt}
          </span>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">CLS DIMENSIONS</span>
          <span
            className={`block text-sm font-bold mt-0.5 ${
              (vitals?.clsRiskCount || 0) > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {vitals?.clsRiskCount ?? 0}
          </span>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">LCP LAZY RISK</span>
          <span
            className={`block text-sm font-bold mt-0.5 ${
              (vitals?.lcpLazyDelayCount || 0) > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {vitals?.lcpLazyDelayCount ?? 0}
          </span>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">LEGACY FORMAT</span>
          <span
            className={`block text-sm font-bold mt-0.5 ${
              (vitals?.legacyFormatCount || 0) > 0 ? "text-sky-400" : "text-emerald-400"
            }`}
          >
            {vitals?.legacyFormatCount ?? 0}
          </span>
        </div>
      </div>

      {/* Filter Chips & Expand Toggle */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
              filter === "all"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-[#18181B] text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            All ({images.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("issues")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
              filter === "issues"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-[#18181B] text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            Issues ({images.filter((i) => i.issues.length > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("missing-alt")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
              filter === "missing-alt"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "bg-[#18181B] text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            Missing Alt ({imagesWithoutAlt})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#A1A1AA] hover:text-[#FAFAFA]"
        >
          <span>{isExpanded ? "Collapse" : "Inspect Images"}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded Images List */}
      {isExpanded && (
        <div className="mt-3 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredImages.length === 0 ? (
            <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3 text-center text-xs text-[#71717A]">
              No images match the selected filter.
            </div>
          ) : (
            filteredImages.map((img) => (
              <div
                key={img.id}
                className="rounded-lg border border-[#27272A] bg-[#18181B] p-2.5 text-xs space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="rounded bg-[#27272A] px-1.5 py-0.2 text-[9px] font-bold text-[#A1A1AA]">
                      #{img.placementIndex}
                    </span>
                    <span className="font-mono text-[11px] text-slate-300 truncate" title={img.src}>
                      {img.src.split("/").pop()?.split("?")[0] || "asset"}
                    </span>
                  </div>

                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                      img.priority === "High"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : img.priority === "Medium"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {img.format}
                  </span>
                </div>

                {/* ALT comparison */}
                <div className="space-y-1 rounded bg-[#111113] p-2 text-[11px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[#71717A] shrink-0 font-medium">Current Alt:</span>
                    <span className="text-[#FAFAFA] text-right truncate">
                      {img.isDecorative ? (
                        <span className="text-emerald-400 font-semibold">alt="" (WCAG Valid Decorative)</span>
                      ) : img.alt ? (
                        `"${img.alt}"`
                      ) : (
                        <span className="text-rose-400 font-semibold">[MISSING ATTRIBUTE]</span>
                      )}
                    </span>
                  </div>

                  {!img.isDecorative && img.proposedAlt && (
                    <div className="flex items-start justify-between gap-2 border-t border-[#27272A] pt-1 mt-1">
                      <span className="text-emerald-400 shrink-0 font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        <span>Optimized:</span>
                      </span>
                      <span className="text-emerald-300 font-medium text-right text-[11px]">
                        "{img.proposedAlt}"
                      </span>
                    </div>
                  )}

                  {img.targetFilename && (
                    <div className="flex items-start justify-between gap-2 border-t border-[#27272A] pt-1 mt-1 text-[10px]">
                      <span className="text-[#71717A] shrink-0">Target WebP:</span>
                      <span className="font-mono text-slate-400 truncate">
                        {img.targetFilename}
                      </span>
                    </div>
                  )}
                </div>

                {/* Issues Badges */}
                {img.issues.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {img.issues.map((iss, i) => (
                      <span
                        key={i}
                        className="rounded bg-rose-950/40 border border-rose-800/30 px-1.5 py-0.2 text-[9px] font-medium text-rose-300"
                      >
                        {iss}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
