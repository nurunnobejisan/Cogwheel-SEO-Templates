"use client";

import { useState } from "react";
import { Button } from "./ui";

interface SlideDeckPreviewProps {
  propertyName?: string;
  propertyCity?: string;
  propertyState?: string;
  matchedServices?: string[];
  reportMonth?: string;
  /** Generates the real deck in callers that have a report pipeline. */
  onDownloadPptx?: () => void | Promise<void>;
  onClose?: () => void;
}

export function SlideDeckPreview({
  propertyName = "",
  propertyCity = "",
  propertyState = "",
  matchedServices = [],
  reportMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
  onDownloadPptx,
  onClose,
}: SlideDeckPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(1);
  const totalSlides = 5;

  // Operator-entered values only: the preview ships with no ranking dataset.
  const [executiveNote, setExecutiveNote] = useState("");
  const [top10Count, setTop10Count] = useState(0);
  const [improvedCount, setImprovedCount] = useState(0);

  const handleNext = () => setCurrentSlide((prev) => (prev < totalSlides ? prev + 1 : 1));
  const handlePrev = () => setCurrentSlide((prev) => (prev > 1 ? prev - 1 : totalSlides));

  return (
    <div className="flex flex-col space-y-4">
      {/* Top Carousel Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-brand px-2.5 py-1 text-caption font-bold text-slate-900">
            Slide {currentSlide} of {totalSlides}
          </span>
          <span className="font-display text-body font-bold text-slate-900 dark:text-white">
            {currentSlide === 1 && "Cover Slide"}
            {currentSlide === 2 && "Tracked Rankings & Executive Insights"}
            {currentSlide === 3 && "Ancillary Keyword Position Summary"}
            {currentSlide === 4 && "Why Track & Full Keyword Visibility"}
            {currentSlide === 5 && "SEO Health & Action Items"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Slide jump pills */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCurrentSlide(s)}
                className={`h-7 w-7 rounded-lg text-caption font-bold transition ${
                  currentSlide === s
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <Button variant="ghost" onClick={handlePrev} className="px-2.5 py-1.5 text-caption">
            Previous
          </Button>
          <Button variant="ghost" onClick={handleNext} className="px-2.5 py-1.5 text-caption">
            Next
          </Button>

          {onDownloadPptx ? (
            <Button variant="primary" onClick={() => void onDownloadPptx()} className="text-caption py-1.5">
              Generate .pptx
            </Button>
          ) : (
            <span className="text-tiny text-slate-500">
              Preview only — export a measured deck from Full Website Audit
            </span>
          )}
        </div>
      </div>

      {/* Main 16:9 Presentation Canvas */}
      <div className="relative aspect-[16/9] w-full max-w-5xl mx-auto overflow-hidden rounded-2xl border-4 border-slate-800 bg-slate-950 text-slate-900 shadow-2xl transition-all">
        {/* SLIDE 1: COVER */}
        {currentSlide === 1 && (
          <div className="relative flex h-full w-full flex-col justify-between bg-gradient-to-br from-[#1a1235] via-[#2d1b54] to-[#120824] p-8 md:p-14 text-white">
            <div className="flex items-center justify-between border-b border-purple-800/40 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-brand" />
                <span className="font-display text-body font-extrabold tracking-wider uppercase text-purple-200">
                  SEO STUDIO MARKETING
                </span>
              </div>
              <span className="rounded-md bg-purple-900/60 px-3 py-1 font-mono text-caption text-purple-200 border border-purple-700/50">
                {reportMonth}
              </span>
            </div>

            <div className="max-w-2xl py-6">
              <span className="rounded-full bg-brand/20 px-3 py-1 text-caption font-bold text-brand-light border border-brand/30">
                Monthly Performance Deliverable
              </span>
              <h1 className="mt-4 font-display text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-white">
                {propertyName}
              </h1>
              <p className="mt-3 text-body md:text-lg text-purple-200 font-medium">
                Search Engine &amp; AI Visibility Performance Review
              </p>
              <div className="mt-4 flex items-center gap-3 text-caption text-purple-300 font-mono">
                <span>{[propertyCity, propertyState].filter(Boolean).join(", ") || "Property location not set"}</span>
                <span>•</span>
                <span>Layout preview — no metrics included</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-purple-800/40 pt-4 text-caption text-purple-300">
              <span>Prepared for General Manager &amp; Ownership</span>
              <span className="text-tiny text-purple-400">confidential &bull; internal client presentation</span>
            </div>
          </div>
        )}

        {/* SLIDE 2: TRACKED RANKINGS & INSIGHTS */}
        {currentSlide === 2 && (
          <div className="flex h-full w-full flex-col bg-white p-6 md:p-10">
            {/* Header banner */}
            <div className="flex items-center justify-between bg-[#381a5e] px-6 py-3 rounded-xl text-white">
              <h2 className="font-display text-lg md:text-xl font-bold tracking-tight">
                Tracked Rankings &amp; Insights
              </h2>
              <span className="text-caption font-bold text-brand uppercase tracking-wider">
                SEO STUDIO MARKETING
              </span>
            </div>

            {/* KPI Badges */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <span className="text-micro font-bold uppercase text-slate-500">Top 10 Rankings</span>
                <div className="font-display text-2xl font-extrabold text-slate-900">
                  <input
                    type="number"
                    value={top10Count}
                    onChange={(e) => setTop10Count(Number(e.target.value))}
                    className="w-14 text-center bg-transparent border-b border-dashed border-slate-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <span className="text-micro font-bold uppercase text-emerald-700">Rankings Improved</span>
                <div className="font-display text-2xl font-extrabold text-emerald-700">
                  +
                  <input
                    type="number"
                    value={improvedCount}
                    onChange={(e) => setImprovedCount(Number(e.target.value))}
                    className="w-12 text-center bg-transparent border-b border-dashed border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-center">
                <span className="text-micro font-bold uppercase text-purple-700">Reporting Window</span>
                <div className="font-display text-body md:text-base font-bold text-purple-900 mt-1">
                  {reportMonth}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <p className="text-caption font-bold text-slate-700">No verified keyword rows loaded</p>
                <p className="mt-1 text-tiny leading-relaxed text-slate-500">
                  Rankings and search volumes must come from your rank tracker or the measured
                  audit. This layout preview intentionally ships without numbers.
                </p>
              </div>

              {/* Editable Executive Insight Box */}
              <div className="flex flex-col justify-between rounded-xl border border-purple-300 bg-purple-50/60 p-4">
                <div>
                  <div className="flex items-center gap-1.5 text-caption font-bold text-[#381a5e]">
                    Executive Insight (Click to edit)
                  </div>
                  <textarea
                    value={executiveNote}
                    onChange={(e) => setExecutiveNote(e.target.value)}
                    rows={4}
                    className="mt-2 w-full resize-none rounded-lg border border-purple-200 bg-white p-2 text-caption text-slate-800 shadow-inner focus:border-brand focus:outline-none"
                  />
                </div>
                <div className="text-micro text-purple-700 font-medium">
                  &bull; This insight updates live before final PPTX download.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 3: ANCILLARY KEYWORDS */}
        {currentSlide === 3 && (
          <div className="flex h-full w-full flex-col bg-white p-6 md:p-10">
            <div className="flex items-center justify-between bg-[#381a5e] px-6 py-3 rounded-xl text-white">
              <h2 className="font-display text-lg md:text-xl font-bold tracking-tight">
                Ancillary Keyword Position Summary
              </h2>
              <span className="text-caption font-bold text-brand uppercase tracking-wider">
                SEO STUDIO MARKETING
              </span>
            </div>

            {/* Matched Services Tags */}
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-caption font-bold text-slate-700">Matched Property Services:</span>
              {matchedServices.map((service, idx) => (
                <span
                  key={idx}
                  className="rounded-full bg-emerald-100 px-3 py-0.5 text-caption font-bold text-emerald-800 border border-emerald-300"
                >
                  {service}
                </span>
              ))}
            </div>

            {/* Ancillary Table */}
            <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <p className="text-caption font-bold text-slate-700">No ancillary keyword rows loaded</p>
              <p className="mt-1 max-w-xl text-tiny leading-relaxed text-slate-500">
                Connect a rank tracker or paste verified rows before producing a client deck. The
                template does not generate keyword positions or volumes.
              </p>
            </div>

            <div className="mt-3 text-tiny text-slate-500">
              * Unmatched services are filtered out automatically to maintain 100% relevant client reporting.
            </div>
          </div>
        )}

        {/* SLIDE 4: WHY TRACK */}
        {currentSlide === 4 && (
          <div className="flex h-full w-full flex-col bg-white p-6 md:p-10">
            <div className="flex items-center justify-between bg-[#381a5e] px-6 py-3 rounded-xl text-white">
              <h2 className="font-display text-lg md:text-xl font-bold tracking-tight">
                Why Track &amp; Full Visibility Rationale
              </h2>
              <span className="text-caption font-bold text-brand uppercase tracking-wider">
                SEO STUDIO MARKETING
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-5 flex-1">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-body text-[#381a5e]">The Purpose of Tracking</h3>
                <p className="mt-2 text-caption text-slate-600 leading-relaxed">
                  SEO is an ongoing visibility investment. Monitoring keyword positions reveals shift patterns before they impact revenue, allowing immediate optimization against OTA displacement and local comp-set moves.
                </p>
                <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-caption text-emerald-800 font-semibold">
                  Track direct-booking queries alongside OTA queries to see where organic visibility supports net revenue.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-body text-[#381a5e]">Workbook Integration</h3>
                <p className="mt-2 text-caption text-slate-600 leading-relaxed">
                  Verified keyword rows can be mapped to landing pages, seasonal demand and difficulty in your rank tracker. This preview ships without a dataset.
                </p>
                <div className="mt-4 rounded-lg bg-purple-50 border border-purple-200 p-2.5 text-caption text-purple-900 font-mono">
                  No keyword count is assumed until a tracker is connected.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 5: SEO HEALTH & ACTIONS */}
        {currentSlide === 5 && (
          <div className="flex h-full w-full flex-col bg-white p-6 md:p-10">
            <div className="flex items-center justify-between bg-[#381a5e] px-6 py-3 rounded-xl text-white">
              <h2 className="font-display text-lg md:text-xl font-bold tracking-tight">
                Technical SEO Health &amp; Next Steps
              </h2>
              <span className="text-caption font-bold text-brand uppercase tracking-wider">
                SEO STUDIO MARKETING
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 flex-1">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-micro font-bold text-emerald-800">
                  NOT MEASURED
                </span>
                <h3 className="mt-2 font-bold text-body text-slate-900">Technical health</h3>
                <p className="mt-1 text-caption text-slate-600">
                  Run Full Website Audit to populate Core Web Vitals and technical findings. No
                  sample score is shown here.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-micro font-bold text-amber-800">
                  FROM THE REPORT
                </span>
                <h3 className="mt-2 font-bold text-body text-slate-900">Measured actions</h3>
                <p className="mt-1 text-caption text-slate-600">
                  Use the P0/P1 items from the audit action plan instead of template assumptions.
                </p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-micro font-bold text-purple-800">
                  TO BE SET
                </span>
                <h3 className="mt-2 font-bold text-body text-slate-900">Client priorities</h3>
                <p className="mt-1 text-caption text-slate-600">
                  Agree the focus with the account manager; the template does not assume rankings
                  or competitor positions.
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-caption text-slate-400 border-t border-slate-100 pt-3">
              <span>Prepared by SEO</span>
              <span>Next review: set by account manager</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="flex items-center justify-center gap-3 py-2 overflow-x-auto">
        {[1, 2, 3, 4, 5].map((idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentSlide(idx)}
            className={`group relative flex h-14 w-24 flex-col justify-between overflow-hidden rounded-lg border-2 p-1.5 text-micro transition ${
              currentSlide === idx
                ? "border-brand bg-slate-900 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <span className="font-bold">Slide {idx}</span>
            <span className="truncate text-micro opacity-75">
              {idx === 1 && "Cover"}
              {idx === 2 && "Rankings"}
              {idx === 3 && "Ancillary"}
              {idx === 4 && "Why Track"}
              {idx === 5 && "SEO Health"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
