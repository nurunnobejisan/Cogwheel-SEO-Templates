"use client";

import { useEffect, useState } from "react";
import {
  downloadManager,
  type DownloadState,
  type SupportedFileFormat,
} from "@/lib/download-manager";

const FORMAT_CONFIG: Record<
  SupportedFileFormat,
  { label: string; badgeCls: string; iconCls: string }
> = {
  xlsx: {
    label: "Excel Workbook",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconCls: "text-emerald-600",
  },
  csv: {
    label: "CSV Spreadsheet",
    badgeCls: "bg-sky-50 text-sky-700 border-sky-200",
    iconCls: "text-sky-600",
  },
  pptx: {
    label: "PowerPoint Deck",
    badgeCls: "bg-orange-50 text-orange-700 border-orange-200",
    iconCls: "text-orange-600",
  },
  json: {
    label: "JSON Document",
    badgeCls: "bg-violet-50 text-violet-700 border-violet-200",
    iconCls: "text-violet-600",
  },
  pdf: {
    label: "PDF Report",
    badgeCls: "bg-rose-50 text-rose-700 border-rose-200",
    iconCls: "text-rose-600",
  },
  txt: {
    label: "Text File",
    badgeCls: "bg-slate-50 text-slate-700 border-slate-200",
    iconCls: "text-slate-600",
  },
  file: {
    label: "File Deliverable",
    badgeCls: "bg-slate-50 text-slate-700 border-slate-200",
    iconCls: "text-slate-600",
  },
};

export function DownloadFeedbackModal() {
  const [state, setState] = useState<DownloadState>({ status: "idle" });

  useEffect(() => {
    return downloadManager.subscribe((s) => setState(s));
  }, []);

  if (state.status === "idle") return null;

  const { request } = state;
  const formatInfo = FORMAT_CONFIG[request.format] || FORMAT_CONFIG.file;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Download Status"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl transition-all duration-300">
        {/* Subtle decorative background gradient */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-50/60 blur-2xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-slate-100/60 blur-2xl" />

        {/* ─── STATE 1: COUNTDOWN ────────────────────────────────────────────── */}
        {state.status === "countdown" && (
          <div className="relative text-center">
            {/* Circular Countdown Ring */}
            <div className="mx-auto mb-4 flex items-center justify-center">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={264}
                    strokeDashoffset={
                      264 - (264 * (state.remainingSeconds / state.totalSeconds))
                    }
                    strokeLinecap="round"
                    className="text-brand transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-black text-slate-900 animate-pulse">
                    {state.remainingSeconds}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    sec
                  </span>
                </div>
              </div>
            </div>

            <h3 className="font-display text-lg font-bold text-slate-900">
              Starting Download...
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Your SEO report is ready and will begin downloading automatically.
            </p>

            {/* File info card */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-left">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${formatInfo.badgeCls}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800" title={request.filename}>
                  {request.filename}
                </p>
                <span className="text-[10px] font-medium text-slate-400">
                  {formatInfo.label} • Ready
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => downloadManager.cancel()}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => downloadManager.skipCountdown()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold font-display text-slate-900 shadow-glow hover:bg-brand-light transition active:scale-95"
              >
                <span>Download Now</span>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ─── STATE 2: DOWNLOADING IN PROGRESS ───────────────────────────────── */}
        {state.status === "downloading" && (
          <div className="relative text-center py-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-dark">
              <svg className="h-8 w-8 animate-bounce text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>

            <h3 className="font-display text-lg font-bold text-slate-900">
              Packaging Deliverable
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Saving <span className="font-semibold text-slate-700">{request.filename}</span> to your device...
            </p>

            {/* Progress bar */}
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* ─── STATE 3: COMPLETED WITH SUCCESS VISUAL ────────────────────────── */}
        {state.status === "completed" && (
          <div className="relative text-center py-2 animate-fade-in">
            {/* Green glowing checkmark icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md ring-8 ring-emerald-50">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="font-display text-lg font-bold text-slate-900">
              Download Complete!
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Your file was generated and saved to your default downloads folder.
            </p>

            {/* File info badge */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-emerald-950" title={request.filename}>
                  {request.filename}
                </p>
                <span className="text-[10px] font-semibold text-emerald-700">
                  {formatInfo.label} • Successfully Downloaded
                </span>
              </div>
              <span className="shrink-0 rounded-md bg-emerald-200/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                SAVED
              </span>
            </div>

            {/* Done button */}
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => downloadManager.dismiss()}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition active:scale-98"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
