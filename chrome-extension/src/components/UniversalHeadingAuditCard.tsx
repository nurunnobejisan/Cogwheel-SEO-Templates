import React, { useState } from "react";
import {
  Heading,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ListTree,
} from "lucide-react";
import { HeadingHierarchyItem } from "../types/extension";

interface Props {
  hierarchy?: HeadingHierarchyItem[];
  issues?: string[];
  h1Count: number;
  h2Count: number;
  h3Count: number;
}

export function UniversalHeadingAuditCard({
  hierarchy = [],
  issues = [],
  h1Count,
  h2Count,
  h3Count,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTagBadgeColor = (tag: string) => {
    switch (tag) {
      case "H1":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "H2":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "H3":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "H4":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA] shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272A] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10 text-sky-400">
            <Heading className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
              HEADING STRUCTURE &amp; HIERARCHY AUDIT
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-[#FAFAFA]">
                {hierarchy.length} Headings in DOM Order
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${
                  issues.length === 0
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                }`}
              >
                {issues.length === 0 ? "Hierarchy Optimal" : `${issues.length} Hierarchy Warnings`}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#A1A1AA] hover:text-[#FAFAFA]"
        >
          <span>{isExpanded ? "Collapse" : "Inspect Tree"}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Mini Distribution Grid */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-xs">
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">H1 PRIMARY</span>
          <span
            className={`block text-sm font-bold mt-0.5 ${
              h1Count === 1 ? "text-emerald-400" : h1Count === 0 ? "text-rose-400" : "text-amber-400"
            }`}
          >
            {h1Count}
          </span>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">H2 SECTIONS</span>
          <span className="block text-sm font-bold text-sky-400 mt-0.5">{h2Count}</span>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">H3 SUBHEADS</span>
          <span className="block text-sm font-bold text-purple-400 mt-0.5">{h3Count}</span>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2">
          <span className="block text-[9px] font-medium text-[#71717A] uppercase">TOTAL DOM</span>
          <span className="block text-sm font-bold text-slate-300 mt-0.5">{hierarchy.length}</span>
        </div>
      </div>

      {/* Issues Banner */}
      {issues.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-amber-800/30 bg-amber-950/20 p-2.5 text-xs text-amber-200">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Heading Hierarchy Defects</span>
          </div>
          <ul className="space-y-1 pl-4 text-[11px] list-disc text-amber-300/90">
            {issues.map((iss, i) => (
              <li key={i}>{iss}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Expanded Document Order Tree */}
      {isExpanded && (
        <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {hierarchy.map((h, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-2.5 text-xs transition space-y-1 ${
                h.isMultipleH1 || h.isSkippedLevel
                  ? "border-amber-800/40 bg-amber-950/10"
                  : h.isEmpty
                  ? "border-rose-800/40 bg-rose-950/10"
                  : "border-[#27272A] bg-[#18181B]"
              }`}
              style={{ marginLeft: `${Math.min(h.level - 1, 3) * 12}px` }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold ${getTagBadgeColor(
                      h.tag
                    )}`}
                  >
                    {h.tag}
                  </span>
                  <span className="text-[10px] text-[#71717A] tabular-nums">
                    Level {h.level} • {h.text.length} chars
                  </span>
                </div>

                {h.isSkippedLevel && (
                  <span className="rounded bg-amber-900/40 border border-amber-700/40 px-1 text-[8px] font-bold text-amber-300">
                    SKIPPED LEVEL
                  </span>
                )}
                {h.isMultipleH1 && (
                  <span className="rounded bg-rose-900/40 border border-rose-700/40 px-1 text-[8px] font-bold text-rose-300">
                    DUPLICATE H1
                  </span>
                )}
              </div>

              <div className="text-[11px] font-medium text-[#FAFAFA] break-words">
                {h.isEmpty ? (
                  <span className="italic text-rose-400 font-semibold">[EMPTY HEADING ELEMENT]</span>
                ) : (
                  `"${h.text}"`
                )}
              </div>

              {h.suggestedTitleCase && h.suggestedTitleCase !== h.text && (
                <div className="flex items-start gap-1 border-t border-[#27272A] pt-1 text-[10px] text-emerald-400">
                  <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>
                    Suggested Title Case:{" "}
                    <span className="font-semibold text-emerald-300">{h.suggestedTitleCase}</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
