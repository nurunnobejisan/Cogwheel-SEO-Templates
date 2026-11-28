"use client";

import { useState, useMemo } from "react";
import { calculatePixelWidth, smartTrimTitle, DEFAULT_SERP_LIMITS } from "../../validators/serpOptimizer";
import { buildSchemaGraph, buildLocalBusinessSchema, buildFAQPageSchema, buildBreadcrumbSchema } from "../../schemas";
import { exportToHtml, exportToShopifyLiquid, exportToWordPressPhp, exportToWebflowCsv } from "../../exporters";
import { cleanContent, countWords, generateNgrams, calculateJaccardSimilarity } from "../../validators/uniquenessGate";
import { normalizeCanonicalUrl } from "../../validators/canonicalNormalizer";
import { GeoReadinessRadar } from "./GeoReadinessRadar";
import { CompsetRankingMatrix } from "./CompsetRankingMatrix";
import dynamic from "next/dynamic";

const TemplatesHubClient = dynamic(() =>
  import("../app/templates/TemplatesHubClient").then((m) => m.TemplatesHubClient)
);
const StrategyMatrixContent = dynamic(() =>
  import("./StrategyMatrixContent").then((m) => m.StrategyMatrixContent)
);
const ArchitectureContent = dynamic(() =>
  import("./ArchitectureContent").then((m) => m.ArchitectureContent)
);

interface LabsViewProps {
  property?: {
    name: string;
    brand: string;
    city: string;
    state: string;
    url: string;
  };
  activeSubTab?: "geo" | "compset" | "sandbox" | "templates" | "matrix" | "architecture";
  onSubTabChange?: (tab: "geo" | "compset" | "sandbox" | "templates" | "matrix" | "architecture") => void;
  onRunDeckGeneration?: () => void;
  onExportMemo?: () => void;
  onOpenImageAudit?: () => void;
  onOpenHeadingAudit?: () => void;
}

