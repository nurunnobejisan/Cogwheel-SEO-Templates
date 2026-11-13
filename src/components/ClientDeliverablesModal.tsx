"use client";

import { useState } from "react";
import { SeoBaselineModal } from "./SeoBaselineModal";
import { SeoVisibilityReportModal } from "./SeoVisibilityReportModal";
import { Button } from "./ui";

interface Props {
  initialTab?: "pptx" | "slides";
  defaultProperty?: { name?: string; url?: string };
  onClose: () => void;
  onCompleted: () => void;
}

export function ClientDeliverablesModal({
  initialTab = "pptx",
  defaultProperty,
  onClose,
  onCompleted,
}: Props) {
  const [activeTab, setActiveTab] = useState<"pptx" | "slides">(initialTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light">
            Deliverables
          </span>
          <span className="font-display text-sm font-bold text-slate-900">
            Client Presentation &amp; Report Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("pptx")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "pptx"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📊 PowerPoint Monthly Visibility Deck
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("slides")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "slides"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📑 Google Slides Baseline &amp; AI Visibility
            </button>
          </div>

          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {activeTab === "pptx" ? (
        <SeoVisibilityReportModal onClose={onClose} onCompleted={onCompleted} />
      ) : (
        <SeoBaselineModal
          defaultProperty={defaultProperty}
          onClose={onClose}
          onCompleted={onCompleted}
        />
      )}
    </div>
  );
}
