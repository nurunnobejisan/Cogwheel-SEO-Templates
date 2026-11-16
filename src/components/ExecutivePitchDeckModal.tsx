"use client";

import { useState } from "react";
import { Button } from "./ui";

interface ExecutivePitchDeckProps {
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

export function ExecutivePitchDeckModal({
  property,
  onClose,
  onOpenEmail,
}: ExecutivePitchDeckProps) {
  const defaultPropertyName = property?.name || "Renaissance Shoals Resort & Spa";
  const defaultCity = property?.city || "Florence";
  const defaultState = property?.state || "AL";
  const defaultUrl = property?.url || "https://www.marriott.com/en-us/hotels/mslbr-renaissance-shoals-resort-and-spa/overview/";

  // White-label custom agency settings
  const [agencyName, setAgencyName] = useState("Razib Marketing");
  const [agencyTagline, setAgencyTagline] = useState("Hospitality Organic Growth & GEO Advisory");
  const [leadConsultant, setLeadConsultant] = useState("Senior Search Strategist");
  const [contactEmail, setContactEmail] = useState("growth@razibmarketing.com");
  const [targetExecutive, setTargetExecutive] = useState("General Manager & Asset Management");
  const [isEditingWhiteLabel, setIsEditingWhiteLabel] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const reportDate = "November 2026";

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summary = `EXECUTIVE PITCH DECK & DIRECT-BOOKING AUDIT
PREPARED BY: ${agencyName} (${agencyTagline})
CLIENT: ${defaultPropertyName} (${defaultCity}, ${defaultState})
TARGET AUDIENCE: ${targetExecutive}
DATE: ${reportDate}

EXECUTIVE METRICS:
- Direct Booking Health Index: 92/100
- Local Comp-Set Win Rate: 84%
- Generative AI (GEO) Readiness: 78%
- Est. Annual OTA Commission Recovery: $42,000 - $58,000/year

STRATEGIC ROADMAP:
1. DaySpa & Hotel Schema Graph Deployment (+16% organic CTR)
2. Room Type & Suite Content Differentiation (Bypass OTA rate parity filters)
3. Generative Engine Optimization for ChatGPT Search & Google AI Overviews

CONTACT: ${contactEmail}`;

    navigator.clipboard?.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {/* Control Header & White-Label Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light dark:bg-brand dark:text-slate-900">
              Agency Suite
            </span>
            <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Executive 2-Page Direct-Booking Pitch Deck
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Formatted for General Managers, owners, and asset managers with white-label branding and 2-page print export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsEditingWhiteLabel((prev) => !prev)}
            className="text-xs"
          >
            {isEditingWhiteLabel ? "Done Editing" : "White-Label Settings"}
          </Button>
          <Button variant="secondary" onClick={handleCopySummary} className="text-xs">
            {copiedSummary ? "Copied Summary!" : "Copy Summary"}
          </Button>
          <Button variant="primary" onClick={handlePrint} className="text-xs">
            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save to PDF
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="text-xs">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* White-Label Customization Drawer */}
      {isEditingWhiteLabel && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60 print:hidden">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Agency Customization &amp; White-Labeling
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Agency Name</label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Agency Tagline</label>
              <input
                type="text"
                value={agencyTagline}
                onChange={(e) => setAgencyTagline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Target Executive</label>
              <input
                type="text"
                value={targetExecutive}
                onChange={(e) => setTargetExecutive(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Consultant Title</label>
              <input
                type="text"
                value={leadConsultant}
                onChange={(e) => setLeadConsultant(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Contact Email</label>
              <input
                type="text"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* PRINT CONTAINER — EXACT 2 PAGES */}
      <div className="space-y-8 bg-slate-50/50 p-4 dark:bg-slate-950/30 print:bg-white print:p-0">
        {/* ================= PAGE 1 ================= */}
        <div className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-6 print:shadow-none print:break-after-page">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-brand">
                {agencyName}
              </span>
              <div className="text-[11px] text-slate-500">{agencyTagline}</div>
              <h1 className="mt-3 font-display text-2xl font-black text-slate-900 dark:text-white">
                Direct-Booking Growth &amp; AI Visibility Audit
              </h1>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Prepared for <span className="font-semibold text-slate-900 dark:text-white">{targetExecutive}</span> at{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{defaultPropertyName}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {reportDate}
              </span>
              <div className="mt-2 text-[10px] text-slate-400">Confidential Executive Memo</div>
            </div>
          </div>

          {/* 4 Big KPI Cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 print:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Direct Booking Index
              </span>
              <div className="mt-1 font-display text-2xl font-black text-emerald-600 dark:text-emerald-400">
                92 / 100
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">Top 5% in regional hospitality</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Local Comp-Set Win Rate
              </span>
              <div className="mt-1 font-display text-2xl font-black text-sky-600 dark:text-sky-400">
                84%
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">Leading 3 of 4 battlegrounds</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                GEO AI Citation Score
              </span>
              <div className="mt-1 font-display text-2xl font-black text-purple-600 dark:text-purple-400">
                78%
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">Perplexity &amp; ChatGPT cited</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Est. Commission Recovery
              </span>
              <div className="mt-1 font-display text-2xl font-black text-amber-600 dark:text-amber-400">
                $48,600 / yr
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">Recaptured from OTAs</p>
            </div>
          </div>

          {/* Market Position & Comp-Set Benchmark */}
          <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Competitive Battlefield ({defaultCity}, {defaultState})
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 dark:border-slate-800">
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Est. Organic Share</th>
                    <th className="pb-2">Primary Keyword Rank</th>
                    <th className="pb-2">AI Search Readiness</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr className="font-semibold text-slate-900 dark:text-white">
                    <td className="py-2">{defaultPropertyName} (Target)</td>
                    <td className="py-2 text-emerald-600">38.4%</td>
                    <td className="py-2">#1 (&ldquo;florence al resort&rdquo;)</td>
                    <td className="py-2">78% Verified</td>
                    <td className="py-2">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Market Leader
                      </span>
                    </td>
                  </tr>
                  <tr className="text-slate-600 dark:text-slate-400">
                    <td className="py-2">GunRunner Boutique Hotel</td>
                    <td className="py-2">26.1%</td>
                    <td className="py-2">#3 (&ldquo;boutique hotel florence&rdquo;)</td>
                    <td className="py-2">54% Partial</td>
                    <td className="py-2">Challenger</td>
                  </tr>
                  <tr className="text-slate-600 dark:text-slate-400">
                    <td className="py-2">Courtyard Florence</td>
                    <td className="py-2">18.5%</td>
                    <td className="py-2">#4 (&ldquo;florence al hotels&rdquo;)</td>
                    <td className="py-2">42% Brand Only</td>
                    <td className="py-2">Defending</td>
                  </tr>
                  <tr className="text-slate-600 dark:text-slate-400">
                    <td className="py-2">Hampton Inn Downtown</td>
                    <td className="py-2">12.8%</td>
                    <td className="py-2">#6 (&ldquo;downtown florence hotel&rdquo;)</td>
                    <td className="py-2">35% Unclaimed</td>
                    <td className="py-2">Vulnerable</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Page 1 Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-[10px] text-slate-400 dark:border-slate-800">
            <span>Powered by {agencyName} • Cogwheel Direct-Booking Engine</span>
            <span>Page 1 of 2</span>
          </div>
        </div>

        {/* ================= PAGE 2 ================= */}
        <div className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-6 print:shadow-none">
          {/* Header Page 2 */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-brand">
                {agencyName} Strategy
              </span>
              <h2 className="mt-1 font-display text-xl font-black text-slate-900 dark:text-white">
                Revenue Recovery Roadmap: 3 High-Impact Action Items
              </h2>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              Implementation Window: Next 14-30 Days
            </div>
          </div>

          {/* 3 Strategic Action Cards */}
          <div className="mt-5 space-y-4">
            {/* Action 1 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 font-mono text-xs font-bold text-white">
                    1
                  </span>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Deploy Hotel, DaySpa &amp; FAQ Schema Graph
                  </h4>
                </div>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  +16% Organic CTR
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                Implement structured JSON-LD `@graph` data covering rooms, spa packages, and official pet policies. Unlocks Google Rich Snippets (star ratings, room price ranges, FAQ accordions) and prevents zero-click searches.
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Target Outcome:</span> 240+ additional monthly direct clicks previously lost to Expedia/Booking.com SERP ads.
              </div>
            </div>

            {/* Action 2 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-600 font-mono text-xs font-bold text-white">
                    2
                  </span>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Room Type &amp; Suite Content Differentiation
                  </h4>
                </div>
                <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  OTA Defense
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                Rewrite room and suite copy to exceed the 500-word depth threshold with unique view descriptions, bed configuration details, and direct-booking perks. Defeats canonical duplication penalties and prevents OTAs from outranking individual room pages.
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Target Outcome:</span> Direct room page bookings increase by 18-25% without discounting rack rates.
              </div>
            </div>

            {/* Action 3 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-600 font-mono text-xs font-bold text-white">
                    3
                  </span>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Generative Engine Optimization (GEO) Calibration
                  </h4>
                </div>
                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Future-Proof AI Search
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                Calibrate entity consistency across ChatGPT Search, Google AI Overviews, and Perplexity. Fixes the unverified pet-fee alert and ensures {defaultPropertyName} is the #1 recommended boutique resort in local AI queries.
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Target Outcome:</span> Retain #1 citation spot for high-intent AI queries across Alabama and Tennessee Valley travellers.
              </div>
            </div>
          </div>

          {/* Sign-off & Implementation Approval Box */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Strategy Approved By Agency:
                </span>
                <div className="mt-2 font-display text-sm font-bold text-slate-900 dark:text-white">
                  {agencyName}
                </div>
                <div className="text-[11px] text-slate-500">{leadConsultant}</div>
                <div className="font-mono text-[10px] text-slate-400">{contactEmail}</div>
              </div>
              <div className="border-l border-slate-100 pl-6 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Authorized for Hotel Execution:
                </span>
                <div className="mt-2 border-b border-dashed border-slate-300 pt-4 dark:border-slate-700"></div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>General Manager Signature</span>
                  <span>Date</span>
                </div>
              </div>
            </div>
          </div>

          {/* Page 2 Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-[10px] text-slate-400 dark:border-slate-800">
            <span>{agencyName} Hospitality Growth &bull; Client Delivery Master</span>
            <span>Page 2 of 2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
