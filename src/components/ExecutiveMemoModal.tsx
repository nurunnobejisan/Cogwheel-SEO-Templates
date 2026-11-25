"use client";

import { useState } from "react";
import { Button } from "./ui";

interface ExecutiveMemoProps {
  property?: {
    name?: string;
    brand?: string;
    city?: string;
    state?: string;
    url?: string;
  };
  onClose?: () => void;
  onOpenEmail?: () => void;
}

/**
 * Executive memo template.
 *
 * The layout is client-ready, but it contains no metrics of its own: rankings,
 * share of voice, revenue influence and citation scores must be added from a
 * measured audit or rank tracker before the memo is sent.
 */
export function ExecutiveMemoModal({
  property,
  onClose,
  onOpenEmail,
}: ExecutiveMemoProps) {
  const propertyName = property?.name?.trim() || "Property name not set";
  const location = [property?.city, property?.state].filter(Boolean).join(", ");
  const reportDate = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const [copied, setCopied] = useState(false);

  const memoText = `EXECUTIVE MEMORANDUM
TO: General Manager & Asset Management, ${propertyName}
FROM: Cogwheel SEO
DATE: ${reportDate}
SUBJECT: Monthly Organic Search & Generative Engine Visibility Briefing

STATUS: TEMPLATE — NO VERIFIED METRICS HAVE BEEN ADDED

This memo intentionally contains no rankings, search volumes, revenue influence
or AI citation scores. Add verified values from your rank tracker or the measured
Full Website Audit before sending.

CHECKLIST
1. Run Full Website Audit for the property.
2. Export the report (HTML/PDF/PPTX) and attach it.
3. Replace each placeholder below with a measured value, or remove the line.
4. Confirm the reporting window and keyword set with the account team.

PLACEHOLDERS
- Top 10 search positions: [add verified count]
- Share of voice: [add measured share]
- Revenue influence: [add modelled value and methodology]
- AI / GEO citation score: [not measured unless an AI engine was queried]

NEXT ACTIONS
- [Add the P0/P1 items from the audit action plan]
- [Add owner and due date]

Prepared with Cogwheel SEO Intelligence Suite.`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(memoText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Controls (hidden on print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light">
            1-Page Template
          </span>
          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Executive Owner &amp; GM Memo
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleCopy} className="text-xs">
            {copied ? "Copied" : "Copy Text"}
          </Button>

          {onOpenEmail && (
            <Button variant="secondary" onClick={onOpenEmail} className="text-xs">
              Email Deliverable
            </Button>
          )}

          <Button variant="primary" onClick={handlePrint} className="text-xs">
            Print / Save as PDF
          </Button>

          {onClose && (
            <Button variant="ghost" onClick={onClose} className="text-xs">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Strict 1-Page Printable Layout Canvas */}
      <div className="print-page mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 md:p-12 shadow-md text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 font-sans">
        {/* Memo Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 dark:border-slate-700">
          <div>
            <div className="font-display text-xs font-bold uppercase tracking-widest text-[#381a5e] dark:text-brand-light">
              COGWHEEL MARKETING &bull; EXECUTIVE PERFORMANCE BRIEF
            </div>
            <h1 className="mt-1 font-display text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
              {propertyName}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {location || "Location not set"} &bull; Monthly Search &amp; GEO Visibility Memorandum
            </p>
          </div>
          <div className="text-right">
            <div className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {reportDate}
            </div>
            <span className="mt-1 block text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Template — not measured
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>No metrics are included in this template.</strong> Add verified rankings, search
          volumes and revenue figures before sending. The memo will not invent them for you.
        </div>

        {/* 4 KPI placeholders */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Top 10 Rankings", note: "Add from rank tracker" },
            { label: "Share of Voice", note: "Requires measured share" },
            { label: "Revenue Influence", note: "Add model + methodology" },
            { label: "AI & GEO Readiness", note: "Not measured" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {kpi.label}
              </span>
              <div className="mt-1 font-display text-2xl font-black text-slate-400 dark:text-slate-500">
                —
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500">{kpi.note}</div>
            </div>
          ))}
        </div>

        {/* Section 1: Top Search Wins */}
        <div className="mt-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-800">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              1. Top Organic Search Wins (Current Cycle)
            </h2>
            <span className="text-[10px] text-slate-500">Populate from rank tracker</span>
          </div>

          <div className="mt-2 rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No verified keyword rows loaded. Export the audit or paste ranked queries with their
            reporting window before producing the client memo.
          </div>
        </div>

        {/* Section 2: Local Comp-Set Summary */}
        <div className="mt-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-800">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              2. Local Comp-Set Positioning
            </h2>
            <span className="text-[10px] text-slate-500">Requires competitor data</span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            No competitor comparison is included. Add the comp-set and their measured positions from
            your rank tracker; the template does not assume competitor names or rank gaps.
          </p>
        </div>

        {/* Section 3: How to complete */}
        <div className="mt-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-800">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              3. Next Steps Before Sending
            </h2>
            <span className="text-[10px] text-slate-500">Checklist</span>
          </div>

          <div className="mt-2 space-y-2 text-xs">
            {[
              "Run the Full Website Audit for the property.",
              "Export the report (HTML/PDF/PPTX) and attach it to the email.",
              "Replace each placeholder with a measured value, or remove the line.",
              "Confirm the reporting window and keyword set with the account team.",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900"
              >
                <span className="font-bold text-[#381a5e] dark:text-brand-light">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-slate-600 dark:text-slate-300">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Memo Footer */}
        <div className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400 dark:border-slate-800">
          Generated by Cogwheel SEO Intelligence Suite &bull; Confidential &bull; Single-Page Format
          &bull; Template only — add verified metrics before distribution
        </div>
      </div>
    </div>
  );
}
