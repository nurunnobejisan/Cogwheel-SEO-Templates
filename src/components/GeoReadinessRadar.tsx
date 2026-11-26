"use client";

import { useState } from "react";
import { Button } from "./ui";
import { VisibilitySuiteModal } from "./VisibilitySuiteModal";
import type { FullWebsiteAuditReport } from "@/core/full-audit/types";

interface GeoProps {
  property?: {
    name?: string;
    brand?: string;
    city?: string;
    state?: string;
    url?: string;
  };
  onRunDeckGeneration?: () => void;
}

interface ImportedCitationScore {
  score: number;
  source: string;
  importedAt: string;
}

/**
 * On-page GEO readiness.
 *
 * Everything shown here is either measured by `/api/full-audit` (JSON-LD types,
 * canonical, headings, word count) or imported from a visibility provider the
 * operator connects. The component does not simulate AI answers, engine
 * percentages, search volumes or citation confidence: those require querying
 * ChatGPT, Perplexity, Gemini or Google AI Overviews, which this app cannot do
 * on its own.
 */
const SCHEMA_FAMILIES: Array<{
  label: string;
  types: string[];
  recommendation: string;
}> = [
  {
    label: "Hotel / LodgingBusiness",
    types: ["Hotel", "LodgingBusiness", "Resort", "Motel", "BedAndBreakfast"],
    recommendation:
      "Declare Hotel or LodgingBusiness JSON-LD with name, address, geo coordinates, check-in/out times and amenityFeature entries.",
  },
  {
    label: "Restaurant / Dining",
    types: ["Restaurant", "FoodEstablishment", "BarOrPub", "CafeOrCoffeeShop"],
    recommendation:
      "Add Restaurant schema with menu URL, openingHoursSpecification, servesCuisine and priceRange for each dining outlet.",
  },
  {
    label: "Spa / Wellness",
    types: ["DaySpa", "HealthAndBeautyBusiness", "BeautySalon", "Spa"],
    recommendation:
      "Add DaySpa or HealthAndBeautyBusiness schema listing treatments, durations and a bookable service URL.",
  },
  {
    label: "FAQ / Direct answers",
    types: ["FAQPage", "Question", "Answer"],
    recommendation:
      "Publish FAQPage JSON-LD for policy questions (pets, parking, resort fees) with concise 40–60 word answers.",
  },
  {
    label: "Organization / Website",
    types: ["Organization", "WebSite", "BreadcrumbList"],
    recommendation:
      "Emit Organization + WebSite + BreadcrumbList so engines can resolve the brand entity and site structure.",
  },
];

const PROMPT_TEMPLATES = [
  {
    category: "Local discovery",
    prompt: (name: string, city: string, state: string) =>
      `Best hotel with spa and river view in ${city || "[city]"} ${state || "[state]"}`,
  },
  {
    category: "Amenity validation",
    prompt: (name: string) => `Does ${name || "[property]"} allow pets and what are the fees?`,
  },
  {
    category: "Booking intent",
    prompt: (name: string) => `Spa packages and treatment pricing at ${name || "[property]"}`,
  },
  {
    category: "Groups & events",
    prompt: (name: string) => `Corporate retreat and wedding venues at ${name || "[property]"}`,
  },
];

function scoreLabel(score: number): string {
  if (score >= 85) return "Strong on-page readiness";
  if (score >= 70) return "Moderate on-page readiness";
  if (score >= 50) return "Needs work";
  return "Low on-page readiness";
}

