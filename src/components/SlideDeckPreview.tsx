"use client";

import { useState } from "react";
import { Button } from "./ui";
import { downloadManager } from "@/lib/download-manager";

interface SlideDeckPreviewProps {
  propertyName?: string;
  propertyCity?: string;
  propertyState?: string;
  matchedServices?: string[];
  reportMonth?: string;
  onDownloadPptx?: () => void;
  onClose?: () => void;
}

export function SlideDeckPreview({
  propertyName = "Renaissance Shoals Resort & Spa",
  propertyCity = "Florence",
  propertyState = "AL",
  matchedServices = ["Hotel & Lodging", "Resort & Getaways", "Spa & Wellness"],
  reportMonth = "November 2026",
  onDownloadPptx,
  onClose,
}: SlideDeckPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(1);
  const totalSlides = 5;

  // Editable text notes for quick customizations before download
  const [executiveNote, setExecutiveNote] = useState(
    "High-intent local terms saw notable upward momentum this cycle. The property reclaimed the #1 spot for 'florence alabama resort' and gained +4 overall positions on dining and spa discovery phrases."
  );
  const [top10Count, setTop10Count] = useState(18);
  const [improvedCount, setImprovedCount] = useState(4);

  const handleNext = () => setCurrentSlide((prev) => (prev < totalSlides ? prev + 1 : 1));
  const handlePrev = () => setCurrentSlide((prev) => (prev > 1 ? prev - 1 : totalSlides));

  const handleTriggerDownload = () => {
    if (onDownloadPptx) {
      onDownloadPptx();
    } else {
      downloadManager.startDownload({
        filename: `${propertyName.replace(/[^a-zA-Z0-9]/g, "_")}_Monthly_Visibility_Deck.pptx`,
        format: "pptx",
        countdownSeconds: 3,
        onExecute: async () => {
          await new Promise((r) => setTimeout(r, 600));
        },
      });
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Top Carousel Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-slate-900">
            Slide {currentSlide} of {totalSlides}
          </span>
          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
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
                className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                  currentSlide === s
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <Button variant="ghost" onClick={handlePrev} className="px-2.5 py-1.5 text-xs">
            Previous
          </Button>
          <Button variant="ghost" onClick={handleNext} className="px-2.5 py-1.5 text-xs">
            Next
          </Button>

          <Button variant="primary" onClick={handleTriggerDownload} className="text-xs py-1.5">
            Download .pptx
          </Button>
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
                <span className="font-display text-sm font-extrabold tracking-wider uppercase text-purple-200">
                  COGWHEEL MARKETING
                </span>
              </div>
              <span className="rounded-md bg-purple-900/60 px-3 py-1 font-mono text-xs text-purple-200 border border-purple-700/50">
                {reportMonth}
              </span>
            </div>

            <div className="max-w-2xl py-6">
              <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-bold text-brand-light border border-brand/30">
                Monthly Performance Deliverable
              </span>
              <h1 className="mt-4 font-display text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-white">
                {propertyName}
              </h1>
              <p className="mt-3 text-sm md:text-lg text-purple-200 font-medium">
                Search Engine &amp; AI Visibility Performance Review
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-purple-300 font-mono">
                <span>{propertyCity}, {propertyState}</span>
                <span>•</span>
                <span>Audit Version 3.2</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-purple-800/40 pt-4 text-xs text-purple-300">
              <span>Prepared for General Manager &amp; Ownership</span>
              <span className="text-[11px] text-purple-400">confidential &bull; internal client presentation</span>
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
              <span className="text-xs font-bold text-brand uppercase tracking-wider">
                COGWHEEL MARKETING
              </span>
            </div>

            {/* KPI Badges */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Top 10 Rankings</span>
                <div className="font-display text-2xl font-black text-slate-900">
                  <input
                    type="number"
                    value={top10Count}
                    onChange={(e) => setTop10Count(Number(e.target.value))}
                    className="w-14 text-center bg-transparent border-b border-dashed border-slate-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-700">Rankings Improved</span>
                <div className="font-display text-2xl font-black text-emerald-700">
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
                <span className="text-[10px] font-bold uppercase text-purple-700">Reporting Window</span>
                <div className="font-display text-sm md:text-base font-bold text-purple-900 mt-1">
                  {reportMonth}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#381a5e]/10 text-[#381a5e] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Primary Keyword</th>
                      <th className="p-2 text-center">Rank</th>
                      <th className="p-2 text-right">Search Vol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    <tr>
                      <td className="p-2">hotels in {propertyCity.toLowerCase()} al</td>
                      <td className="p-2 text-center font-bold text-emerald-600">#2 (▲ +1)</td>
                      <td className="p-2 text-right font-mono">1,600</td>
                    </tr>
                    <tr>
                      <td className="p-2">{propertyCity.toLowerCase()} alabama resort</td>
                      <td className="p-2 text-center font-bold text-emerald-600">#1 (▲ +2)</td>
                      <td className="p-2 text-right font-mono">880</td>
                    </tr>
                    <tr>
                      <td className="p-2">florence spa resort packages</td>
                      <td className="p-2 text-center font-bold text-slate-800">#3 (&mdash;)</td>
                      <td className="p-2 text-right font-mono">420</td>
                    </tr>
                    <tr>
                      <td className="p-2">tennessee river hotel view</td>
                      <td className="p-2 text-center font-bold text-emerald-600">#1 (▲ +1)</td>
                      <td className="p-2 text-right font-mono">590</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Editable Executive Insight Box */}
              <div className="flex flex-col justify-between rounded-xl border border-purple-300 bg-purple-50/60 p-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#381a5e]">
                    Executive Insight (Click to edit)
                  </div>
                  <textarea
                    value={executiveNote}
                    onChange={(e) => setExecutiveNote(e.target.value)}
                    rows={4}
                    className="mt-2 w-full resize-none rounded-lg border border-purple-200 bg-white p-2 text-xs text-slate-800 shadow-inner focus:border-brand focus:outline-none"
                  />
                </div>
                <div className="text-[10px] text-purple-700 font-medium">
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
              <span className="text-xs font-bold text-brand uppercase tracking-wider">
                COGWHEEL MARKETING
              </span>
            </div>

            {/* Matched Services Tags */}
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-700">Matched Property Services:</span>
              {matchedServices.map((service, idx) => (
                <span
                  key={idx}
                  className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300"
                >
                  {service}
                </span>
              ))}
            </div>

            {/* Ancillary Table */}
            <div className="mt-4 flex-1 rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#381a5e]/10 text-[#381a5e] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Ancillary Keyword</th>
                    <th className="p-2.5 text-center">Ranking</th>
                    <th className="p-2.5 text-right">Search Volume</th>
                    <th className="p-2.5 text-center">Service Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">florence alabama resort</td>
                    <td className="p-2.5 text-center font-bold text-emerald-600">1</td>
                    <td className="p-2.5 text-right font-mono">70</td>
                    <td className="p-2.5 text-center text-slate-600">Resort &amp; Getaways</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">hotel spa in florence alabama</td>
                    <td className="p-2.5 text-center font-bold text-emerald-600">2</td>
                    <td className="p-2.5 text-right font-mono">140</td>
                    <td className="p-2.5 text-center text-slate-600">Spa &amp; Wellness</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">wedding reception venues florence al</td>
                    <td className="p-2.5 text-center font-bold text-slate-700">4</td>
                    <td className="p-2.5 text-right font-mono">210</td>
                    <td className="p-2.5 text-center text-slate-600">Hotel &amp; Lodging</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">fine dining river view florence</td>
                    <td className="p-2.5 text-center font-bold text-emerald-600">1</td>
                    <td className="p-2.5 text-right font-mono">90</td>
                    <td className="p-2.5 text-center text-slate-600">Dining &amp; Lounges</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-[11px] text-slate-500">
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
              <span className="text-xs font-bold text-brand uppercase tracking-wider">
                COGWHEEL MARKETING
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-5 flex-1">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-sm text-[#381a5e]">The Purpose of Tracking</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  SEO is an ongoing visibility investment. Monitoring keyword positions reveals shift patterns before they impact revenue, allowing immediate optimization against OTA displacement and local comp-set moves.
                </p>
                <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-semibold">
                  Direct bookings generate +18% higher net RevPAR compared to OTA commission channels.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-sm text-[#381a5e]">Workbook Integration</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Every query tracked in this slide deck syncs with your comprehensive Keywords Master Workbook, mapping primary landing pages, seasonal demand trends, and search difficulty scores.
                </p>
                <div className="mt-4 rounded-lg bg-purple-50 border border-purple-200 p-2.5 text-xs text-purple-900 font-mono">
                  Full list: 120+ keywords audited monthly.
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
              <span className="text-xs font-bold text-brand uppercase tracking-wider">
                COGWHEEL MARKETING
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 flex-1">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  HEALTH SCORE: 92/100
                </span>
                <h3 className="mt-2 font-bold text-sm text-slate-900">Core Web Vitals</h3>
                <p className="mt-1 text-xs text-slate-600">
                  LCP 1.8s &bull; CLS 0.02 &bull; Mobile-ready responsive markup verified.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                  ACTION ITEM
                </span>
                <h3 className="mt-2 font-bold text-sm text-slate-900">Spa Schema Addition</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Implement DaySpa schema to capture ChatGPT and Google AI Overview citations.
                </p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800">
                  PRIORITY FOCUS
                </span>
                <h3 className="mt-2 font-bold text-sm text-slate-900">Local Comp-Set Dominance</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Defend #1 position on &ldquo;florence alabama resort&rdquo; and optimize wedding event inquiries.
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
              <span>Prepared by Razib Marketing &bull; Cogwheel SEO</span>
              <span>Next Review: December 2026</span>
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
            className={`group relative flex h-14 w-24 flex-col justify-between overflow-hidden rounded-lg border-2 p-1.5 text-[10px] transition ${
              currentSlide === idx
                ? "border-brand bg-slate-900 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <span className="font-bold">Slide {idx}</span>
            <span className="truncate text-[9px] opacity-75">
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
