import React, { useState } from "react";
import {
  Eye,
  Image as ImageIcon,
  Link as LinkIcon,
  Code2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  BookmarkCheck,
} from "lucide-react";
import { PageAuditData } from "../types/extension";

interface Props {
  data: PageAuditData;
  activeTabId?: number;
}

export type OverlayType = "headings" | "missingAlts" | "schemas" | "bookingLinks" | "geoBlocks";

export function DomOverlayInspector({ data, activeTabId }: Props) {
  const [headingsActive, setHeadingsActive] = useState(false);
  const [missingAltsActive, setMissingAltsActive] = useState(false);
  const [schemasActive, setSchemasActive] = useState(false);
  const [bookingLinksActive, setBookingLinksActive] = useState(false);
  const [geoBlocksActive, setGeoBlocksActive] = useState(false);
  const [expandedSchemaIndex, setExpandedSchemaIndex] = useState<number | null>(0);

  const toggleOverlay = (type: OverlayType, currentState: boolean, setter: (v: boolean) => void) => {
    const nextState = !currentState;
    setter(nextState);

    if (activeTabId && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.sendMessage) {
      chrome.tabs.sendMessage(
        activeTabId,
        {
          type: "TOGGLE_OVERLAY",
          overlayType: type,
          enabled: nextState,
        },
        () => {
          if (chrome.runtime.lastError) {
            // Handled gracefully when active tab is not scriptable or disconnected
          }
        }
      );
    }
  };

  const handleClearAllOverlays = () => {
    setHeadingsActive(false);
    setMissingAltsActive(false);
    setSchemasActive(false);
    setBookingLinksActive(false);
    setGeoBlocksActive(false);

    if (activeTabId && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.sendMessage) {
      chrome.tabs.sendMessage(
        activeTabId,
        {
          type: "CLEAR_ALL_OVERLAYS",
        },
        () => {
          if (chrome.runtime.lastError) {
            // Handled gracefully
          }
        }
      );
    }
  };

  const activeOverlayCount =
    (headingsActive ? 1 : 0) +
    (missingAltsActive ? 1 : 0) +
    (schemasActive ? 1 : 0) +
    (bookingLinksActive ? 1 : 0) +
    (geoBlocksActive ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Visual Toggles Grid */}
      <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA]">
        <div className="flex items-center justify-between border-b border-[#27272A] pb-2.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
              LIVE ON-PAGE VISUAL OVERLAYS
            </span>
            <p className="mt-0.5 text-xs text-[#A1A1AA]">
              Injects non-destructive visual highlight badges and inspection outlines onto the active page.
            </p>
          </div>

          {/* Clear All Overlays Reset Button */}
          <button
            type="button"
            onClick={handleClearAllOverlays}
            disabled={activeOverlayCount === 0}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition shadow-xs ${
              activeOverlayCount > 0
                ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                : "bg-[#18181B] text-[#71717A] border border-[#27272A] cursor-not-allowed"
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="tabular-nums">Clear All Overlays {activeOverlayCount > 0 && `(${activeOverlayCount})`}</span>
          </button>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Toggle 1: H1–H3 Heading Hierarchy */}
          <button
            type="button"
            onClick={() => toggleOverlay("headings", headingsActive, setHeadingsActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              headingsActive
                ? "border-emerald-500/40 bg-emerald-500/10 text-[#FAFAFA]"
                : "border-[#27272A] bg-[#18181B] hover:border-[#3F3F46] text-[#A1A1AA]"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Eye className={`h-4 w-4 ${headingsActive ? "text-emerald-400" : "text-[#71717A]"}`} />
              <span className={`text-[10px] font-semibold tracking-wide ${headingsActive ? "text-emerald-400" : "text-[#71717A]"}`}>
                {headingsActive ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-semibold text-[#FAFAFA]">Heading Hierarchy</div>
              <div className="text-[10px] text-[#A1A1AA] tabular-nums">
                H1–H3 Badges ({data.h1Elements.length} H1, {data.h2Elements.length} H2)
              </div>
            </div>
          </button>

          {/* Toggle 2: Images Missing Alt Text */}
          <button
            type="button"
            onClick={() => toggleOverlay("missingAlts", missingAltsActive, setMissingAltsActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition shadow-xs ${
              missingAltsActive
                ? "border-rose-500 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/40"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <ImageIcon className={`h-4 w-4 ${missingAltsActive ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold ${missingAltsActive ? "text-rose-700 dark:text-rose-300" : "text-slate-400"}`}>
                {missingAltsActive ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Missing Alt Text</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{data.imagesWithoutAlt} images detected</div>
            </div>
          </button>

          {/* Toggle 3: Validated JSON-LD Entities */}
          <button
            type="button"
            onClick={() => toggleOverlay("schemas", schemasActive, setSchemasActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition shadow-xs ${
              schemasActive
                ? "border-emerald-500 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/40"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Code2 className={`h-4 w-4 ${schemasActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold ${schemasActive ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>
                {schemasActive ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Validated JSON-LD</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {data.schemas.length} schema entities pinned
              </div>
            </div>
          </button>

          {/* Toggle 4: Internal Direct-Booking Links */}
          <button
            type="button"
            onClick={() => toggleOverlay("bookingLinks", bookingLinksActive, setBookingLinksActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition shadow-xs ${
              bookingLinksActive
                ? "border-sky-500 bg-sky-50/80 dark:border-sky-700 dark:bg-sky-950/40"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <LinkIcon className={`h-4 w-4 ${bookingLinksActive ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold ${bookingLinksActive ? "text-sky-700 dark:text-sky-300" : "text-slate-400"}`}>
                {bookingLinksActive ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Direct-Booking CTAs</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {(data.internalUrls?.length || 0)} internal navigation links
              </div>
            </div>
          </button>

          {/* Toggle 5: GEO AI Answer Blocks */}
          <button
            type="button"
            onClick={() => toggleOverlay("geoBlocks", geoBlocksActive, setGeoBlocksActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition shadow-xs sm:col-span-2 lg:col-span-1 ${
              geoBlocksActive
                ? "border-purple-500 bg-purple-50/80 dark:border-purple-700 dark:bg-purple-950/40"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Sparkles className={`h-4 w-4 ${geoBlocksActive ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold ${geoBlocksActive ? "text-purple-700 dark:text-purple-300" : "text-slate-400"}`}>
                {geoBlocksActive ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">GEO AI Answer Blocks</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">FAQ &amp; spatial targets</div>
            </div>
          </button>
        </div>
      </div>

      {/* Heading Structure Visual Tree */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            DETECTED HEADING STRUCTURE ({data.h1Elements.length} H1, {data.h2Elements.length} H2)
          </span>
        </div>

        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
          {data.h1Elements.length === 0 ? (
            <div className="rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              Zero H1 headings found on page.
            </div>
          ) : (
            data.h1Elements.map((h1, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30"
              >
                <span className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                  H1 {i > 0 && `(Duplicate #${i + 1})`}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {h1}
                </span>
              </div>
            ))
          )}

          {data.h2Elements.map((h2, i) => (
            <div
              key={i}
              className="ml-4 flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span className="shrink-0 rounded-md bg-sky-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                H2
              </span>
              <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {h2}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* JSON-LD Structured Data Visual Tree Viewer */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              JSON-LD SCHEMA TREE VIEWER ({data.schemas.length} BLOCKS)
            </span>
          </div>
          <a
            href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(data.url)}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold text-sky-600 hover:underline dark:text-sky-400"
          >
            Google Rich Test &rarr;
          </a>
        </div>

        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {data.schemas.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400">
              No JSON-LD structured data detected on this page.
            </div>
          ) : (
            data.schemas.map((schema, idx) => {
              const isExpanded = expandedSchemaIndex === idx;
              const sType = String(schema["@type"] || "Schema Object");

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedSchemaIndex(isExpanded ? null : idx)}
                    className="flex w-full items-center justify-between p-2.5 text-left text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {sType}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {Object.keys(schema).length} fields
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-900 dark:bg-slate-900/50">
                      <pre className="font-mono text-[10px] leading-relaxed text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
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
