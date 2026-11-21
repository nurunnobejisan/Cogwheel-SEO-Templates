import React, { useState } from "react";
import { Eye, Image as ImageIcon, Link as LinkIcon, Code2, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { PageAuditData } from "../types/extension";

interface Props {
  data: PageAuditData;
  activeTabId?: number;
}

export function DomOverlayInspector({ data, activeTabId }: Props) {
  const [headingsActive, setHeadingsActive] = useState(false);
  const [missingAltsActive, setMissingAltsActive] = useState(false);
  const [linksActive, setLinksActive] = useState(false);
  const [expandedSchemaIndex, setExpandedSchemaIndex] = useState<number | null>(0);

  const toggleOverlay = (type: "headings" | "missingAlts" | "links", currentState: boolean, setter: (v: boolean) => void) => {
    const nextState = !currentState;
    setter(nextState);

    if (activeTabId && chrome.tabs && chrome.tabs.sendMessage) {
      chrome.tabs.sendMessage(activeTabId, {
        type: "TOGGLE_OVERLAY",
        overlayType: type,
        enabled: nextState,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual Toggles Grid */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          LIVE ON-PAGE VISUAL OVERLAYS
        </span>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Injects real-time visual inspection badges and outlines directly onto the active hotel page.
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {/* Toggle 1: Headings */}
          <button
            type="button"
            onClick={() => toggleOverlay("headings", headingsActive, setHeadingsActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              headingsActive
                ? "border-emerald-500 bg-emerald-50/80 shadow-xs dark:border-emerald-700 dark:bg-emerald-950/40"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Eye className={`h-4 w-4 ${headingsActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold ${headingsActive ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>
                {headingsActive ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Headings Tree</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">H1–H6 Badges</div>
            </div>
          </button>

          {/* Toggle 2: Missing Alts */}
          <button
            type="button"
            onClick={() => toggleOverlay("missingAlts", missingAltsActive, setMissingAltsActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              missingAltsActive
                ? "border-rose-500 bg-rose-50/80 shadow-xs dark:border-rose-700 dark:bg-rose-950/40"
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
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{data.imagesWithoutAlt} issues</div>
            </div>
          </button>

          {/* Toggle 3: Links */}
          <button
            type="button"
            onClick={() => toggleOverlay("links", linksActive, setLinksActive)}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              linksActive
                ? "border-sky-500 bg-sky-50/80 shadow-xs dark:border-sky-700 dark:bg-sky-950/40"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <LinkIcon className={`h-4 w-4 ${linksActive ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold ${linksActive ? "text-sky-700 dark:text-sky-300" : "text-slate-400"}`}>
                {linksActive ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Link Classifier</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Int / Ext / Nofollow</div>
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
              const sType = schema["@type"] || "Schema Object";

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
