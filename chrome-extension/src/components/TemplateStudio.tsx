import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Star,
  Copy,
  Download,
  Sparkles,
  Check,
  Code,
  ShieldAlert,
  AlertTriangle,
  Database,
} from "lucide-react";
import {
  SEO_STUDIO_TEMPLATES,
  extractTemplateVariables,
  resolveTemplateContent,
} from "../data/seoStudioTemplates";
import { SeoStudioTemplate, PageAuditData, ClientProfile } from "../types/extension";
import { calculatePixelWidth, TITLE_PIXEL_LIMIT, META_DESC_PIXEL_LIMIT } from "../utils/pixelCalculator";
import { isRestrictedUrl } from "../utils/urlSecurity";
import { saveTrainingPair } from "../storage/training-vault";
import { generateGeoSummary } from "../engine/custom-model-client";
import { buildReadyToPasteSnippet, initialLiveFields } from "../engine/studio-export";
import {
  BrandGuardrail,
  BrandRules,
  BRAND_GUARDRAILS,
  validateBrandCompliance,
} from "../utils/brandGuardrails";

export type { BrandGuardrail, BrandRules };
export { BRAND_GUARDRAILS, validateBrandCompliance };

interface Props {
  pageData?: PageAuditData;
  activeProfile?: ClientProfile;
  initialTemplateId?: string;
  activeTabId?: number;
}

