"use client";

import { useState } from "react";
import { SeoBaselineModal } from "./SeoBaselineModal";
import { SeoVisibilityReportModal } from "./SeoVisibilityReportModal";
import { SlideDeckPreview } from "./SlideDeckPreview";
import { ExecutiveMemoModal } from "./ExecutiveMemoModal";
import { ClientEmailDispatcher } from "./ClientEmailDispatcher";
import { Button } from "./ui";

interface Props {
  initialTab?: "pptx" | "slides" | "preview" | "memo" | "email";
  defaultProperty?: { name?: string; url?: string; city?: string; state?: string };
  onClose: () => void;
  onCompleted: () => void;
}

export function ClientDeliverablesModal({
  initialTab = "pptx",
  defaultProperty,
  onClose,
  onCompleted,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "pptx" | "slides" | "preview" | "memo" | "email"
  >(initialTab);

  return (
    <div className="space-y-4">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light dark:bg-brand dark:text-slate-900">
            Deliverables
          </span>
          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Client Presentation &amp; Report Studio
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("pptx")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "pptx"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              📊 PowerPoint Generator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "preview"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              🖥️ Live Slide Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("memo")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "memo"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              📄 1-Page Owner Memo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("email")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "email"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              ✉️ Email Client
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("slides")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "slides"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              📑 Google Slides
            </button>
          </div>

          <Button variant="ghost" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === "pptx" && (
        <SeoVisibilityReportModal
          defaultProperty={defaultProperty}
          onClose={onClose}
          onCompleted={onCompleted}
        />
      )}

      {activeTab === "preview" && (
        <SlideDeckPreview
          propertyName={defaultProperty?.name}
          propertyCity={defaultProperty?.city}
          propertyState={defaultProperty?.state}
          onClose={onClose}
        />
      )}

      {activeTab === "memo" && (
        <ExecutiveMemoModal
          property={defaultProperty}
          onClose={onClose}
          onOpenEmail={() => setActiveTab("email")}
        />
      )}

      {activeTab === "email" && (
        <ClientEmailDispatcher
          propertyName={defaultProperty?.name}
          propertyCity={defaultProperty?.city}
          propertyState={defaultProperty?.state}
          onClose={onClose}
        />
      )}

      {activeTab === "slides" && (
        <SeoBaselineModal
          defaultProperty={defaultProperty}
          onClose={onClose}
          onCompleted={onCompleted}
        />
      )}
    </div>
  );
}