export function GeoReadinessRadar({ property, onRunDeckGeneration }: GeoProps) {
  const propertyName = property?.name?.trim() || "";
  const propertyCity = property?.city?.trim() || "";
  const propertyState = property?.state?.trim() || "";
  const propertyUrl = property?.url?.trim() || "";
  const displayName = propertyName || "Property name not set";
  const locationLabel = [propertyCity, propertyState].filter(Boolean).join(", ") || "Location not set";

  const [activeTab, setActiveTab] = useState<"overview" | "schema" | "queries" | "engines">("overview");
  const [report, setReport] = useState<FullWebsiteAuditReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [importedScore, setImportedScore] = useState<ImportedCitationScore | null>(null);
  const [showVisibilitySuite, setShowVisibilitySuite] = useState(false);

  const schemasDetected = report?.schemaValidation.schemasDetected ?? [];
  const readinessScore = report?.aiGeoVisibility.visibilityScore ?? null;
  const headlineScore = importedScore?.score ?? readinessScore;
  const headlineSource = importedScore
    ? "VisibilitySuite citation score"
    : readinessScore !== null
    ? "On-page GEO readiness"
    : "No measurement yet";

  const handleRescan = async () => {
    if (!propertyUrl) {
      setScanError("Add a property URL before running the audit.");
      return;
    }
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/full-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: propertyUrl, maxPages: 10 }),
      });
      const data = await res.json();
      if (!res.ok || !data?.report) {
        throw new Error(data?.details || data?.error || "The audit did not return a report.");
      }
      setReport(data.report as FullWebsiteAuditReport);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : "Could not run the audit.");
    } finally {
      setIsScanning(false);
    }
  };

  const schemaState = (familyTypes: string[]) => {
    if (!report) return "unknown" as const;
    return familyTypes.some((type) => schemasDetected.includes(type))
      ? ("detected" as const)
      : ("missing" as const);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card transition-all dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-caption font-semibold text-purple-700 dark:border-purple-800/40 dark:bg-purple-950/40 dark:text-purple-300">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400" />
              </span>
              AI &amp; GEO Readiness
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Generative Engine Optimization (GEO) Radar
            </h2>
            <p className="mt-1.5 max-w-xl text-caption text-slate-500 dark:text-slate-400 sm:text-body">
              Shows which on-page signals generative engines need to extract and quote{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{displayName}</span>.
              AI citation percentages appear only after a visibility provider is connected — this
              radar never invents them.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-tiny text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {locationLabel}
              </span>
              <span className="max-w-xs truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-tiny text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {propertyUrl || "Property URL not set"}
              </span>
            </div>
          </div>

          {/* Circular Score Gauge */}
          <div className="flex shrink-0 items-center gap-5 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-200 dark:text-slate-700"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-purple-600 transition-all duration-1000 dark:text-brand"
                  strokeDasharray={`${headlineScore ?? 0}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
                  {headlineScore !== null ? `${headlineScore}%` : "—"}
                </span>
                <span className="text-micro uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Score
                </span>
              </div>
            </div>
            <div>
              <div className="inline-block rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-tiny font-bold text-purple-700 dark:border-purple-800/50 dark:bg-purple-950/60 dark:text-purple-300">
                {headlineSource}
              </div>
              <p className="mt-1 max-w-[15rem] text-caption text-slate-500 dark:text-slate-400">
                {importedScore
                  ? `Imported ${new Date(importedScore.importedAt).toLocaleDateString()} from ${importedScore.source}.`
                  : report
                  ? scoreLabel(report.aiGeoVisibility.visibilityScore)
                  : "Run the audit to measure JSON-LD, headings and answer coverage."}
              </p>
              <button
                type="button"
                onClick={handleRescan}
                disabled={isScanning || !propertyUrl}
                className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-purple-700 hover:text-purple-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-light dark:hover:underline"
              >
                <svg className={`h-3 w-3 ${isScanning ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isScanning ? "Auditing pages…" : "Run GEO Audit"}
              </button>
              {scanError && (
                <p className="mt-1 max-w-[16rem] text-tiny text-rose-600 dark:text-rose-400">{scanError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`rounded-xl px-3.5 py-1.5 text-caption font-semibold transition ${
                activeTab === "overview"
                  ? "bg-slate-900 text-white shadow-sm dark:bg-brand dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              Radar Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("schema")}
              className={`rounded-xl px-3.5 py-1.5 text-caption font-semibold transition ${
                activeTab === "schema"
                  ? "bg-slate-900 text-white shadow-sm dark:bg-brand dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              Schema &amp; Entities Audit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("queries")}
              className={`rounded-xl px-3.5 py-1.5 text-caption font-semibold transition ${
                activeTab === "queries"
                  ? "bg-slate-900 text-white shadow-sm dark:bg-brand dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              Prompt Set
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("engines")}
              className={`rounded-xl px-3.5 py-1.5 text-caption font-semibold transition ${
                activeTab === "engines"
                  ? "bg-slate-900 text-white shadow-sm dark:bg-brand dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              AI Engine Presence
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowVisibilitySuite(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-caption font-semibold text-purple-700 transition hover:bg-purple-100 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/40"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-600 dark:bg-purple-400" />
            Connect VisibilitySuite Data
          </button>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {!report ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="font-display text-body font-bold text-slate-900 dark:text-white">
                No audit results loaded
              </p>
              <p className="mx-auto mt-1 max-w-lg text-caption leading-relaxed text-slate-500 dark:text-slate-400">
                Run the GEO audit to parse this property&apos;s JSON-LD, headings, canonical and
                answer coverage. The radar shows measured findings only — there is no sample site
                score.
              </p>
              <Button variant="primary" onClick={handleRescan} disabled={isScanning || !propertyUrl} className="mt-4 text-caption">
                {isScanning ? "Auditing pages…" : "Run GEO Audit"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Pillar 1 */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 border-t-2 border-t-emerald-500 bg-white p-5 shadow-card dark:border-slate-800 dark:border-t-emerald-500 dark:bg-slate-900">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Pillar 01
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-tiny font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {schemasDetected.length} types detected
                    </span>
                  </div>
                  <h3 className="mt-2.5 font-display text-base font-bold text-slate-900 dark:text-white">
                    Structured Schema Architecture
                  </h3>
                  <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
                    JSON-LD types parsed from the audited pages.
                  </p>
                </div>
                <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {schemasDetected.length === 0 ? (
                    <p className="text-caption text-slate-500 dark:text-slate-400">No JSON-LD detected.</p>
                  ) : (
                    schemasDetected.slice(0, 4).map((schema) => (
                      <div key={schema} className="flex items-center justify-between text-caption">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{schema}</span>
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-micro font-bold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Detected
                        </span>
                      </div>
                    ))
                  )}
                  {report.schemaValidation.missingRecommendedSchemas.length > 0 && (
                    <p className="pt-1 text-tiny text-amber-700 dark:text-amber-400">
                      Missing recommended: {report.schemaValidation.missingRecommendedSchemas.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 border-t-2 border-t-sky-500 bg-white p-5 shadow-card dark:border-slate-800 dark:border-t-sky-500 dark:bg-slate-900">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Pillar 02
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-tiny font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {report.onPage.wordCount.toLocaleString()} words
                    </span>
                  </div>
                  <h3 className="mt-2.5 font-display text-base font-bold text-slate-900 dark:text-white">
                    Question &amp; Answer Coverage
                  </h3>
                  <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
                    Whether the page can answer policy and amenity questions directly.
                  </p>
                </div>
                <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-slate-600 dark:text-slate-300">FAQPage schema</span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-micro font-bold ${
                        schemasDetected.includes("FAQPage")
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {schemasDetected.includes("FAQPage") ? "Detected" : "Not found"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Heading hierarchy</span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-micro font-bold ${
                        report.headings.hierarchyValid
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {report.headings.hierarchyValid ? "Valid" : "Has issues"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Body copy ≥ 300 words</span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-micro font-bold ${
                        report.onPage.wordCount >= 300
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {report.onPage.wordCount >= 300 ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 border-t-2 border-t-purple-500 bg-white p-5 shadow-card dark:border-slate-800 dark:border-t-purple-500 dark:bg-slate-900">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Pillar 03
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-tiny font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {report.crawlability.isCanonicalSelfReferencing ? "Canonical OK" : "Check canonical"}
                    </span>
                  </div>
                  <h3 className="mt-2.5 font-display text-base font-bold text-slate-900 dark:text-white">
                    Brand Entity Signals
                  </h3>
                  <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
                    Machine-readable entity and site structure signals found on the page.
                  </p>
                </div>
                <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Organization / WebSite</span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-micro font-bold ${
                        ["Organization", "WebSite", "LocalBusiness"].some((t) => schemasDetected.includes(t))
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {["Organization", "WebSite", "LocalBusiness"].some((t) => schemasDetected.includes(t))
                        ? "Detected"
                        : "Not found"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Self-referencing canonical</span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-micro font-bold ${
                        report.crawlability.isCanonicalSelfReferencing
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {report.crawlability.isCanonicalSelfReferencing ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Indexable</span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-micro font-bold ${
                        report.crawlability.isIndexable
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {report.crawlability.isIndexable ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {report && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-tiny leading-relaxed text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <strong className="text-slate-700 dark:text-slate-200">Method:</strong>{" "}
              {report.aiGeoVisibility.methodology} AI engines were not queried by this scan.
              {report.dataProvenance.unavailable.length > 0 && (
                <> Unavailable: {report.dataProvenance.unavailable.join("; ")}.</>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Schema Audit */}
      {activeTab === "schema" && (
        <div className="space-y-4">
          {!report ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="font-display text-body font-bold text-slate-900 dark:text-white">
                No schema audit yet
              </p>
              <p className="mx-auto mt-1 max-w-lg text-caption leading-relaxed text-slate-500 dark:text-slate-400">
                Run the GEO audit to parse JSON-LD from this property. Nothing is assumed about which
                schema types exist.
              </p>
              <Button variant="primary" onClick={handleRescan} disabled={isScanning || !propertyUrl} className="mt-4 text-caption">
                {isScanning ? "Auditing pages…" : "Run GEO Audit"}
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Hospitality Schema Markup Audit
                  </h3>
                  <p className="text-caption text-slate-500 dark:text-slate-400">
                    Parsed from {report.targetUrl}. JSON-LD validity:{" "}
                    {report.schemaValidation.isValidJsonLd ? "valid" : "issues found"}.
                  </p>
                </div>
                <span className="rounded-full border border-brand/30 bg-brand-50 px-3 py-1 text-caption font-bold text-slate-900">
                  {schemasDetected.length} types detected
                </span>
              </div>

              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {SCHEMA_FAMILIES.map((family) => {
                  const state = schemaState(family.types);
                  const detected = family.types.filter((type) => schemasDetected.includes(type));
                  return (
                    <div key={family.label} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-caption font-bold ${
                              state === "detected"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
                            }`}
                          >
                            {state === "detected" ? "✓" : "×"}
                          </span>
                          <span className="font-semibold text-body text-slate-900 dark:text-white">
                            {family.label}
                          </span>
                        </div>
                        <span
                          className={`text-caption font-bold uppercase tracking-wider ${
                            state === "detected" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {state === "detected" ? "Detected" : "Not found"}
                        </span>
                      </div>
                      <p className="mt-1 pl-8.5 text-caption text-slate-600 dark:text-slate-300">
                        {detected.length > 0
                          ? `Detected types: ${detected.join(", ")}.`
                          : "No matching type in the JSON-LD parsed from the audited pages."}
                      </p>
                      {state === "missing" && (
                        <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-caption text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                          <span className="font-bold text-slate-900 dark:text-white">Fix: </span>
                          {family.recommendation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {report.schemaValidation.validationErrorsCount > 0 && (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-caption text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {report.schemaValidation.validationErrorsCount} malformed JSON-LD block(s) were
                  skipped. Fix parse errors before adding new schema types.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Prompt Set */}
      {activeTab === "queries" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Prompt Set for External Measurement
            </h3>
            <p className="text-caption text-slate-500 dark:text-slate-400">
              These are prompts to send to a visibility provider. No AI engine was queried here, so
              there are no simulated answers, search volumes or citation-confidence labels.
            </p>

            {importedScore && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-caption text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Imported {importedScore.source} score: <strong>{importedScore.score}%</strong>. Imported{" "}
                {new Date(importedScore.importedAt).toLocaleString()}. Per-engine and per-prompt
                detail is only shown when the provider export includes it.
              </div>
            )}

            <div className="mt-4 space-y-3">
              {PROMPT_TEMPLATES.map((item) => (
                <div
                  key={item.category}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 text-micro font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {item.category}
                  </span>
                  <p className="mt-2 text-body font-semibold text-slate-900 dark:text-white">
                    &ldquo;{item.prompt(propertyName, propertyCity, propertyState)}&rdquo;
                  </p>
                  <p className="mt-1 text-tiny text-slate-500 dark:text-slate-400">
                    Not yet measured. Export the prompt set below and import the provider&apos;s score.
                  </p>
                </div>
              ))}
            </div>

            <Button
              variant="secondary"
              onClick={() => setShowVisibilitySuite(true)}
              className="mt-4 text-caption"
            >
              Export / Sync Prompt Set
            </Button>
          </div>
        </div>
      )}

      {/* Tab 4: AI Engine Presence */}
      {activeTab === "engines" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              AI Engine Presence
            </h3>
            <p className="text-caption text-slate-500 dark:text-slate-400">
              Per-engine share of voice requires asking each engine the prompt set. This app cannot
              query ChatGPT, Perplexity, Gemini or Google AI Overviews without a provider, so no
              percentage is shown.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {["ChatGPT Search", "Google AI Overviews", "Google Gemini", "Perplexity AI", "Bing / Copilot"].map(
                (engine) => (
                  <div
                    key={engine}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body font-bold text-slate-900 dark:text-white">{engine}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-micro font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        Not measured
                      </span>
                    </div>
                    <p className="mt-2 text-caption text-slate-500 dark:text-slate-400">
                      Connect a visibility provider to import citations for this engine.
                    </p>
                  </div>
                )
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowVisibilitySuite(true)}
              className="mt-4 text-caption"
            >
              Connect VisibilitySuite Data
            </Button>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div>
          <span className="font-display text-body font-bold text-slate-900 dark:text-white">
            Export GEO Readiness into Client Deliverables
          </span>
          <p className="text-caption text-slate-500 dark:text-slate-400">
            The deck carries the measured on-page readiness score. Connect VisibilitySuite to add
            citation data, or leave it out.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowVisibilitySuite(true)}
            className="text-caption"
          >
            Connect VisibilitySuite Data
          </Button>
          {onRunDeckGeneration && (
            <Button onClick={onRunDeckGeneration} variant="primary" className="text-caption">
              Generate Visibility Deck with GEO Insights
            </Button>
          )}
        </div>
      </div>

      {showVisibilitySuite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVisibilitySuite(false);
          }}
        >
          <div className="w-full max-w-2xl">
            <VisibilitySuiteModal
              property={property}
              onClose={() => setShowVisibilitySuite(false)}
              onImportScore={(score) => {
                setImportedScore({
                  score: Math.max(0, Math.min(100, score)),
                  source: "VisibilitySuite",
                  importedAt: new Date().toISOString(),
                });
                setShowVisibilitySuite(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