export function LabsView({
  property,
  activeSubTab,
  onSubTabChange,
  onRunDeckGeneration,
  onExportMemo,
  onOpenImageAudit,
  onOpenHeadingAudit,
}: LabsViewProps) {
  const [internalSubTab, setInternalSubTab] = useState<"geo" | "compset" | "sandbox" | "templates" | "matrix" | "architecture">(
    activeSubTab || "geo"
  );

  const currentTab = activeSubTab || internalSubTab;
  const setTab = (t: "geo" | "compset" | "sandbox" | "templates" | "matrix" | "architecture") => {
    setInternalSubTab(t);
    onSubTabChange?.(t);
  };
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
  const [showRichSnippet, setShowRichSnippet] = useState(true);

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
  const [copiedGoogleTest, setCopiedGoogleTest] = useState(false);

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

  const handleValidateWithGoogle = () => {
    navigator.clipboard?.writeText(generatedSchema);
    setCopiedGoogleTest(true);
    const targetUrl = property?.url
      ? `https://search.google.com/test/rich-results?url=${encodeURIComponent(property.url)}`
      : "https://search.google.com/test/rich-results";
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => setCopiedGoogleTest(false), 3500);
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

  // --- 5. Multi-CMS Exporter State ---
  const [exportCms, setExportCms] = useState<"HTML" | "Shopify" | "WordPress" | "Webflow">("HTML");
  const [copiedCms, setCopiedCms] = useState(false);

  const exportedCmsCode = useMemo(() => {
    const propName = property?.name || "The Curtis Denver";
    const propCity = property?.city || "Denver";
    const propUrl = property?.url || "https://example.com/hotel/";

    if (exportCms === "HTML") {
      return exportToHtml(
        {
          title: `${propName} | Luxury Downtown Hotel in ${propCity}`,
          metaDescription: `Official site of ${propName} in ${propCity}. Best rate guaranteed direct booking, boutique guest rooms, and premium amenities.`,
          canonicalUrl: propUrl,
          bodyContent: `<header>\n  <h1>${propName}</h1>\n  <p>Luxury accommodations in the heart of ${propCity}.</p>\n</header>\n<main>\n  <section id="rooms">\n    <h2>Boutique Suites</h2>\n    <p>Discover personalized hospitality and modern comforts.</p>\n  </section>\n</main>`,
          jsonLdScript: generatedSchema
        },
        { minify: false }
      );
    } else if (exportCms === "Shopify") {
      return exportToShopifyLiquid({
        scope: "product",
        snippetName: "hotel-suite-showcase",
        title: `${propName} — Luxury Suite Booking`,
        metaDescription: `Reserve direct at ${propName} with lowest rate guarantee.`,
        richContentHtml: `<h2>${propName} Guest Room Experience</h2>\n<p>Book direct with complimentary high-speed Wi-Fi and flexible cancellation.</p>`,
        schemaJsonLd: generatedSchema
      });
    } else if (exportCms === "WordPress") {
      return exportToWordPressPhp({
        postTitle: `${propName} — Destination & Accommodation Guide`,
        postName: `${propName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-guide`,
        postContent: `<h2>Welcome to ${propName}</h2>\n<p>Nestled in ${propCity}, offering upscale guest suites, on-site dining, and exceptional service.</p>`,
        seoTitle: `${propName} | Official Website`,
        metaDescription: `Discover ${propName} in ${propCity}. Lowest rates guaranteed online.`,
        canonicalUrl: propUrl,
        focusKeyword: `${propName.toLowerCase()} hotel`,
        schemaJsonLd: generatedSchema
      });
    } else {
      return exportToWebflowCsv([
        {
          name: `${propName} Luxury King Suite`,
          slug: `${propName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-king-suite`,
          metaTitle: `${propName} | King Suite Accommodations`,
          metaDescription: `Spacious luxury suite in ${propCity} with private balcony and skyline views.`,
          postBodyHtml: `<h2>King Suite Details</h2><p>Featuring plush bedding, workstation, and marble bathroom.</p>`,
          heroImage: "https://example.com/images/hero-suite.jpg",
          category: "Accommodations",
          archived: false,
          draft: false
        }
      ]);
    }
  }, [exportCms, property, generatedSchema]);

  const handleCopyCms = () => {
    navigator.clipboard?.writeText(exportedCmsCode);
    setCopiedCms(true);
    setTimeout(() => setCopiedCms(false), 2000);
  };

  const handleDownloadCms = () => {
    const ext = exportCms === "HTML" ? "html" : exportCms === "Shopify" ? "liquid" : exportCms === "WordPress" ? "php" : "csv";
    const filename = `seo-studio-${exportCms.toLowerCase()}-export.${ext}`;
    const blob = new Blob([exportedCmsCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- 6. GEO AI Search Overview State ---
  const [aiEngine, setAiEngine] = useState<"ChatGPT" | "Gemini" | "Perplexity">("Gemini");

  // Deterministic, schema-derived readiness check (NOT an AI-citation score).
  // No AI engine is queried here; we only evaluate the JSON-LD we generated.
  const geoReadiness = useMemo(() => {
    const checks = [
      { label: "Schema.org @context declared", pass: /"@context"\s*:/.test(generatedSchema) },
      { label: "@graph container present", pass: /"@graph"\s*:/.test(generatedSchema) },
      { label: "Entity name present", pass: /"name"\s*:/.test(generatedSchema) },
      { label: "URL/identifier present", pass: /"url"\s*:/.test(generatedSchema) || /"@id"\s*:/.test(generatedSchema) },
      { label: "Rich-result eligible type (Hotel/FAQPage/BreadcrumbList)", pass: /"@type"\s*:\s*"(Hotel|FAQPage|BreadcrumbList)"/.test(generatedSchema) },
    ];
    const passed = checks.filter((c) => c.pass).length;
    return { checks, passed, total: checks.length, pct: Math.round((passed / checks.length) * 100) };
  }, [generatedSchema]);

  // --- 7. Content Duplicate & Thin-Content Scanner State ---
  const [docA, setDocA] = useState(
    property?.name
      ? `${property.name} offers boutique accommodations in downtown ${property.city}. Enjoy plush pillowtop mattresses, custom local artwork, signature bath products, and high-speed Wi-Fi. Dine at our award-winning on-site bistro featuring locally sourced ingredients.`
      : "Our boutique hotel offers luxury accommodations in the downtown arts district. Enjoy plush pillowtop mattresses, custom artwork, signature amenities, and complimentary high-speed Wi-Fi. Dine at our award-winning bistro featuring seasonal farm-to-table cuisine."
  );
  const [docB, setDocB] = useState(
    property?.name
      ? `Stay at ${property.name} located in downtown ${property.city}. Featuring plush pillowtop mattresses, custom local artwork, signature bath products, and high-speed Wi-Fi. On-site bistro serves locally sourced ingredients and craft cocktails daily.`
      : "Book a stay at the downtown boutique hotel. Each room features plush pillowtop mattresses, custom artwork, signature amenities, and complimentary high-speed Wi-Fi. On-site bistro serves farm-to-table breakfast and dinner."
  );

  const duplicateAnalysis = useMemo(() => {
    const cleanedA = cleanContent(docA);
    const cleanedB = cleanContent(docB);
    const wordsA = countWords(cleanedA);
    const wordsB = countWords(cleanedB);

    const ngramsA = generateNgrams(cleanedA, 3);
    const ngramsB = generateNgrams(cleanedB, 3);
    const similarity = calculateJaccardSimilarity(ngramsA, ngramsB);
    const simPercent = Math.round(similarity * 100);

    const overlapping: string[] = [];
    for (const ng of ngramsA) {
      if (ngramsB.has(ng)) {
        overlapping.push(ng);
        if (overlapping.length >= 8) break;
      }
    }

    const isDuplicate = simPercent >= 70;
    const isThin = wordsA < 50 || wordsB < 50;

    return {
      wordsA,
      wordsB,
      simPercent,
      isDuplicate,
      isThin,
      overlapping
    };
  }, [docA, docB]);

  // --- 8. Dirty URL & Canonical Normalizer Playground State ---
  const [rawUrlInput, setRawUrlInput] = useState(
    property?.url
      ? `http://${property.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}//rooms///deluxe-suite?utm_source=facebook&utm_medium=cpc&gclid=CjwKCAiA_123&fbclid=IwAR098#photos`
      : "http://HOTEL-DENVER.COM//hotels///downtown-suites/?utm_source=google_ads&utm_medium=cpc&utm_campaign=winter_promo&gclid=789xyz&fbclid=abc123#rates"
  );
  const [canonicalOpts, setCanonicalOpts] = useState({
    forceHttps: true,
    stripTracking: true,
    trailingSlash: true,
    stripHash: true
  });
  const [copiedCanonical, setCopiedCanonical] = useState(false);
  const [copiedTag, setCopiedTag] = useState(false);

  const normalizedResult = useMemo(() => {
    try {
      const cleanUrl = normalizeCanonicalUrl(rawUrlInput, canonicalOpts);
      const tag = `<link rel="canonical" href="${cleanUrl}" />`;
      
      const removedParams: string[] = [];
      try {
        const u = new URL(rawUrlInput.startsWith("http") ? rawUrlInput : `https://${rawUrlInput}`);
        u.searchParams.forEach((_, key) => {
          if (canonicalOpts.stripTracking && (key.startsWith("utm_") || ["fbclid", "gclid", "ref", "mc_eid", "zanpid"].includes(key.toLowerCase()))) {
            removedParams.push(key);
          }
        });
      } catch {
        // ignore parse error for partial inputs
      }

      return {
        success: true,
        url: cleanUrl,
        tag,
        removedParams
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        url: "",
        tag: "",
        removedParams: []
      };
    }
  }, [rawUrlInput, canonicalOpts]);

  const handleCopyCanonical = () => {
    if (normalizedResult.url) {
      navigator.clipboard?.writeText(normalizedResult.url);
      setCopiedCanonical(true);
      setTimeout(() => setCopiedCanonical(false), 2000);
    }
  };

  const handleCopyTag = () => {
    if (normalizedResult.tag) {
      navigator.clipboard?.writeText(normalizedResult.tag);
      setCopiedTag(true);
      setTimeout(() => setCopiedTag(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Labs Studio Master Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-micro font-bold uppercase tracking-wider text-brand-light dark:bg-brand dark:text-slate-900">
              Labs Studio
            </span>
            <span className="font-display text-body font-bold text-slate-900 dark:text-white">
              SEO &amp; GEO Intelligence Suite
            </span>
          </div>
          <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
            Generative Engine Optimization (GEO), Local Comp-Set benchmarking, and interactive diagnostic utilities.
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-caption font-semibold dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab("geo")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              currentTab === "geo"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            AI &amp; GEO Radar
          </button>
          <button
            type="button"
            onClick={() => setTab("compset")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              currentTab === "compset"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Local Comp-Set Matrix
          </button>
          <button
            type="button"
            onClick={() => setTab("sandbox")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              currentTab === "sandbox"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Diagnostic Sandbox (8 Tools)
          </button>
          <button
            type="button"
            onClick={() => setTab("templates")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              currentTab === "templates"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setTab("matrix")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              currentTab === "matrix"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Strategy Matrix
          </button>
          <button
            type="button"
            onClick={() => setTab("architecture")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              currentTab === "architecture"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Architecture
          </button>
        </div>
      </div>

      {/* Sub-tab 1: AI & GEO Radar */}
      {currentTab === "geo" && (
        <GeoReadinessRadar
          property={property}
          onRunDeckGeneration={onRunDeckGeneration}
        />
      )}

      {/* Sub-tab 2: Local Comp-Set Matrix */}
      {currentTab === "compset" && (
        <CompsetRankingMatrix
          property={property}
          onExportMemo={onExportMemo}
        />
      )}

      {/* Sub-tab: Templates */}
      {currentTab === "templates" && (
        <div className="space-y-6">
          <TemplatesHubClient />
        </div>
      )}

      {/* Sub-tab: Strategy Matrix */}
      {currentTab === "matrix" && (
        <div className="space-y-6">
          <StrategyMatrixContent />
        </div>
      )}

      {/* Sub-tab: Architecture */}
      {currentTab === "architecture" && (
        <div className="space-y-6">
          <ArchitectureContent />
        </div>
      )}

      {/* Sub-tab 3: Diagnostic Sandbox */}
      {currentTab === "sandbox" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">

        {/* 1. SERP Pixel-Width Simulator with Rich Snippets */}
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
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">Live SERP &amp; Rich Snippet Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-tiny font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRichSnippet}
                    onChange={(e) => setShowRichSnippet(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Rich Stars</span>
                </label>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setSerpDevice("desktop")}
                    className={`px-2 py-1 text-tiny font-semibold rounded-md transition ${serpDevice === "desktop" ? "bg-white shadow-xs text-slate-900 dark:bg-slate-900 dark:text-white" : "text-slate-500"}`}
                  >
                    Desktop (580px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSerpDevice("mobile")}
                    className={`px-2 py-1 text-tiny font-semibold rounded-md transition ${serpDevice === "mobile" ? "bg-white shadow-xs text-slate-900 dark:bg-slate-900 dark:text-white" : "text-slate-500"}`}
                  >
                    Mobile (920px)
                  </button>
                </div>
              </div>
            </div>

            <label className="block text-tiny font-bold text-slate-600 dark:text-slate-400 mb-1">
              Page Title ({serpTitle.length} chars • {titlePx}px / {serpDevice === "desktop" ? "580px" : "920px"})
            </label>
            <input
              type="text"
              value={serpTitle}
              onChange={(e) => setSerpTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 mb-3"
            />

            <label className="block text-tiny font-bold text-slate-600 dark:text-slate-400 mb-1">
              Meta Description ({serpDesc.length} chars • {descPx}px / 920px)
            </label>
            <textarea
              rows={2}
              value={serpDesc}
              onChange={(e) => setSerpDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            {/* Google Result Preview Mockup */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="text-tiny text-slate-500 flex items-center gap-1.5 mb-1 truncate">
                <span className="font-semibold text-slate-700 dark:text-slate-300">seo-studio.vercel.app</span>
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

              {/* Rich Snippet Elements: Stars, Price, Reviews (example placeholders) */}
              {showRichSnippet && (
                <div className="flex items-center gap-2 mt-1 text-caption">
                  <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-micro font-bold text-amber-700 dark:text-amber-400">Example</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-tiny">4.9</span>
                  <span className="text-slate-400 text-tiny">(reviews)</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-tiny">From $000/night</span>
                  <span className="rounded bg-sky-100 dark:bg-sky-950 px-1.5 py-0.2 text-micro text-sky-700 dark:text-sky-300 font-semibold">Free WiFi</span>
                </div>
              )}

              <div className="text-caption text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                {serpDesc}
              </div>

              {/* Status Indicator Pill */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-tiny">
                <span className={isTitleDesktopOver && serpDevice === "desktop" ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                  {isTitleDesktopOver && serpDevice === "desktop" ? "Title exceeds Desktop width" : "Title pixel width optimal"}
                </span>
                <span className={isDescOver ? "text-amber-600 font-medium" : "text-slate-500"}>
                  {isDescOver ? "Long meta description" : "Meta length compliant"}
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
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">JSON-LD @graph Schema Generator</span>
              </div>
              <div className="flex gap-1">
                {(["Hotel", "FAQ", "Breadcrumbs"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSchemaType(type)}
                    className={`px-2.5 py-1 text-tiny font-semibold rounded-lg transition ${schemaType === type ? "bg-emerald-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400 mb-2.5">
              Live, composable Schema.org structured data preview ready for Google Rich Snippets:
            </p>

            <pre className="h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-tiny text-emerald-400 dark:border-slate-800">
              {generatedSchema}
            </pre>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-tiny text-slate-500">Includes schema.org @context &amp; @graph structure</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleValidateWithGoogle}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-caption font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                title="Copies JSON-LD and opens Google's Rich Results Testing Tool"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {copiedGoogleTest ? "Opening Tester (Code Copied!)" : "Google Rich Results Test"}
              </button>
              <button
                type="button"
                onClick={handleCopySchema}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-caption font-semibold text-white transition hover:bg-emerald-700"
              >
                {copiedSchema ? "Copied!" : "Copy JSON-LD"}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Multi-CMS Code Exporter Playground (NEW!) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60">
                  <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">Multi-CMS Production Exporter</span>
              </div>
              <div className="flex gap-1">
                {(["HTML", "Shopify", "WordPress", "Webflow"] as const).map((cms) => (
                  <button
                    key={cms}
                    type="button"
                    onClick={() => setExportCms(cms)}
                    className={`px-2 py-1 text-tiny font-semibold rounded-lg transition ${exportCms === cms ? "bg-indigo-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {cms}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400 mb-2.5">
              Instantly export W3C HTML5, Shopify Liquid objects, WordPress PHP partials, or Webflow CSV:
            </p>

            <pre className="h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-tiny text-indigo-300 dark:border-slate-800">
              {exportedCmsCode}
            </pre>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-tiny text-slate-500">
              Format: {exportCms === "HTML" ? "HTML5 (.html)" : exportCms === "Shopify" ? "Liquid (.liquid)" : exportCms === "WordPress" ? "PHP (.php)" : "CSV (.csv)"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyCms}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-caption font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
              >
                {copiedCms ? "Copied!" : "Copy Code"}
              </button>
              <button
                type="button"
                onClick={handleDownloadCms}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-caption font-semibold text-white transition hover:bg-indigo-700"
              >
                Download File &darr;
              </button>
            </div>
          </div>
        </div>

        {/* 4. GEO AI Search Overview Simulator (NEW!) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-950/60">
                  <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">GEO AI Search Simulator</span>
              </div>
              <div className="flex gap-1">
                {(["Gemini", "ChatGPT", "Perplexity"] as const).map((eng) => (
                  <button
                    key={eng}
                    type="button"
                    onClick={() => setAiEngine(eng)}
                    className={`px-2.5 py-1 text-tiny font-semibold rounded-lg transition ${aiEngine === eng ? "bg-purple-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {eng}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400 mb-2">
              Illustrative example of how a generative engine might summarise{" "}
              {property?.name || "your hotel"} from JSON-LD schemas. This is a static example, not a live AI output.
            </p>

            <div className="rounded-xl border border-purple-200/80 bg-purple-50/50 p-3.5 dark:border-purple-900/60 dark:bg-purple-950/30">
              <div className="flex items-center gap-2 text-tiny font-bold text-purple-800 dark:text-purple-300 mb-2">
                <span className="rounded bg-purple-200/70 px-1.5 py-0.5 text-micro uppercase tracking-wider text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                  Example
                </span>
                <span>{aiEngine} summary shape:</span>
              </div>
              <p className="text-caption text-slate-700 dark:text-slate-200 leading-relaxed">
                &ldquo;{property?.name || "The Curtis Denver"} is a boutique hotel in downtown {property?.city || "Denver"}.
                Key amenities include high-speed Wi-Fi, pet-friendly accommodations, valet parking, and on-site dining.&rdquo;
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-purple-200/60 dark:border-purple-900/40">
                <span className="text-micro font-semibold text-slate-500">Sources an engine would cite:</span>
                <span className="rounded-md bg-white px-2 py-0.5 text-micro font-medium text-slate-700 shadow-xs dark:bg-slate-800 dark:text-slate-200">
                  {property?.name || "The Curtis"} Official Site
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-micro font-medium text-slate-700 shadow-xs dark:bg-slate-800 dark:text-slate-200">
                  Schema.org Hotel Graph
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-tiny font-semibold text-emerald-600 dark:text-emerald-400">
              {geoReadiness.pct}% Schema readiness ({geoReadiness.passed}/{geoReadiness.total} checks)
            </span>
            <span className="text-micro text-slate-400">Derived from the JSON-LD above — not an AI-citation score</span>
          </div>
        </div>

        {/* 5. Semantic Keyword Clustering */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60">
                <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </span>
              <span className="text-body font-bold text-slate-800 dark:text-slate-100">Keyword Cluster Analyzer</span>
            </div>
            <p className="text-caption text-slate-500 dark:text-slate-400 mb-2">
              Group raw target keywords into semantic topical clusters for site architecture:
            </p>
            <textarea
              rows={4}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-caption text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            {clusters && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-caption">
                {Object.entries(clusters).map(([cat, kws]) => (
                  <div key={cat} className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-2.5 dark:border-violet-900/60 dark:bg-violet-950/30">
                    <div className="font-bold text-violet-800 dark:text-violet-300 text-tiny mb-1">
                      {cat} ({kws.length})
                    </div>
                    <ul className="space-y-0.5 text-micro text-slate-600 dark:text-slate-300">
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
            className="mt-4 w-full rounded-xl bg-violet-600 py-2 text-caption font-semibold text-white transition hover:bg-violet-700"
          >
            Cluster Keywords &rarr;
          </button>
        </div>

        {/* 6. Robots.txt & Crawler Inspector */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/60">
                <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <span className="text-body font-bold text-slate-800 dark:text-slate-100">Robots.txt &amp; AI Crawler Simulator</span>
            </div>
            <p className="text-caption text-slate-500 dark:text-slate-400 mb-2">
              Test whether specific URL paths are allowed or blocked for traditional searchbots and AI models:
            </p>
            <div className="space-y-2">
              <input
                type="url"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <div className="flex gap-2">
                {(["Googlebot", "GPTBot", "ClaudeBot"] as const).map((bot) => (
                  <button
                    key={bot}
                    type="button"
                    onClick={() => setSelectedBot(bot)}
                    className={`flex-1 py-1.5 text-caption font-semibold rounded-xl border transition ${selectedBot === bot ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {bot}
                  </button>
                ))}
              </div>
            </div>

            {robotsResult && (
              <div className={`mt-3 rounded-xl border p-3 text-caption ${robotsResult.allowed ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                <div className="font-bold">{robotsResult.allowed ? "ALLOWED" : "BLOCKED"}</div>
                <div className="text-tiny mt-0.5 font-mono">{robotsResult.rule}</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleTestRobots}
            className="mt-4 w-full rounded-xl bg-orange-500 py-2 text-caption font-semibold text-white transition hover:bg-orange-600"
          >
            Simulate Crawler Access &rarr;
          </button>
        </div>

        {/* 7. Content Duplicate & Thin-Content Scanner */}
        <div className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/60">
                  <svg className="h-4 w-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">Duplicate &amp; Thin-Content Scanner</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDocA("The Curtis Denver - a DoubleTree by Hilton Hotel offers boutique downtown accommodations with themed floor decor, high-speed Wi-Fi, and convenient access to the Denver Performing Arts Complex. Enjoy on-site bistro dining, complimentary fitness center access, and flexible meeting spaces.");
                  setDocB("Stay at The Curtis Denver - a DoubleTree by Hilton Hotel. Features downtown boutique accommodations, themed floor decor, high-speed Wi-Fi, and proximity to the Denver Performing Arts Complex. Amenities include on-site bistro dining, complimentary fitness center, and event space.");
                }}
                className="text-tiny font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline"
              >
                Load Sample
              </button>
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400 mb-3">
              Compare website copy against OTA (Expedia, Booking.com) to prevent Google duplicate content penalties (&lt;70% similarity ceiling):
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-tiny font-bold text-slate-600 dark:text-slate-400">
                    Document A (Website Copy)
                  </label>
                  <span className="text-micro font-mono text-slate-400">
                    {duplicateAnalysis.wordsA} words
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={docA}
                  onChange={(e) => setDocA(e.target.value)}
                  placeholder="Paste website room copy or article text..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-caption text-slate-800 focus:border-rose-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-tiny font-bold text-slate-600 dark:text-slate-400">
                    Document B (OTA / Syndicated Copy)
                  </label>
                  <span className="text-micro font-mono text-slate-400">
                    {duplicateAnalysis.wordsB} words
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={docB}
                  onChange={(e) => setDocB(e.target.value)}
                  placeholder="Paste OTA listing copy or comparison text..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-caption text-slate-800 focus:border-rose-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Live Similarity Score & Validation Result */}
            <div className={`mt-3 rounded-xl border p-3 text-caption transition ${
              duplicateAnalysis.isDuplicate
                ? "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                : "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${duplicateAnalysis.isDuplicate ? "bg-rose-600" : "bg-emerald-500"}`} />
                  {duplicateAnalysis.isDuplicate ? "DUPLICATE CONTENT DETECTED" : "SAFE & UNIQUE CONTENT"}
                </span>
                <span className="font-mono text-body font-extrabold">
                  {duplicateAnalysis.simPercent}% Similarity
                </span>
              </div>
              <p className="mt-1 text-tiny leading-relaxed opacity-90">
                {duplicateAnalysis.isDuplicate
                  ? "Exceeds 70% Jaccard tri-gram threshold. Search engines may filter or de-index one of the pages. Rewrite key phrases to differentiate."
                  : "Within safe uniqueness thresholds (< 70%). Independent topical signals established for organic search ranking."}
              </p>

              {duplicateAnalysis.isThin && (
                <div className="mt-2 text-micro font-semibold text-amber-700 dark:text-amber-400">
                  Note: One or both documents contain under 50 words (thin content risk).
                </div>
              )}

              {duplicateAnalysis.overlapping.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/60">
                  <span className="text-micro font-semibold text-slate-500 block mb-1">Overlapping 3-Gram Phrases:</span>
                  <div className="flex flex-wrap gap-1">
                    {duplicateAnalysis.overlapping.map((phrase, i) => (
                      <span key={i} className="rounded-md bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 text-micro font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        &ldquo;{phrase}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-tiny text-slate-400">
            <span>Client-side Jaccard Tri-gram Algorithm</span>
            <span className="font-medium text-slate-500 dark:text-slate-400">Zero Server Latency</span>
          </div>
        </div>

        {/* 8. Dirty URL & Canonical Normalizer Playground */}
        <div className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-950/60">
                  <svg className="h-4 w-4 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </span>
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">Dirty URL &amp; Canonical Normalizer</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRawUrlInput("http://HOTEL-DENVER.COM//hotels///downtown-suites/?utm_source=google_ads&utm_medium=cpc&utm_campaign=winter_promo&gclid=789xyz&fbclid=abc123#rates");
                }}
                className="text-tiny font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline"
              >
                Load Messy Ad URL
              </button>
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400 mb-2">
              Normalize campaign URLs, strip tracking tags (`utm_*`, `gclid`, `fbclid`), deduplicate slashes, and generate canonical meta tags:
            </p>

            <input
              type="text"
              value={rawUrlInput}
              onChange={(e) => setRawUrlInput(e.target.value)}
              placeholder="Paste raw URL (e.g. http://hotel.com//rooms/?utm_source=fb)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption font-mono text-slate-800 focus:border-teal-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            {/* Options Checkboxes */}
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-tiny font-medium text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canonicalOpts.forceHttps}
                  onChange={(e) => setCanonicalOpts((o) => ({ ...o, forceHttps: e.target.checked }))}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Force HTTPS</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canonicalOpts.stripTracking}
                  onChange={(e) => setCanonicalOpts((o) => ({ ...o, stripTracking: e.target.checked }))}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Strip UTM / Tracking</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canonicalOpts.trailingSlash}
                  onChange={(e) => setCanonicalOpts((o) => ({ ...o, trailingSlash: e.target.checked }))}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Trailing Slash</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canonicalOpts.stripHash}
                  onChange={(e) => setCanonicalOpts((o) => ({ ...o, stripHash: e.target.checked }))}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Strip Hash (#)</span>
              </label>
            </div>

            {/* Normalized Result Box */}
            <div className="mt-3 rounded-xl border border-teal-200/80 bg-teal-50/50 p-3.5 dark:border-teal-900/60 dark:bg-teal-950/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-micro font-extrabold tracking-wider text-teal-800 uppercase dark:text-teal-300">
                  Clean Canonical URL
                </span>
                <button
                  type="button"
                  onClick={handleCopyCanonical}
                  className="text-tiny font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300"
                >
                  {copiedCanonical ? "Copied URL!" : "Copy URL"}
                </button>
              </div>
              <div className="font-mono text-caption font-bold text-slate-800 dark:text-slate-100 break-all">
                {normalizedResult.url || "Invalid URL"}
              </div>

              {normalizedResult.tag && (
                <div className="mt-2.5 pt-2 border-t border-teal-200/60 dark:border-teal-900/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-micro font-semibold text-slate-500">HTML Canonical Tag:</span>
                    <button
                      type="button"
                      onClick={handleCopyTag}
                      className="text-tiny font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300"
                    >
                      {copiedTag ? "Copied Tag!" : "Copy <link> Tag"}
                    </button>
                  </div>
                  <pre className="rounded-lg bg-white/80 p-2 font-mono text-tiny text-slate-800 dark:bg-slate-900 dark:text-slate-200 overflow-x-auto border border-teal-100 dark:border-teal-950">
                    {normalizedResult.tag}
                  </pre>
                </div>
              )}

              {normalizedResult.removedParams.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-micro">
                  <span className="font-semibold text-teal-800 dark:text-teal-300">Stripped:</span>
                  {normalizedResult.removedParams.map((param, i) => (
                    <span key={i} className="rounded bg-teal-200/60 dark:bg-teal-900/60 px-1.5 py-0.5 font-mono text-teal-900 dark:text-teal-200">
                      -{param}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-tiny text-slate-400">
            <span>RFC 3986 &amp; Google Canonical Guidelines</span>
            <span className="font-semibold text-teal-600 dark:text-teal-400">100% Free &amp; Offline</span>
          </div>
        </div>

        {/* 9. Website Image Optimization Auditor */}
        <div className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60">
                  <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">Image Optimization Audit Tool</span>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-micro font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                Multi-Tab XLSX
              </span>
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400 mb-3">
              Crawl public pages to inspect &lt;img&gt;, &lt;picture&gt;, and CSS background assets. Generates a 5-tab workbook with <code>=IMAGE()</code> &amp; <code>=LEN()</code> formulas, Core Web Vitals checks, and Google Sheets export.
            </p>

            <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3 text-caption text-slate-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between text-tiny">
                <span className="font-semibold text-amber-900 dark:text-amber-300">Audited Target:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{property?.url || "Custom Domain"}</span>
              </div>
              <div className="text-tiny text-slate-500 dark:text-slate-400">
                • Matches reference Google Sheet layout<br/>
                • Detects missing alt, oversized files &gt;100KB, WebP/AVIF candidates, CLS shifts
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenImageAudit}
            className="mt-4 w-full rounded-xl bg-amber-600 py-2 text-caption font-semibold text-white transition hover:bg-amber-700 shadow-sm"
          >
            Launch Website Image Auditor &rarr;
          </button>
        </div>

        {/* Heading Structure Optimization Tool (6-Column Reference Parity) */}
        <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-card transition-all hover:border-emerald-400 dark:border-emerald-900/50 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                  </svg>
                </span>
                <span className="text-body font-bold text-slate-800 dark:text-slate-100">Heading Structure Optimization</span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-micro font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Reference Format
              </span>
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400 mb-3">
              Crawl public pages and sitemaps to inspect rendered H1–H6 tags. Detects missing H1, multiple H1s, skipped levels, and unrendered JS templates with 6-column optimized spreadsheet export.
            </p>

            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3 text-caption text-slate-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between text-tiny">
                <span className="font-semibold text-emerald-900 dark:text-emerald-300">Audited Target:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{property?.url || "No property URL set"}</span>
              </div>
              <div className="text-tiny text-slate-500 dark:text-slate-400">
                • Matches &ldquo;Heading Structure Optimization- example-hotel&rdquo; template<br/>
                • Category banners, yellow table headers, green recommendations
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenHeadingAudit}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-2 text-caption font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
          >
            Launch Heading Structure Auditor &rarr;
          </button>
        </div>

      </div>

      {/* Roadmap Banner */}
      <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4 text-center dark:border-violet-800/60 dark:bg-violet-950/20">
        <p className="text-caption font-semibold text-violet-800 dark:text-violet-300">
          Enterprise SEO Labs Suite
        </p>
        <p className="text-tiny text-slate-500 dark:text-slate-400 mt-0.5">
          Integrated with 10-Gate SEO Quality Engine • Multi-CMS Export Support (HTML5, Shopify Liquid, WordPress PHP, Webflow CSV)
        </p>
      </div>
        </div>
      )}
    </div>
  );
}
