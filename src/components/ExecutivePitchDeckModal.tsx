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

/**
 * Two-page executive pitch template.
 *
 * White-label fields are editable; every performance number is a placeholder
 * that must be filled from a measured audit or rank tracker. The template does
 * not invent competitors, rankings, CTR lifts or revenue recovery.
 */
export function ExecutivePitchDeckModal({
  property,
  onClose,
  onOpenEmail,
}: ExecutivePitchDeckProps) {
  const propertyName = property?.name?.trim() || "Property name not set";
  const location = [property?.city, property?.state].filter(Boolean).join(", ");

  // White-label custom agency settings
  const [agencyName, setAgencyName] = useState("Nurunnobe Jisan");
  const [agencyTagline, setAgencyTagline] = useState("Hospitality Organic Growth & GEO Advisory");
  const [leadConsultant, setLeadConsultant] = useState("Senior Search Strategist");
  const [contactEmail, setContactEmail] = useState("");
  const [targetExecutive, setTargetExecutive] = useState("General Manager & Asset Management");
  const [isEditingWhiteLabel, setIsEditingWhiteLabel] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const reportDate = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summary = `EXECUTIVE PITCH DECK TEMPLATE
PREPARED BY: ${agencyName}${agencyTagline ? ` (${agencyTagline})` : ""}
CLIENT: ${propertyName}${location ? ` (${location})` : ""}
TARGET AUDIENCE: ${targetExecutive}
DATE: ${reportDate}

STATUS: NO VERIFIED METRICS HAVE BEEN ADDED

Add measured values from the Full Website Audit or your rank tracker before
sending. This template does not include rankings, share of voice, AI citation
scores or revenue estimates.

CHECKLIST
1. Run the Full Website Audit for the property.
2. Attach the exported report (HTML/PDF/PPTX).
3. Replace every "—" placeholder with a measured value, or remove it.
4. Agree the action owners and next review date with the client.

CONTACT: ${contactEmail || "[add contact email]"}`;

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
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-micro font-bold uppercase tracking-wider text-brand-light dark:bg-brand dark:text-slate-900">
              Agency Suite
            </span>
            <span className="font-display text-body font-bold text-slate-900 dark:text-white">
              Executive 2-Page Pitch Template
            </span>
          </div>
          <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
            White-label layout for GMs, owners and asset managers. Metrics are placeholders until
            you add verified data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsEditingWhiteLabel((prev) => !prev)}
            className="text-caption"
          >
            {isEditingWhiteLabel ? "Done Editing" : "White-Label Settings"}
          </Button>
          <Button variant="secondary" onClick={handleCopySummary} className="text-caption">
            {copiedSummary ? "Copied Summary" : "Copy Summary"}
          </Button>
          <Button variant="primary" onClick={handlePrint} className="text-caption">
            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save to PDF
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="text-caption">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* White-Label Customization Drawer */}
      {isEditingWhiteLabel && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60 print:hidden">
          <h4 className="text-caption font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Agency Customization &amp; White-Labeling
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-tiny font-semibold text-slate-600 dark:text-slate-400">Agency Name</label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-caption text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-tiny font-semibold text-slate-600 dark:text-slate-400">Agency Tagline</label>
              <input
                type="text"
                value={agencyTagline}
                onChange={(e) => setAgencyTagline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-caption text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-tiny font-semibold text-slate-600 dark:text-slate-400">Target Executive</label>
              <input
                type="text"
                value={targetExecutive}
                onChange={(e) => setTargetExecutive(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-caption text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-tiny font-semibold text-slate-600 dark:text-slate-400">Consultant Title</label>
              <input
                type="text"
                value={leadConsultant}
                onChange={(e) => setLeadConsultant(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-caption text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-tiny font-semibold text-slate-600 dark:text-slate-400">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@agency.com"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-caption text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
              <span className="font-mono text-caption font-bold uppercase tracking-wider text-brand-dark dark:text-brand">
                {agencyName}
              </span>
              <div className="text-tiny text-slate-500">{agencyTagline}</div>
              <h1 className="mt-3 font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Direct-Booking Growth &amp; AI Visibility Audit
              </h1>
              <p className="mt-1 text-caption text-slate-600 dark:text-slate-300">
                Prepared for <span className="font-semibold text-slate-900 dark:text-white">{targetExecutive}</span> at{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{propertyName}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-tiny font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {reportDate}
              </span>
              <div className="mt-2 text-micro text-slate-400">Template — add verified metrics</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-caption text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>No performance numbers are included.</strong> Fill each card from the measured
            audit or rank tracker; the template will not estimate them.
          </div>

          {/* 4 Big KPI placeholders */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 print:grid-cols-4">
            {[
              { label: "Direct Booking Index", note: "Add measured index" },
              { label: "Local Comp-Set Win Rate", note: "Add tracker result" },
              { label: "GEO AI Citation Score", note: "Not measured" },
              { label: "Est. Commission Recovery", note: "Add model + method" },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <span className="text-micro font-bold uppercase tracking-wider text-slate-500">
                  {kpi.label}
                </span>
                <div className="mt-1 font-display text-2xl font-extrabold text-slate-400 dark:text-slate-500">
                  —
                </div>
                <p className="mt-0.5 text-micro text-slate-500">{kpi.note}</p>
              </div>
            ))}
          </div>

          {/* Market Position & Comp-Set Benchmark */}
          <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-display text-caption font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Competitive Battlefield {location ? `(${location})` : ""}
            </h3>
            <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-5 text-center text-caption text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No competitor data loaded. Add the comp-set and measured positions from your rank
              tracker; no competitor names or shares are assumed.
            </div>
          </div>

          {/* Page 1 Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-micro text-slate-400 dark:border-slate-800">
            <span>Powered by {agencyName} • SEO Studio Direct-Booking Engine</span>
            <span>Page 1 of 2</span>
          </div>
        </div>

        {/* ================= PAGE 2 ================= */}
        <div className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-6 print:shadow-none">
          {/* Header Page 2 */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <span className="font-mono text-caption font-bold uppercase tracking-wider text-brand-dark dark:text-brand">
                {agencyName} Strategy
              </span>
              <h2 className="mt-1 font-display text-xl font-extrabold text-slate-900 dark:text-white">
                How to Build the Roadmap
              </h2>
            </div>
            <div className="text-right text-tiny text-slate-500">
              Add owners and review dates
            </div>
          </div>

          {/* 3 Action Cards */}
          <div className="mt-5 space-y-4">
            {[
              {
                color: "bg-emerald-600",
                title: "Attach the measured audit",
                body: "Run the Full Website Audit, export HTML/PDF/PPTX, and attach it. The deck should reference measured findings, not template claims.",
                outcome: "Evidence: exported audit report ID and date.",
              },
              {
                color: "bg-sky-600",
                title: "Select the P0/P1 actions",
                body: "Copy the highest-priority items from the audit action plan, with the affected URLs and remediation guidance. Remove items the client has not approved.",
                outcome: "Evidence: action IDs, owners and due dates.",
              },
              {
                color: "bg-purple-600",
                title: "Agree measurement and review date",
                body: "Define which metrics will be checked next cycle (rank tracker, Search Console, or crawl findings) and when the next review happens.",
                outcome: "Evidence: metric owners, data sources and next review date.",
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${step.color} font-mono text-caption font-bold text-white`}>
                      {index + 1}
                    </span>
                    <h4 className="font-display text-body font-bold text-slate-900 dark:text-white">
                      {step.title}
                    </h4>
                  </div>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-micro font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Checklist
                  </span>
                </div>
                <p className="mt-1.5 text-caption text-slate-600 dark:text-slate-300">{step.body}</p>
                <div className="mt-2 text-tiny text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Required:</span>{" "}
                  {step.outcome}
                </div>
              </div>
            ))}
          </div>

          {/* Sign-off & Implementation Approval Box */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-6 text-caption">
              <div>
                <span className="text-micro font-bold uppercase tracking-wider text-slate-400">
                  Strategy Prepared By Agency:
                </span>
                <div className="mt-2 font-display text-body font-bold text-slate-900 dark:text-white">
                  {agencyName}
                </div>
                <div className="text-tiny text-slate-500">{leadConsultant}</div>
                <div className="font-mono text-micro text-slate-400">
                  {contactEmail || "[add contact email]"}
                </div>
              </div>
              <div className="border-l border-slate-100 pl-6 dark:border-slate-800">
                <span className="text-micro font-bold uppercase tracking-wider text-slate-400">
                  Authorized for Hotel Execution:
                </span>
                <div className="mt-2 border-b border-dashed border-slate-300 pt-4 dark:border-slate-700"></div>
                <div className="mt-1 flex justify-between text-micro text-slate-400">
                  <span>General Manager Signature</span>
                  <span>Date</span>
                </div>
              </div>
            </div>
          </div>

          {/* Page 2 Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-micro text-slate-400 dark:border-slate-800">
            <span>{agencyName} Hospitality Growth &bull; Client Delivery Template</span>
            <span>Page 2 of 2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
