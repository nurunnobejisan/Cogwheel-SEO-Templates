"use client";

import { useState } from "react";
import { Button } from "./ui";
import { VisibilitySuiteModal } from "./VisibilitySuiteModal";

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

interface SchemaCheck {
  name: string;
  category: "Dining" | "Spa" | "Pet Policy" | "Amenities" | "Core Lodging";
  status: "passed" | "missing" | "warning";
  details: string;
  recommendation: string;
}

interface ConversationalQuery {
  query: string;
  intent: "Local Discovery" | "Amenity Validation" | "Comparison" | "Booking Intent";
  aiSource: "ChatGPT Search" | "Google AI Overview" | "Perplexity" | "Copilot";
  estimatedSv: number;
  citationConfidence: "High" | "Moderate" | "Low";
  simulatedResponse: string;
}

export function GeoReadinessRadar({ property, onRunDeckGeneration }: GeoProps) {
  const propertyName = property?.name || "Renaissance Shoals Resort & Spa";
  const propertyCity = property?.city || "Florence";
  const propertyState = property?.state || "AL";
  const propertyUrl =
    property?.url ||
    "https://www.marriott.com/en-us/hotels/mslbr-renaissance-shoals-resort-and-spa/overview/";

  const [activeTab, setActiveTab] = useState<"overview" | "schema" | "queries" | "engines">("overview");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(100);

  // Schema scan findings
  const [schemaChecks, setSchemaChecks] = useState<SchemaCheck[]>([
    {
      name: "Hotel / LodgingBusiness Schema",
      category: "Core Lodging",
      status: "passed",
      details: "Valid schema detected with name, address, and geo coordinates.",
      recommendation: "Ensure checkinTime and checkoutTime properties are explicitly declared.",
    },
    {
      name: "Restaurant / Dining Outlet Schema",
      category: "Dining",
      status: "warning",
      details: "On-site restaurant mentioned in text, but missing standalone Restaurant schema.",
      recommendation: "Add Restaurant schema with menu URL, openingHours, and cuisine type for AI dining queries.",
    },
    {
      name: "Day Spa & Wellness Schema",
      category: "Spa",
      status: "missing",
      details: "No HealthAndBeautyBusiness or DaySpa schema found.",
      recommendation: "Add DaySpa schema with service list and treatment packages for Perplexity/ChatGPT spa searches.",
    },
    {
      name: "Pets Allowed / Pet Policy Schema",
      category: "Pet Policy",
      status: "missing",
      details: "petsAllowed property is missing from property microdata.",
      recommendation: "Add 'petsAllowed: true/false' with pet fee details to capture AI pet-friendly searches.",
    },
    {
      name: "AmenityFeature Specification",
      category: "Amenities",
      status: "passed",
      details: "Pool, fitness center, and high-speed Wi-Fi identified in microdata.",
      recommendation: "Link individual amenities with amenityFeature LocationFeatureSpecification.",
    },
  ]);

  // Conversational AI queries
  const [conversationalQueries] = useState<ConversationalQuery[]>([
    {
      query: `Best boutique hotel with river view and spa in ${propertyCity} ${propertyState}`,
      intent: "Local Discovery",
      aiSource: "ChatGPT Search",
      estimatedSv: 480,
      citationConfidence: "High",
      simulatedResponse: `"${propertyName} is highlighted for its rotating panoramic dining, European spa, and Tennessee River views."`,
    },
    {
      query: `Does ${propertyName} allow pets and what are the fees?`,
      intent: "Amenity Validation",
      aiSource: "Google AI Overview",
      estimatedSv: 260,
      citationConfidence: "Low",
      simulatedResponse: `"AI Overview could not find an explicit Pet Policy schema on the official website; estimates $75 fee based on third-party OTAs."`,
    },
    {
      query: `Spa treatments and weekend packages at ${propertyName}`,
      intent: "Booking Intent",
      aiSource: "Perplexity",
      estimatedSv: 350,
      citationConfidence: "Moderate",
      simulatedResponse: `"Full-service spa offering massage therapies and bridal packages, but direct menu booking URL is not indexed in structured markup."`,
    },
    {
      query: `Where to host a 150-person corporate retreat near ${propertyCity} ${propertyState}`,
      intent: "Comparison",
      aiSource: "Copilot",
      estimatedSv: 190,
      citationConfidence: "High",
      simulatedResponse: `"Recommends ${propertyName} conference center with over 30,000 sq ft of flexible meeting facilities."`,
    },
  ]);

  const [readinessScore, setReadinessScore] = useState(78); // 0 - 100
  const [showVisibilitySuite, setShowVisibilitySuite] = useState(false);

  const handleRescan = () => {
    setIsScanning(true);
    setScanProgress(15);
    const t1 = setTimeout(() => setScanProgress(55), 400);
    const t2 = setTimeout(() => setScanProgress(85), 900);
    const t3 = setTimeout(() => {
      setScanProgress(100);
      setIsScanning(false);
    }, 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 text-white shadow-xl dark:border-slate-800">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-light">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              AI &amp; GEO Readiness Engine v2.4
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Generative Engine Optimization (GEO) Radar
            </h2>
            <p className="mt-1 max-w-xl text-xs text-slate-300 sm:text-sm">
              Evaluates how effectively <span className="font-semibold text-white">{propertyName}</span> is cited,
              synthesized, and recommended by ChatGPT Search, Google AI Overviews, and Perplexity.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-md bg-slate-800/80 px-2 py-1 font-mono text-[11px] text-slate-300">
                {propertyCity}, {propertyState}
              </span>
              <span className="truncate max-w-xs text-slate-400 font-mono text-[11px]">
                {propertyUrl}
              </span>
            </div>
          </div>

          {/* Circular Score Gauge */}
          <div className="flex shrink-0 items-center gap-5 rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4 backdrop-blur-md">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-700"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-brand transition-all duration-1000"
                  strokeDasharray={`${readinessScore}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-display text-xl font-extrabold text-white">{readinessScore}%</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">GEO Score</span>
              </div>
            </div>
            <div>
              <div className="inline-block rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                Grade: B+ Strong Readiness
              </div>
              <p className="mt-1 text-xs text-slate-300">
                3 of 5 schema pillars verified.
              </p>
              <button
                type="button"
                onClick={handleRescan}
                disabled={isScanning}
                className="mt-2 text-xs font-semibold text-brand-light hover:underline"
              >
                {isScanning ? `Auditing... ${scanProgress}%` : "↻ Re-Scan Property"}
              </button>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "overview"
                ? "bg-brand text-slate-900 shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            📊 Radar Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schema")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "schema"
                ? "bg-brand text-slate-900 shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            🏷️ Schema &amp; Entities Audit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("queries")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "queries"
                ? "bg-brand text-slate-900 shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            💬 Conversational AI Queries
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("engines")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "engines"
                ? "bg-brand text-slate-900 shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            🤖 AI Engine Presence
          </button>
          <button
            type="button"
            onClick={() => setShowVisibilitySuite(true)}
            className="rounded-xl border border-purple-500/40 bg-purple-900/60 px-3.5 py-1.5 text-xs font-bold text-purple-200 transition hover:bg-purple-800"
          >
            🔗 Connect VisibilitySuite Data
          </button>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Pillar 1 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pillar 01
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                85% Active
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
              Structured Schema Architecture
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Machine-readable JSON-LD enabling LLMs to extract amenities, restaurant hours, and spa menus without scraping ambiguity.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">LodgingBusiness</span>
                <span className="font-bold text-emerald-600">Verified</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Restaurant / Dining</span>
                <span className="font-bold text-amber-600">Missing Hours</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Day Spa &amp; Wellness</span>
                <span className="font-bold text-rose-600">Action Needed</span>
              </div>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pillar 02
              </span>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-400">
                72% Active
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
              Natural Language Question Coverage
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Direct answers to traveler prompts: pet policies, parking rates, resort fees, and wedding capacities.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">River View &amp; Suites FAQ</span>
                <span className="font-bold text-emerald-600">Covered</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Pet Fee &amp; Weight Limits</span>
                <span className="font-bold text-rose-600">Missing In FAQ</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Spa Treatment Pricing</span>
                <span className="font-bold text-amber-600">Partial</span>
              </div>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pillar 03
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-400">
                90% Strong
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
              Brand Entity Disambiguation
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Clear differentiation between {propertyName} and nearby competitor properties in the Muscle Shoals / Florence metro.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Google Knowledge Panel</span>
                <span className="font-bold text-emerald-600">Claimed</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">TripAdvisor Entity Match</span>
                <span className="font-bold text-emerald-600">Linked</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Direct Booking Citation</span>
                <span className="font-bold text-emerald-600">Primary URL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Schema Audit */}
      {activeTab === "schema" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Hospitality Schema Markup Audit
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Scanned schema entities essential for generative engines (Google Gemini, OpenAI, Perplexity).
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-slate-900 border border-brand/30">
                5 Schema Targets Scanned
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {schemaChecks.map((check, i) => (
                <div key={i} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          check.status === "passed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                            : check.status === "warning"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
                        }`}
                      >
                        {check.status === "passed" ? "✓" : check.status === "warning" ? "!" : "✕"}
                      </span>
                      <div>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {check.name}
                        </span>
                        <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {check.category}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        check.status === "passed"
                          ? "text-emerald-600"
                          : check.status === "warning"
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 pl-8.5">
                    {check.details}
                  </p>
                  <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white">Fix: </span>
                    {check.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Conversational AI Queries */}
      {activeTab === "queries" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              High-Value Conversational AI Queries
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Natural language queries travelers ask AI assistants where this property is a prime candidate.
            </p>

            <div className="mt-4 space-y-3">
              {conversationalQueries.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
                        {item.aiSource}
                      </span>
                      <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {item.intent}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">Est. SV: {item.estimatedSv}/mo</span>
                      <span
                        className={`font-semibold ${
                          item.citationConfidence === "High"
                            ? "text-emerald-600"
                            : item.citationConfidence === "Moderate"
                            ? "text-amber-600"
                            : "text-rose-600"
                        }`}
                      >
                        Citation: {item.citationConfidence}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    &ldquo;{item.query}&rdquo;
                  </p>

                  <div className="mt-2.5 rounded-xl border border-brand/20 bg-brand-50/50 p-3 text-xs text-slate-700 dark:border-brand/10 dark:bg-brand-950/20 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-brand-light">Simulated AI Answer: </span>
                    {item.simulatedResponse}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: AI Engine Breakdown */}
      {activeTab === "engines" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 dark:text-white">ChatGPT Search</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                84%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Strong web indexing of Marriott overview page; citing resort amenities and 360-degree rotating restaurant.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Google AI Overviews</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                88%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Pulls directly from Google Business Profile and Knowledge Graph. High visibility on Florence hotel queries.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Perplexity AI</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                68%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Relies heavily on Reddit &amp; review sites for sentiment. Needs structured FAQ schema to capture direct answers.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Bing / Copilot</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                74%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Indexes meeting room dimensions and conference specs accurately. Captures corporate retreat citations.
            </p>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Export GEO Findings into Client Deliverables
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Include AI Citation Readiness scores in the Monthly Visibility Deck or sync with VisibilitySuite.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowVisibilitySuite(true)}
            className="text-xs"
          >
            🔗 Connect VisibilitySuite Data
          </Button>
          {onRunDeckGeneration && (
            <Button onClick={onRunDeckGeneration} variant="primary">
              ✨ Generate Visibility Deck with GEO Insights
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
                setReadinessScore(score);
                setShowVisibilitySuite(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
