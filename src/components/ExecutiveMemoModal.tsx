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

export function ExecutiveMemoModal({
  property,
  onClose,
  onOpenEmail,
}: ExecutiveMemoProps) {
  const propertyName = property?.name || "Renaissance Shoals Resort & Spa";
  const propertyCity = property?.city || "Florence";
  const propertyState = property?.state || "AL";
  const reportDate = "November 2026";

  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = `EXECUTIVE MEMORANDUM
TO: General Manager & Asset Management, ${propertyName}
FROM: Razib Marketing / Cogwheel SEO
DATE: ${reportDate}
SUBJECT: Monthly Organic Search & Generative Engine Visibility Briefing

KEY PERFORMANCE INDICATORS:
- Total Top 10 Search Positions: 18 (+4 this month)
- Local Search Share of Voice: 84%
- Est. Direct Booking Revenue Influence: $14,200/mo
- Generative AI Citation Score: 78% (ChatGPT Search & Google AI Overviews)

TOP 5 ORGANIC SEARCH WINS:
1. "florence alabama resort" — Rank #1 (▲ +2) | SV: 880
2. "hotels in florence al" — Rank #2 (▲ +1) | SV: 1,600
3. "tennessee river luxury resort" — Rank #1 (▲ +1) | SV: 590
4. "florence spa resort packages" — Rank #3 (= Tied) | SV: 420
5. "florence al wedding venue hotel" — Rank #2 (▲ +2) | SV: 320

LOCAL COMP-SET BENCHMARK:
- Ahead of GunRunner Boutique Hotel by +2 avg rank on primary discovery keywords.
- Dominating regional resort and riverfront luxury intent against Courtyard Florence.

HIGH-PRIORITY ACTION ITEMS:
1. Deploy DaySpa schema markup on spa landing page to capture Perplexity & ChatGPT voice bookings.
2. Publish explicit Pet Policy FAQ to overcome Google AI Overview unverified fee warnings.
3. Optimize seasonal wedding and corporate group event landing pages ahead of Q1 bookings.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Controls (hidden on print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light">
            1-Page Briefing
          </span>
          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Executive Owner &amp; GM Memo
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleCopy} className="text-xs">
            {copied ? "✓ Copied" : "📋 Copy Text"}
          </Button>

          {onOpenEmail && (
            <Button variant="secondary" onClick={onOpenEmail} className="text-xs">
              ✉️ Email Deliverable
            </Button>
          )}

          <Button variant="primary" onClick={handlePrint} className="text-xs">
            🖨️ Print / Save as PDF
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
              {propertyCity}, {propertyState} &bull; Monthly Search &amp; GEO Visibility Memorandum
            </p>
          </div>
          <div className="text-right">
            <div className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {reportDate}
            </div>
            <span className="mt-1 block text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Confidential
            </span>
          </div>
        </div>

        {/* 4 KPI Badges */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Top 10 Rankings
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-black text-slate-900 dark:text-white">
                18
              </span>
              <span className="text-xs font-bold text-emerald-600">▲ +4</span>
            </div>
            <div className="text-[10px] text-slate-500">Core keyword portfolio</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Share of Voice
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-black text-slate-900 dark:text-white">
                84%
              </span>
              <span className="text-xs font-bold text-emerald-600">Leader</span>
            </div>
            <div className="text-[10px] text-slate-500">Top 3 local market share</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Direct Booking Lift
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-black text-slate-900 dark:text-white">
                +$14.2k
              </span>
              <span className="text-xs font-bold text-emerald-600">/mo</span>
            </div>
            <div className="text-[10px] text-slate-500">OTA commission savings</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              AI &amp; GEO Readiness
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-black text-slate-900 dark:text-white">
                78%
              </span>
              <span className="text-xs font-bold text-purple-600">Grade B+</span>
            </div>
            <div className="text-[10px] text-slate-500">ChatGPT &amp; Perplexity</div>
          </div>
        </div>

        {/* Section 1: Top 5 Search Wins */}
        <div className="mt-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-800">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              1. Top Organic Search Wins (Current Cycle)
            </h2>
            <span className="text-[10px] text-slate-500">Google SERP Desktop &amp; Mobile</span>
          </div>

          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3">Keyword Query</th>
                  <th className="py-2 px-3 text-center">Current Position</th>
                  <th className="py-2 px-3 text-center">Gain</th>
                  <th className="py-2 px-3 text-right">Search Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                <tr>
                  <td className="py-2 px-3 font-semibold">florence alabama resort</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">#1</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">▲ +2</td>
                  <td className="py-2 px-3 text-right font-mono">880</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">hotels in florence al</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">#2</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">▲ +1</td>
                  <td className="py-2 px-3 text-right font-mono">1,600</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">tennessee river luxury resort</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">#1</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">▲ +1</td>
                  <td className="py-2 px-3 text-right font-mono">590</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">florence spa resort packages</td>
                  <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">#3</td>
                  <td className="py-2 px-3 text-center font-bold text-slate-500">= Tied</td>
                  <td className="py-2 px-3 text-right font-mono">420</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">wedding reception venues florence al</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">#2</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-600">▲ +2</td>
                  <td className="py-2 px-3 text-right font-mono">320</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Local Comp-Set Summary */}
        <div className="mt-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-800">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              2. Local Comp-Set Positioning
            </h2>
            <span className="text-[10px] text-slate-500">Benchmark vs Top 3 Properties</span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {propertyName} maintains an average +2.4 rank advantage against <span className="font-semibold text-slate-900 dark:text-white">GunRunner Boutique Hotel</span> and <span className="font-semibold text-slate-900 dark:text-white">Courtyard Florence</span> across all high-intent stay terms. Resort amenities, waterfront imagery, and verified reviews continue to insulate the property from local OTA displacement.
          </p>
        </div>

        {/* Section 3: Priority Action Items */}
        <div className="mt-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-800">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              3. High-Priority Technical &amp; Revenue Action Items
            </h2>
            <span className="text-[10px] text-slate-500">Next 30 Days</span>
          </div>

          <div className="mt-2 space-y-2 text-xs">
            <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900">
              <span className="font-bold text-[#381a5e] dark:text-brand-light">01</span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Deploy DaySpa Schema Markup: </span>
                <span className="text-slate-600 dark:text-slate-300">
                  Implement structured data for treatment menus and operating hours to secure direct citations in ChatGPT Search and Perplexity.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900">
              <span className="font-bold text-[#381a5e] dark:text-brand-light">02</span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Publish Pet Policy FAQ Block: </span>
                <span className="text-slate-600 dark:text-slate-300">
                  Clarify pet fees directly on the official overview page to eliminate inaccurate third-party OTA estimations in Google AI Overviews.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900">
              <span className="font-bold text-[#381a5e] dark:text-brand-light">03</span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Target Seasonal Group &amp; Wedding Queries: </span>
                <span className="text-slate-600 dark:text-slate-300">
                  Update conference floorplans and event gallery meta descriptions ahead of Q1 wedding and corporate retreat booking spikes.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Memo Footer */}
        <div className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400 dark:border-slate-800">
          Generated automatically by Razib Marketing &bull; Cogwheel SEO Intelligence Suite &bull; Confidential &bull; Single-Page Format
        </div>
      </div>
    </div>
  );
}
