"use client";

import { useState, useMemo } from "react";
import { calculatePixelWidth, smartTrimTitle, DEFAULT_SERP_LIMITS } from "../../validators/serpOptimizer";
import { buildSchemaGraph, buildLocalBusinessSchema, buildFAQPageSchema, buildBreadcrumbSchema } from "../../schemas";

interface LabsViewProps {
  property?: {
    name: string;
    brand: string;
    city: string;
    state: string;
    url: string;
  };
}

export function LabsView({ property }: LabsViewProps) {
  // --- 1. SERP Preview State ---
  const [serpTitle, setSerpTitle] = useState(
    property?.name ? `${property.name} | Boutique Hotel in ${property.city || "Downtown"}` : "Luxury Downtown Hotel & Suites | Official Site"
  );
  const [serpDesc, setSerpDesc] = useState(
    property?.name
      ? `Book direct at ${property.name} in ${property.city}, ${property.state}. Best rate guarantee, modern boutique guest rooms, and exclusive on-site dining.`
      : "Experience modern boutique accommodations with luxury amenities, on-site dining, and lowest rate guarantee. Book your stay direct today."
  );
  const [serpDevice, setSerpDevice] = useState<"desktop" | "mobile">("desktop");

  const titlePx = useMemo(() => calculatePixelWidth(serpTitle), [serpTitle]);
  const descPx = useMemo(() => calculatePixelWidth(serpDesc), [serpDesc]);
  const isTitleDesktopOver = titlePx > DEFAULT_SERP_LIMITS.desktopTitleMaxPx;
  const isTitleMobileOver = titlePx > DEFAULT_SERP_LIMITS.mobileTitleMaxPx;
  const isDescOver = descPx > DEFAULT_SERP_LIMITS.metaDescMaxPx || serpDesc.length > 160;

  // --- 2. Keyword Clusterer State ---
  const [kwInput, setKwInput] = useState(
    "downtown hotel\nboutique hotel denver\nbest hotel deals\nrooftop pool hotel\npet friendly hotel denver\nhotel suites downtown\nluxury hotel near me"
  );
  const [clusters, setClusters] = useState<Record<string, string[]> | null>(null);

  const handleClusterKeywords = () => {
    const lines = kwInput.split("\n").map((s) => s.trim()).filter(Boolean);
    const result: Record<string, string[]> = {
      "Location & Core": [],
      "Amenities & Features": [],
      "Intent & Booking": [],
      "General & Long-tail": []
    };

    lines.forEach((kw) => {
      const lower = kw.toLowerCase();
      if (lower.includes("downtown") || lower.includes("denver") || lower.includes("near me") || lower.includes("city")) {
        result["Location & Core"].push(kw);
      } else if (lower.includes("pool") || lower.includes("pet") || lower.includes("suite") || lower.includes("spa") || lower.includes("luxury") || lower.includes("boutique")) {
        result["Amenities & Features"].push(kw);
      } else if (lower.includes("deal") || lower.includes("book") || lower.includes("rate") || lower.includes("best") || lower.includes("price")) {
        result["Intent & Booking"].push(kw);
      } else {
        result["General & Long-tail"].push(kw);
      }
    });

    setClusters(result);
  };

  // --- 3. Schema Generator State ---
  const [schemaType, setSchemaType] = useState<"Hotel" | "FAQ" | "Breadcrumbs">("Hotel");
  const [copiedSchema, setCopiedSchema] = useState(false);

  const generatedSchema = useMemo(() => {
    if (schemaType === "Hotel") {
      return buildSchemaGraph([
        buildLocalBusinessSchema({
          name: property?.name || "The Curtis Denver",
          url: property?.url || "https://example.com/",
          type: "Hotel",
          address: {
            addressLocality: property?.city || "Denver",
            addressRegion: property?.state || "CO",
            addressCountry: "US"
          },
          amenities: ["Free High-Speed WiFi", "Pet Friendly", "On-site Dining", "Fitness Center"]
        })
      ]);
    } else if (schemaType === "FAQ") {
      return buildSchemaGraph([
        buildFAQPageSchema({
          url: property?.url || "https://example.com/",
          items: [
            { question: "What time is check-in?", answer: "Check-in begins at 4:00 PM." },
            { question: "Is parking available on site?", answer: "Yes, 24/7 valet parking is available with in-and-out privileges." }
          ]
        })
      ]);
    } else {
      return buildSchemaGraph([
        buildBreadcrumbSchema({
          items: [
            { name: "Home", url: "https://example.com/" },
            { name: "Hotels", url: "https://example.com/hotels/" },
            { name: property?.city || "Denver", url: `https://example.com/hotels/${(property?.city || "denver").toLowerCase()}/` },
            { name: property?.name || "Property", url: property?.url || "https://example.com/property/" }
          ]
        })
      ]);
    }
  }, [schemaType, property]);

  const handleCopySchema = () => {
    navigator.clipboard?.writeText(generatedSchema);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  // --- 4. Robots.txt Tester State ---
  const [testUrl, setTestUrl] = useState(property?.url ? `${property.url}checkout/` : "https://example.com/checkout/");
  const [selectedBot, setSelectedBot] = useState<"Googlebot" | "GPTBot" | "ClaudeBot">("Googlebot");
  const [robotsResult, setRobotsResult] = useState<{ allowed: boolean; rule: string } | null>(null);

  const handleTestRobots = () => {
    const isRestricted = testUrl.includes("/checkout") || testUrl.includes("/admin") || testUrl.includes("/api");
    if (selectedBot === "GPTBot" || selectedBot === "ClaudeBot") {
      setRobotsResult({
        allowed: !isRestricted,
        rule: isRestricted ? `Disallow: /checkout/ (Blocked for ${selectedBot})` : `User-agent: ${selectedBot} - Allow: /`
      });
    } else {
      setRobotsResult({
        allowed: !isRestricted,
        rule: isRestricted ? "Disallow: /checkout/ (Standard Searchbot Protection)" : "Allow: / (Crawlable by Googlebot)"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Labs Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Labs</h2>
            <span className="rounded-full border border-violet-300/60 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:border-violet-700/60 dark:bg-violet-950/40 dark:text-violet-300">
              Interactive Diagnostic Suite
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time SEO sandbox utilities: SERP pixel analyzer, Schema generator, topic clustering, and crawler checks.
          </p>
        </div>
      </div>

      {/* Grid of Tools */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* 1. SERP Pixel-Width Simulator */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/60">
                  <svg className="h-4 w-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Live SERP Pixel Optimizer</span>
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSerpDevice("desktop")}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${serpDevice === "desktop" ? "bg-white shadow-xs text-slate-900 dark:bg-slate-900 dark:text-white" : "text-slate-500"}`}
                >
                  Desktop (580px)
                </button>
                <button
                  type="button"
                  onClick={() => setSerpDevice("mobile")}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${serpDevice === "mobile" ? "bg-white shadow-xs text-slate-900 dark:bg-slate-900 dark:text-white" : "text-slate-500"}`}
                >
                  Mobile (920px)
                </button>
              </div>
            </div>

            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Page Title ({serpTitle.length} chars • {titlePx}px / {serpDevice === "desktop" ? "580px" : "920px"})
            </label>
            <input
              type="text"
              value={serpTitle}
              onChange={(e) => setSerpTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 mb-3"
            />

            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Meta Description ({serpDesc.length} chars • {descPx}px / 920px)
            </label>
            <textarea
              rows={2}
              value={serpDesc}
              onChange={(e) => setSerpDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            {/* Google Result Preview Mockup */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1 truncate">
                <span className="font-semibold text-slate-700 dark:text-slate-300">razibmarketing.com</span>
                <span>›</span>
                <span>hotels</span>
                <span>›</span>
                <span className="truncate">{(property?.city || "denver").toLowerCase()}</span>
              </div>
              <div
                className={`text-base font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer truncate ${serpDevice === "desktop" ? "max-w-[580px]" : "max-w-[920px]"}`}
              >
                {serpDevice === "desktop" && isTitleDesktopOver ? smartTrimTitle(serpTitle, 580) : serpTitle}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                {serpDesc}
              </div>

              {/* Status Indicator Pill */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                <span className={isTitleDesktopOver && serpDevice === "desktop" ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                  {isTitleDesktopOver && serpDevice === "desktop" ? "⚠️ Title exceeds Desktop width" : "✔ Title pixel width optimal"}
                </span>
                <span className={isDescOver ? "text-amber-600 font-medium" : "text-slate-500"}>
                  {isDescOver ? "⚠️ Long meta description" : "✔ Meta length compliant"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Composable JSON-LD Schema Generator */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60">
                  <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">JSON-LD @graph Schema Generator</span>
              </div>
              <div className="flex gap-1">
                {(["Hotel", "FAQ", "Breadcrumbs"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSchemaType(type)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${schemaType === type ? "bg-emerald-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
              Live, composable Schema.org structured data preview ready for Google Rich Snippets:
            </p>

            <pre className="h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-emerald-400 dark:border-slate-800">
              {generatedSchema}
            </pre>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Includes schema.org @context &amp; @graph structure</span>
            <button
              type="button"
              onClick={handleCopySchema}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              {copiedSchema ? "✔ Copied!" : "Copy JSON-LD"}
            </button>
          </div>
        </div>

        {/* 3. Semantic Keyword Clustering */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60">
                <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Keyword Cluster Analyzer</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Group raw target keywords into semantic topical clusters for site architecture:
            </p>
            <textarea
              rows={4}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            {clusters && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(clusters).map(([cat, kws]) => (
                  <div key={cat} className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-2.5 dark:border-violet-900/60 dark:bg-violet-950/30">
                    <div className="font-bold text-violet-800 dark:text-violet-300 text-[11px] mb-1">
                      {cat} ({kws.length})
                    </div>
                    <ul className="space-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                      {kws.slice(0, 3).map((kw, i) => (
                        <li key={i} className="truncate">• {kw}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClusterKeywords}
            className="mt-4 w-full rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
          >
            Cluster Keywords &rarr;
          </button>
        </div>

        {/* 4. Robots.txt & Crawler Inspector */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/60">
                <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Robots.txt &amp; AI Crawler Simulator</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Test whether specific URL paths are allowed or blocked for traditional searchbots and AI models:
            </p>
            <div className="space-y-2">
              <input
                type="url"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <div className="flex gap-2">
                {(["Googlebot", "GPTBot", "ClaudeBot"] as const).map((bot) => (
                  <button
                    key={bot}
                    type="button"
                    onClick={() => setSelectedBot(bot)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-xl border transition ${selectedBot === bot ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {bot}
                  </button>
                ))}
              </div>
            </div>

            {robotsResult && (
              <div className={`mt-3 rounded-xl border p-3 text-xs ${robotsResult.allowed ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                <div className="font-bold">{robotsResult.allowed ? "✔ ALLOWED" : "✖ BLOCKED"}</div>
                <div className="text-[11px] mt-0.5 font-mono">{robotsResult.rule}</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleTestRobots}
            className="mt-4 w-full rounded-xl bg-orange-500 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
          >
            Simulate Crawler Access &rarr;
          </button>
        </div>

      </div>

      {/* Roadmap Banner */}
      <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4 text-center dark:border-violet-800/60 dark:bg-violet-950/20">
        <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
          🧪 Enterprise SEO Labs Suite — Powered by Razib Marketing
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Integrated with 10-Gate SEO Quality Engine • Multi-CMS Export Support (HTML, Liquid, WordPress, Webflow)
        </p>
      </div>
    </div>
  );
}