export function TemplateStudio({
  pageData,
  activeProfile,
  initialTemplateId,
  activeTabId,
}: Props) {
  // Brand Guardrail State
  const initialBrand: BrandGuardrail = useMemo(() => {
    const raw = (activeProfile?.brand || "").toLowerCase();
    if (raw.includes("marriott")) return "Marriott";
    if (raw.includes("hilton")) return "Hilton";
    if (raw.includes("ihg") || raw.includes("holiday inn")) return "IHG";
    if (raw.includes("hyatt")) return "Hyatt";
    return "Independent";
  }, [activeProfile]);

  const [selectedBrand, setSelectedBrand] = useState<BrandGuardrail>(initialBrand);
  const activeGuardrail = BRAND_GUARDRAILS[selectedBrand];

  // Live Editable Fields State — seeded from the page / client profile only
  // (no invented sample copy; see engine/studio-export.ts).
  const liveFields = useMemo(() => initialLiveFields(pageData, activeProfile), [pageData, activeProfile]);
  const [liveTitle, setLiveTitle] = useState(liveFields.title);
  const [liveMeta, setLiveMeta] = useState(liveFields.meta);
  const [liveH1, setLiveH1] = useState(liveFields.h1);

  // Auto-sync live fields when active page changes
  useEffect(() => {
    if (pageData?.title) {
      setLiveTitle(pageData.title);
    }
    if (pageData?.metaDesc) {
      setLiveMeta(pageData.metaDesc);
    }
    if (pageData?.h1Elements?.[0]) {
      setLiveH1(pageData.h1Elements[0]);
    }
  }, [pageData?.url, pageData?.title, pageData?.metaDesc]);

  // GEO knowledge block starts blank — there is no verified content to
  // summarize until the page or an AI provider supplies some.
  const [liveGeoAnswer, setLiveGeoAnswer] = useState(liveFields.geoAnswer);

  const [showFullCode, setShowFullCode] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [capturedStatus, setCapturedStatus] = useState<string | null>(null);
  const [generatingGeo, setGeneratingGeo] = useState(false);
  const [geoFeedback, setGeoFeedback] = useState<string | null>(null);

  const handleGenerateGeoSummary = async () => {
    const hotelName = liveH1 || activeProfile?.name || "";
    if (!hotelName) {
      // Nothing to summarize — never ask a model to invent a property.
      setGeoFeedback("No property name to summarize");
      setTimeout(() => setGeoFeedback(null), 3000);
      return;
    }
    setGeneratingGeo(true);
    setGeoFeedback(null);
    try {
      const res = await generateGeoSummary({
        hotelName,
        brand: activeGuardrail.name,
        amenities: pageData?.extractedAmenities,
        pageContent: pageData?.metaDesc,
      });
      setLiveGeoAnswer(res.geoSummary);
      setGeoFeedback(
        res.source === "custom_tuned_model"
          ? `Tuned Model Generated (${res.modelIdentifier || "Custom Model"})`
          : "Page Facts Generated (no model connected)"
      );
      setTimeout(() => setGeoFeedback(null), 3000);
    } catch {
      setGeoFeedback("Generation Failed");
      setTimeout(() => setGeoFeedback(null), 3000);
    } finally {
      setGeneratingGeo(false);
    }
  };

  const handleCaptureForAiTraining = async () => {
    // Training pairs are only captured from a real audited page — no
    // placeholder URLs, domains, copy or word counts are ever substituted.
    if (!pageData?.url) {
      setCapturedStatus("Capture Needs a Page");
      setTimeout(() => setCapturedStatus(null), 3000);
      return;
    }
    try {
      const rawInput = {
        url: pageData.url,
        canonicalUrl: pageData?.canonical || pageData.url,
        domain: pageData?.hostname || "",
        rawTitle: pageData?.title || "",
        rawMetaDesc: pageData?.metaDesc || "",
        rawH1: pageData?.h1Elements || [],
        rawH2: pageData?.h2Elements || [],
        rawBodyText: (pageData?.extractedAmenities || []).join(", "),
        detectedSchemas: (pageData?.schemas || []).map((s) => String(s["@type"] || "")),
        wordCount: pageData?.words || 0,
      };

      const targetOutput = {
        optimizedTitle: liveTitle,
        optimizedMetaDesc: liveMeta,
        optimizedH1: liveH1,
        jsonLdSchema: {
          "@context": "https://schema.org",
          "@type": "Hotel",
          name: liveH1,
          description: liveMeta,
        },
        geoEntityBlock: liveGeoAnswer,
        brandGuardrail: activeGuardrail.name,
      };

      const record = await saveTrainingPair({
        rawInput,
        targetOutput,
        brand: activeGuardrail.name,
      });

      setCapturedStatus(`Vault Saved (${record.qualityScore}/100)`);
      setTimeout(() => setCapturedStatus(null), 3000);
    } catch {
      setCapturedStatus("Capture Failed");
      setTimeout(() => setCapturedStatus(null), 3000);
    }
  };

  // Template Library State
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("seo_studio_favorite_templates") || "[]");
    } catch {
      return [];
    }
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplateId || SEO_STUDIO_TEMPLATES[0].id
  );

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId]);

  const selectedTemplate = useMemo<SeoStudioTemplate>(() => {
    return (
      SEO_STUDIO_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      SEO_STUDIO_TEMPLATES[0]
    );
  }, [selectedTemplateId]);

  // Variables state
  const [formVariables, setFormVariables] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Auto-fill variables from active page and activeProfile
  useEffect(() => {
    const vars = extractTemplateVariables(selectedTemplate.content);
    const initial: Record<string, string> = { ...selectedTemplate.defaultVariables };

    vars.forEach((v) => {
      if (v === "hotelName" || v === "brand") {
        if (activeProfile?.name) initial[v] = activeProfile.name;
        else if (pageData?.title) {
          const brandGuess = pageData.title.split("|")[0].split("-")[0].trim();
          initial[v] = brandGuess;
        }
      } else if (v === "cityName" || v === "city") {
        if (activeProfile?.city) initial[v] = activeProfile.city;
      } else if (v === "stateCode" || v === "state") {
        if (activeProfile?.state) initial[v] = activeProfile.state;
      } else if (v === "canonicalUrl" || v === "url") {
        if (pageData?.canonical || pageData?.url) {
          initial[v] = pageData.canonical || pageData.url;
        }
      } else if (v === "originUrl") {
        if (pageData?.origin) initial[v] = pageData.origin;
      } else if (v === "metaDescription") {
        if (liveMeta) initial[v] = liveMeta;
        else if (pageData?.metaDesc) initial[v] = pageData.metaDesc;
      } else if (v === "targetKeyword" && activeProfile?.primaryKeywords?.length) {
        initial[v] = activeProfile.primaryKeywords[0];
      } else if (v === "phoneNumber" && activeProfile?.phone) {
        initial[v] = activeProfile.phone;
      } else if (v === "streetAddress" && activeProfile?.address) {
        initial[v] = activeProfile.address;
      } else if (v === "postalCode" && activeProfile?.postalCode) {
        initial[v] = activeProfile.postalCode;
      } else if (v === "primaryH1") {
        initial[v] = liveH1;
      } else if (v === "parkingPolicy" || v === "parkingRate") {
        if (pageData?.extractedFacts?.parkingFee) {
          initial[v] = v === "parkingRate" ? pageData.extractedFacts.parkingFee : `Valet and self-parking at ${pageData.extractedFacts.parkingFee}.`;
        }
      } else if (v === "petPolicy") {
        if (pageData?.extractedFacts?.petPolicy) initial[v] = pageData.extractedFacts.petPolicy;
      } else if (v === "checkInOutPolicy" || v === "checkInTime" || v === "checkOutTime") {
        const ci = pageData?.extractedFacts?.checkInTime || "4:00 PM";
        const co = pageData?.extractedFacts?.checkOutTime || "11:00 AM";
        if (v === "checkInTime") initial[v] = ci;
        else if (v === "checkOutTime") initial[v] = co;
        else initial[v] = `Check-in starts at ${ci}; check-out is at ${co}.`;
      } else if (v === "totalMeetingSqFt") {
        if (pageData?.extractedFacts?.meetingSqFt) initial[v] = pageData.extractedFacts.meetingSqFt.replace(/[^0-9]/g, "");
      } else if (v === "grandBallroomSqFt") {
        if (pageData?.extractedFacts?.ballroomSqFt) initial[v] = pageData.extractedFacts.ballroomSqFt.replace(/[^0-9]/g, "");
      } else if (v === "roomTitle") {
        if (pageData?.extractedFacts?.roomTypes?.[0]) initial[v] = pageData.extractedFacts.roomTypes[0];
      } else if (v === "kingSuiteSqFt") {
        initial[v] = "650";
      } else if (v === "airportCode" || v === "airportName" || v === "airportMiles" || v === "distanceToAirport") {
        const code = pageData?.extractedFacts?.airportCode || "AIR";
        const dist = pageData?.extractedFacts?.airportDistance || "8.5 miles";
        if (v === "airportCode") initial[v] = code;
        else if (v === "airportName") initial[v] = `${code} International Airport`;
        else if (v === "airportMiles") initial[v] = dist.replace(/[^0-9.]/g, "");
        else initial[v] = dist;
      } else if (v === "distanceToLandmark" && pageData?.extractedFacts?.landmarkDistance) {
        initial[v] = pageData.extractedFacts.landmarkDistance;
      } else if (v === "amenitiesList" && pageData?.extractedAmenities?.length) {
        initial[v] = pageData.extractedAmenities.join(", ");
      } else if (v === "destinationOverview" && pageData?.metaDesc) {
        initial[v] = pageData.metaDesc;
      }
    });

    setFormVariables(initial);
  }, [selectedTemplate, pageData, activeProfile, liveH1, liveMeta]);

  // Live Pixel Width Calculations
  const titlePx = useMemo(() => calculatePixelWidth(liveTitle), [liveTitle]);
  const descPx = useMemo(() => calculatePixelWidth(liveMeta), [liveMeta]);

  const titlePercent = Math.min(Math.round((titlePx / TITLE_PIXEL_LIMIT) * 100), 100);
  const descPercent = Math.min(Math.round((descPx / META_DESC_PIXEL_LIMIT) * 100), 100);

  const isTitleOverBudget = titlePx > TITLE_PIXEL_LIMIT || liveTitle.length > activeGuardrail.maxTitleChars;
  const isDescOverBudget = descPx > META_DESC_PIXEL_LIMIT || liveMeta.length > activeGuardrail.maxMetaChars;

  // Real-Time Forbidden Terms Scanner
  const forbiddenTermAlerts = useMemo(() => {
    const combined = `${liveTitle} ${liveMeta} ${liveH1} ${liveGeoAnswer}`.toLowerCase();
    const alerts: { term: string; reason: string; replacement: string; field: string }[] = [];

    activeGuardrail.forbiddenTerms.forEach((ft) => {
      if (combined.includes(ft.term.toLowerCase())) {
        let field = "Content";
        if (liveTitle.toLowerCase().includes(ft.term.toLowerCase())) field = "Title";
        else if (liveMeta.toLowerCase().includes(ft.term.toLowerCase())) field = "Meta Description";
        else if (liveH1.toLowerCase().includes(ft.term.toLowerCase())) field = "H1 Headline";
        else if (liveGeoAnswer.toLowerCase().includes(ft.term.toLowerCase())) field = "GEO Answer Block";

        alerts.push({ ...ft, field });
      }
    });

    return alerts;
  }, [liveTitle, liveMeta, liveH1, liveGeoAnswer, activeGuardrail]);

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("seo_studio_favorite_templates", JSON.stringify(next));
  };

  const categories = [
    "All",
    "Landing Pages",
    "Schemas",
    "Meta & Headings",
    "AI Prompts",
    "Audits & Checklists",
    "CMS Exporters",
  ];

  const filteredTemplates = useMemo(() => {
    return SEO_STUDIO_TEMPLATES.filter((t) => {
      const matchCat = selectedCategory === "All" || t.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const resolvedOutput = useMemo(() => {
    return resolveTemplateContent(selectedTemplate.content, formVariables);
  }, [selectedTemplate, formVariables]);

  // Production-Ready Bundled Export Code (HTML + JSON-LD)
  const readyToPasteSnippet = useMemo(
    () =>
      buildReadyToPasteSnippet({
        pageData,
        activeProfile,
        liveTitle,
        liveMeta,
        liveH1,
        liveGeoAnswer,
        activeGuardrail,
      }),
    [liveTitle, liveMeta, liveH1, liveGeoAnswer, activeGuardrail, pageData, activeProfile]
  );


  const handleCopyExport = () => {
    navigator.clipboard.writeText(readyToPasteSnippet).then(() => {
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
      handleCaptureForAiTraining();
    });
  };

  const handleDownloadExport = () => {
    const blob = new Blob([readyToPasteSnippet], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(activeProfile?.name || "hotel").replace(/\s+/g, "_")}_SEO_GEO_Bundle.html`;
    a.click();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resolvedOutput).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const ext = selectedTemplate.format === "json" ? "json" : selectedTemplate.format === "markdown" ? "md" : "html";
    const blob = new Blob([resolvedOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.id}.${ext}`;
    a.click();
  };

  const handleInjectOnPage = () => {
    if (!activeTabId || typeof chrome === "undefined" || !chrome.tabs) {
      setActionFeedback("Target tab not connected.");
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }

    if (isRestrictedUrl(pageData?.url)) {
      setActionFeedback("DOM injection is disabled on browser system pages.");
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    const payload: { title?: string; metaDesc?: string; h1?: string; schemaJson?: string } = {
      title: liveTitle,
      metaDesc: liveMeta,
      h1: liveH1,
    };
    if (selectedTemplate.format === "json") {
      payload.schemaJson = resolvedOutput;
    }

    chrome.tabs.sendMessage(activeTabId, { type: "INJECT_PREVIEW", payload }, (res) => {
      if (chrome.runtime.lastError) {
        setActionFeedback("Please refresh target webpage to enable DOM preview.");
        setTimeout(() => setActionFeedback(null), 3000);
        return;
      }
      if (res && res.injected && res.injected.length > 0) {
        setActionFeedback(`Injected ${res.injected.join(", ")} on active page!`);
      } else {
        setActionFeedback("Preview injected into live page DOM.");
      }
      setTimeout(() => setActionFeedback(null), 3000);
    });
  };

  const [cmsUndoAvailable, setCmsUndoAvailable] = useState(false);

  const handleFillActiveCmsField = (fieldType: "active" | "title" | "meta" | "schema" | "all" = "active") => {
    if (!activeTabId || typeof chrome === "undefined" || !chrome.tabs) {
      setActionFeedback("Target tab not connected.");
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }

    if (isRestrictedUrl(pageData?.url)) {
      setActionFeedback("CMS injection is disabled on browser system pages.");
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    if (fieldType === "all") {
      handleAutoFillCms();
      return;
    }

    const payload: { text?: string; fieldType: "active" | "title" | "meta" | "schema" } = {
      fieldType,
    };

    if (fieldType === "schema") {
      payload.text = selectedTemplate.format === "json" ? resolvedOutput : readyToPasteSnippet;
    } else if (fieldType === "title") {
      payload.text = liveTitle;
    } else if (fieldType === "meta") {
      payload.text = liveMeta;
    } else {
      payload.text = liveTitle;
    }

    chrome.tabs.sendMessage(activeTabId, { type: "FILL_ACTIVE_CMS_FIELD", payload }, (res) => {
      if (chrome.runtime.lastError) {
        setActionFeedback("Please refresh target webpage to enable CMS field injection.");
        setTimeout(() => setActionFeedback(null), 3000);
        return;
      }
      if (res && res.result && res.result.success) {
        setActionFeedback(res.result.message || `Filled: ${res.result.filledFields.join(", ")}`);
        setCmsUndoAvailable(true);
      } else {
        setActionFeedback(res?.result?.message || "Could not find active input to fill.");
      }
      setTimeout(() => setActionFeedback(null), 3500);
    });
  };

  const handleUndoCmsFill = () => {
    if (!activeTabId || typeof chrome === "undefined" || !chrome.tabs) return;
    chrome.tabs.sendMessage(activeTabId, { type: "UNDO_CMS_FILL" }, (res) => {
      if (res && res.result && res.result.success) {
        setActionFeedback(res.result.message);
        setCmsUndoAvailable(false);
      } else {
        setActionFeedback(res?.result?.message || "Nothing to revert.");
      }
      setTimeout(() => setActionFeedback(null), 3000);
    });
  };

  const handleAutoFillCms = () => {
    if (!activeTabId || typeof chrome === "undefined" || !chrome.tabs) {
      setActionFeedback("Target tab not connected.");
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }

    if (isRestrictedUrl(pageData?.url)) {
      setActionFeedback("CMS auto-fill is disabled on browser system pages.");
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    const payload = {
      title: liveTitle,
      metaDesc: liveMeta,
    };

    chrome.tabs.sendMessage(activeTabId, { type: "AUTO_FILL_CMS", payload }, (res) => {
      if (chrome.runtime.lastError) {
        setActionFeedback("Please refresh target webpage to enable CMS auto-fill.");
        setTimeout(() => setActionFeedback(null), 3000);
        return;
      }
      if (res && res.result && res.result.filledFields.length > 0) {
        setActionFeedback(`Auto-filled ${res.result.detectedCms}: ${res.result.filledFields.join(", ")}`);
      } else {
        setActionFeedback("No compatible CMS input fields detected on page.");
      }
      setTimeout(() => setActionFeedback(null), 3500);
    });
  };

  // Launch pre-encoded prompt in AI engines
  const launchAi = (engine: "chatgpt" | "claude" | "gemini" | "perplexity") => {
    const promptText = encodeURIComponent(
      `Optimize this hotel content for Google SERPs and Generative Search Engines:\n\nBrand Framework: ${activeGuardrail.name} (${activeGuardrail.loyaltyProgram})\nTitle: ${liveTitle}\nMeta Description: ${liveMeta}\nH1: ${liveH1}\nGEO Answer Block: ${liveGeoAnswer}`
    );
    let targetUrl = "";
    if (engine === "chatgpt") targetUrl = `https://chatgpt.com/?q=${promptText}`;
    else if (engine === "claude") targetUrl = `https://claude.ai/new?q=${promptText}`;
    else if (engine === "gemini") targetUrl = `https://gemini.google.com/app?q=${promptText}`;
    else if (engine === "perplexity") targetUrl = `https://www.perplexity.ai/search?q=${promptText}`;

    window.open(targetUrl, "_blank");
  };

  const extractedVariables = useMemo(() => {
    return extractTemplateVariables(selectedTemplate.content);
  }, [selectedTemplate]);

  const brands: BrandGuardrail[] = ["Marriott", "Hilton", "IHG", "Hyatt", "Independent"];

  return (
    <div className="space-y-4">
      {/* 1. BRAND GUARDRAIL SELECTOR */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              BRAND GUARDRAIL COMPLIANCE FRAMEWORK
            </span>
          </div>
          <span
            className="rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-xs"
            style={{ backgroundColor: activeGuardrail.brandPillColor }}
          >
            {activeGuardrail.loyaltyProgram}
          </span>
        </div>

        {/* Brand Framework Selector Pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {brands.map((b) => {
            const isSelected = selectedBrand === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedBrand(b)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                  isSelected
                    ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {b}
              </button>
            );
          })}
        </div>

        {/* Guardrail Limits Strip */}
        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
          <span>
            Title Limit: <strong className="text-slate-700 dark:text-slate-200">{activeGuardrail.maxTitleChars} chars / 580px</strong>
          </span>
          <span>•</span>
          <span>
            Meta Limit: <strong className="text-slate-700 dark:text-slate-200">{activeGuardrail.maxMetaChars} chars / 920px</strong>
          </span>
          <span>•</span>
          <span>
            H1 Limit: <strong className="text-slate-700 dark:text-slate-200">{activeGuardrail.maxH1Chars} chars</strong>
          </span>
        </div>

        {/* Forbidden Terms Real-Time Alert Banner */}
        {forbiddenTermAlerts.length > 0 && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900/50 dark:bg-rose-950/40 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                {forbiddenTermAlerts.length} Brand Compliance Warning{forbiddenTermAlerts.length > 1 ? "s" : ""} Detected ({selectedBrand})
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {forbiddenTermAlerts.map((a, idx) => (
                <div key={idx} className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
                  <strong>[{a.field}]</strong> Restricted term <code className="rounded bg-rose-200/60 px-1 py-0.5 font-bold text-rose-900 dark:bg-rose-900/60 dark:text-rose-100">&quot;{a.term}&quot;</code>: {a.reason} Replace with: <span className="font-bold underline text-emerald-700 dark:text-emerald-400">&quot;{a.replacement}&quot;</span>.
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. LIVE EDITABLE INPUTS & REAL-TIME PIXEL BARS */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            LIVE METADATA &amp; GEO CONTENT EDITOR
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            Real-Time SERP Width Engine
          </span>
        </div>

        {/* Title Tag Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Title Tag
            </label>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`tabular-nums ${isTitleOverBudget ? "font-semibold text-rose-400" : "text-[#A1A1AA]"}`}>
                {liveTitle.length}/{activeGuardrail.maxTitleChars} chars • {titlePx}px / {TITLE_PIXEL_LIMIT}px
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                  isTitleOverBudget
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {titlePx > TITLE_PIXEL_LIMIT ? "OVER BUDGET" : "OPTIMAL"}
              </span>
            </div>
          </div>

          <input
            type="text"
            value={liveTitle}
            onChange={(e) => setLiveTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Enter brand-compliant SEO Title..."
          />

          {/* Title Pixel Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                titlePx > TITLE_PIXEL_LIMIT
                  ? "bg-rose-500"
                  : titlePx > 520 || liveTitle.length < 45
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${titlePercent}%` }}
            />
          </div>
        </div>

        {/* Meta Description Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Meta Description
            </label>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`tabular-nums ${isDescOverBudget ? "font-semibold text-rose-400" : "text-[#A1A1AA]"}`}>
                {liveMeta.length}/{activeGuardrail.maxMetaChars} chars • {descPx}px / {META_DESC_PIXEL_LIMIT}px
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                  isDescOverBudget
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {descPx > META_DESC_PIXEL_LIMIT ? "OVER BUDGET" : "OPTIMAL"}
              </span>
            </div>
          </div>

          <textarea
            rows={2}
            value={liveMeta}
            onChange={(e) => setLiveMeta(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Enter brand-compliant Meta Description..."
          />

          {/* Meta Description Pixel Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                descPx > META_DESC_PIXEL_LIMIT || liveMeta.length > activeGuardrail.maxMetaChars
                  ? "bg-rose-500"
                  : liveMeta.length < 120
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${descPercent}%` }}
            />
          </div>
        </div>

        {/* H1 Heading Input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Primary H1 Heading Tag
            </label>
            <span className="text-[10px] text-[#A1A1AA] tabular-nums">
              {liveH1.length}/{activeGuardrail.maxH1Chars} chars
            </span>
          </div>
          <input
            type="text"
            value={liveH1}
            onChange={(e) => setLiveH1(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Primary H1 property headline..."
          />
        </div>

        {/* GEO Entity Answer Block Input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              GEO Entity Answer Block (Gemini &amp; ChatGPT Knowledge Target)
            </label>
            <div className="flex items-center gap-2">
              {geoFeedback && (
                <span className="text-[10px] font-semibold text-emerald-400">
                  {geoFeedback}
                </span>
              )}
              <button
                type="button"
                onClick={handleGenerateGeoSummary}
                disabled={generatingGeo}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-600 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-slate-700 transition"
              >
                <Sparkles className={`h-3 w-3 ${generatingGeo ? "animate-spin" : ""}`} />
                <span>{generatingGeo ? "Generating..." : "Generate GEO Summary"}</span>
              </button>
              <span className="text-[10px] text-slate-400">
                {liveGeoAnswer.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          </div>
          <textarea
            rows={3}
            value={liveGeoAnswer}
            onChange={(e) => setLiveGeoAnswer(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 leading-relaxed"
            placeholder="High-density entity description answering spatial, amenities, parking, and dining questions for LLM retrieval engines..."
          />
        </div>
      </div>

      {/* 3. 1-CLICK EXPORT & ACTION TOOLBAR */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1-CLICK PRODUCTION DEPLOYMENT
            </span>
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Ready-to-Paste HTML + JSON-LD Bundle
            </h4>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleCopyExport}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
            >
              {copiedExport ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedExport ? "Copied!" : "Copy Bundle"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExport}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export HTML</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFullCode(!showFullCode)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Code className="h-3.5 w-3.5 text-slate-500" />
              <span>{showFullCode ? "Hide Code" : "View Code"}</span>
            </button>

            <button
              type="button"
              onClick={handleInjectOnPage}
              title="Preview changes live in current browser tab"
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              <span>Inject DOM</span>
            </button>

            <button
              type="button"
              onClick={() => handleFillActiveCmsField("active")}
              title="Safely inject into the active/focused CMS input or textarea in browser tab"
              className="inline-flex items-center gap-1 rounded-xl border border-sky-400 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-400 shadow-xs transition hover:bg-sky-500/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>Fill Active CMS Field</span>
            </button>

            <button
              type="button"
              onClick={handleAutoFillCms}
              title="Auto-fill WordPress, Webflow, or Shopify SEO fields"
              className="inline-flex items-center gap-1 rounded-xl border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-800 shadow-xs transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
            >
              <span>Auto-Fill All</span>
            </button>

            {selectedTemplate.format === "json" && (
              <button
                type="button"
                onClick={() => handleFillActiveCmsField("schema")}
                title="Inject this JSON-LD schema into active page head"
                className="inline-flex items-center gap-1 rounded-xl border border-purple-400 bg-purple-500/10 px-2.5 py-1.5 text-xs font-bold text-purple-400 shadow-xs transition hover:bg-purple-500/20"
              >
                <span>Inject Schema</span>
              </button>
            )}

            {cmsUndoAvailable && (
              <button
                type="button"
                onClick={handleUndoCmsFill}
                title="Revert recent CMS field modifications"
                className="inline-flex items-center gap-1 rounded-xl border border-amber-400 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-400 shadow-xs transition hover:bg-amber-500/20 animate-pulse"
              >
                <span>Undo Fill</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCaptureForAiTraining}
              title="Save paired raw and optimized dataset sample to local IndexedDB training vault"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-bold text-indigo-400 shadow-xs transition hover:bg-indigo-500/20"
            >
              <Database className="h-3.5 w-3.5 text-indigo-400" />
              <span>{capturedStatus ? capturedStatus : "Capture for AI Training"}</span>
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div className="mt-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300 animate-in fade-in">
            {actionFeedback}
          </div>
        )}

        {/* Live Code Preview Box */}
        {showFullCode && (
          <div className="mt-3">
            <div className="flex items-center justify-between rounded-t-xl bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1.5 uppercase">
                <Code className="h-3 w-3 text-emerald-400" />
                Ready-to-Paste HTML + JSON-LD Snippet
              </span>
              <span>{readyToPasteSnippet.split("\n").length} lines</span>
            </div>
            <pre className="max-h-72 overflow-x-auto overflow-y-auto rounded-b-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-400 shadow-inner select-all whitespace-pre-wrap">
              {readyToPasteSnippet}
            </pre>
          </div>
        )}

        {/* AI Quick-Launch Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Launch prompt in AI:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => launchAi("chatgpt")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              ChatGPT
            </button>
            <button
              type="button"
              onClick={() => launchAi("claude")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              Claude
            </button>
            <button
              type="button"
              onClick={() => launchAi("gemini")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              Gemini
            </button>
            <button
              type="button"
              onClick={() => launchAi("perplexity")}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              Perplexity
            </button>
          </div>
        </div>
      </div>

      {/* 4. HOSPITALITY TEMPLATE LIBRARY & SMART FORM BUILDER */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            HOSPITALITY TEMPLATE LIBRARY ({filteredTemplates.length})
          </span>
          <div className="relative w-40">
            <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="h-7 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-[10px] text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-xs dark:bg-emerald-500 dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template Selector Horizontal Strip */}
        <div className="flex gap-2 overflow-x-auto pb-1.5">
          {filteredTemplates.map((t) => {
            const isSelected = t.id === selectedTemplate.id;
            const isFav = favorites.includes(t.id);

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className={`min-w-[190px] max-w-[210px] shrink-0 cursor-pointer rounded-xl border p-2.5 transition shadow-xs ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/40"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {t.category}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(t.id);
                    }}
                    className="text-slate-400 hover:text-amber-500"
                  >
                    <Star className={`h-3.5 w-3.5 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} />
                  </button>
                </div>
                <h4 className="mt-1 line-clamp-1 text-xs font-bold text-slate-900 dark:text-white">
                  {t.title}
                </h4>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {t.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Smart Form Builder for Selected Template */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 dark:border-slate-700/60">
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                TEMPLATE VARIABLES ({extractedVariables.length})
              </span>
              <h5 className="font-display text-xs font-bold text-slate-900 dark:text-white">
                {selectedTemplate.title}
              </h5>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-3 w-3" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto p-0.5">
            {extractedVariables.map((variable) => (
              <div key={variable} className="space-y-0.5">
                <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {`{{${variable}}}`}
                </label>
                <input
                  type="text"
                  value={formVariables[variable] || ""}
                  onChange={(e) =>
                    setFormVariables((prev) => ({
                      ...prev,
                      [variable]: e.target.value,
                    }))
                  }
                  className="h-7 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
