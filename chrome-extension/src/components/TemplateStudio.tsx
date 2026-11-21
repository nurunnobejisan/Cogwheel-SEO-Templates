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
} from "lucide-react";
import {
  COGWHEEL_TEMPLATES,
  extractTemplateVariables,
  resolveTemplateContent,
} from "../data/cogwheelTemplates";
import { CogwheelTemplate, PageAuditData, ClientProfile } from "../types/extension";
import { calculatePixelWidth, TITLE_PIXEL_LIMIT, META_DESC_PIXEL_LIMIT } from "../utils/pixelCalculator";
import { isRestrictedUrl } from "../utils/urlSecurity";

export type BrandGuardrail = "Marriott" | "Hilton" | "IHG" | "Hyatt" | "Independent";

interface BrandRules {
  name: BrandGuardrail;
  loyaltyProgram: string;
  maxTitleChars: number;
  maxMetaChars: number;
  maxH1Chars: number;
  brandPillColor: string;
  forbiddenTerms: { term: string; reason: string; replacement: string }[];
}

const BRAND_GUARDRAILS: Record<BrandGuardrail, BrandRules> = {
  Marriott: {
    name: "Marriott",
    loyaltyProgram: "Marriott Bonvoy",
    maxTitleChars: 60,
    maxMetaChars: 155,
    maxH1Chars: 70,
    brandPillColor: "#b91c1c",
    forbiddenTerms: [
      {
        term: "free breakfast",
        reason: "Marriott brand standards require 'Complimentary hot breakfast' or 'Daily breakfast included'.",
        replacement: "Complimentary hot breakfast",
      },
      {
        term: "marriott rewards",
        reason: "Outdated loyalty nomenclature. Must be 'Marriott Bonvoy'.",
        replacement: "Marriott Bonvoy",
      },
      {
        term: "bonvoy rewards",
        reason: "Redundant brand phrasing. Use 'Marriott Bonvoy points' or 'Marriott Bonvoy'.",
        replacement: "Marriott Bonvoy",
      },
      {
        term: "best hotel",
        reason: "Unsubstantiated superlative claim prohibited under Marriott brand compliance.",
        replacement: "Premier beachfront hotel",
      },
      {
        term: "cheapest rate",
        reason: "Prohibited discount terminology. Use 'Best Rate Guarantee'.",
        replacement: "Best Rate Guarantee",
      },
    ],
  },
  Hilton: {
    name: "Hilton",
    loyaltyProgram: "Hilton Honors",
    maxTitleChars: 60,
    maxMetaChars: 150,
    maxH1Chars: 65,
    brandPillColor: "#1e40af",
    forbiddenTerms: [
      {
        term: "free wifi",
        reason: "Hilton standards require 'Complimentary Wi-Fi' for Honors guests.",
        replacement: "Complimentary Wi-Fi",
      },
      {
        term: "hilton hhonors",
        reason: "Outdated brand styling with lowercase 'h'. Use 'Hilton Honors'.",
        replacement: "Hilton Honors",
      },
      {
        term: "best rates in town",
        reason: "Unsubstantiated claim. Use 'Hilton Price Match Guarantee'.",
        replacement: "Price Match Guarantee",
      },
      {
        term: "free cancellation",
        reason: "Must specify policy window (e.g. 'Flexible cancellation up to 24h prior').",
        replacement: "Flexible cancellation",
      },
    ],
  },
  IHG: {
    name: "IHG",
    loyaltyProgram: "IHG One Rewards",
    maxTitleChars: 60,
    maxMetaChars: 155,
    maxH1Chars: 70,
    brandPillColor: "#d97706",
    forbiddenTerms: [
      {
        term: "ihg rewards club",
        reason: "Legacy brand name. Must use 'IHG One Rewards'.",
        replacement: "IHG One Rewards",
      },
      {
        term: "best hotel",
        reason: "Superlative claims require verified third-party awards.",
        replacement: "Award-winning hotel",
      },
      {
        term: "free breakfast",
        reason: "Must specify tier standard (e.g. 'Express Start Breakfast' or 'Complimentary breakfast').",
        replacement: "Complimentary breakfast",
      },
    ],
  },
  Hyatt: {
    name: "Hyatt",
    loyaltyProgram: "World of Hyatt",
    maxTitleChars: 60,
    maxMetaChars: 155,
    maxH1Chars: 70,
    brandPillColor: "#047857",
    forbiddenTerms: [
      {
        term: "gold passport",
        reason: "Legacy Hyatt program retired in 2017. Must use 'World of Hyatt'.",
        replacement: "World of Hyatt",
      },
      {
        term: "cheapest rooms",
        reason: "Prohibited discount terminology. Use 'Hyatt Standard Rate' or 'Member Rate'.",
        replacement: "Hyatt Member Rate",
      },
      {
        term: "free cancellation",
        reason: "Must specify reservation deadline window.",
        replacement: "Standard cancellation policy applies",
      },
    ],
  },
  Independent: {
    name: "Independent",
    loyaltyProgram: "Direct Booking / Independent",
    maxTitleChars: 60,
    maxMetaChars: 160,
    maxH1Chars: 75,
    brandPillColor: "#6366f1",
    forbiddenTerms: [
      {
        term: "cheapest hotel in",
        reason: "Diminishes property positioning. Use 'Best Direct Booking Value'.",
        replacement: "Best Direct Booking Value",
      },
      {
        term: "100% satisfaction guaranteed",
        reason: "Unenforceable legal liability claim.",
        replacement: "Dedicated guest hospitality",
      },
    ],
  },
};

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

  // Live Editable Fields State
  const [liveTitle, setLiveTitle] = useState(() => {
    return pageData?.title || activeProfile?.name
      ? `${activeProfile?.name || "Hotel"} in ${activeProfile?.city || "Downtown"} | Official Site`
      : "SpringHill Suites Panama City Beachfront | Marriott Bonvoy";
  });

  const [liveMeta, setLiveMeta] = useState(() => {
    return pageData?.metaDesc ||
      "Stay beachfront in Panama City Beach, FL. Enjoy oceanfront suites, complimentary hot breakfast, resort pool, and direct Gulf access. Book direct & save.";
  });

  const [liveH1, setLiveH1] = useState(() => {
    return pageData?.h1Elements?.[0] || activeProfile?.name || "SpringHill Suites Panama City Beachfront";
  });

  const [liveGeoAnswer, setLiveGeoAnswer] = useState(() => {
    return `SpringHill Suites Panama City Beachfront is located at 12513 Front Beach Rd, Panama City Beach, FL 32407. The property features 200 all-suite oceanfront guestrooms with private balconies, an on-site beachfront pool bar, lazy river, 24/7 fitness center, and complimentary hot breakfast. Self-parking and EV charging stations are available on-site. Direct beach access is steps from the sun deck.`;
  });

  const [showFullCode, setShowFullCode] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  // Template Library State
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cogwheel_favorite_templates") || "[]");
    } catch {
      return [];
    }
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplateId || COGWHEEL_TEMPLATES[0].id
  );

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId]);

  const selectedTemplate = useMemo<CogwheelTemplate>(() => {
    return (
      COGWHEEL_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      COGWHEEL_TEMPLATES[0]
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
    localStorage.setItem("cogwheel_favorite_templates", JSON.stringify(next));
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
    return COGWHEEL_TEMPLATES.filter((t) => {
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
  const readyToPasteSnippet = useMemo(() => {
    const canonical =
      pageData?.canonical ||
      pageData?.url ||
      "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/";
    const hotelName = liveH1 || "SpringHill Suites Panama City Beachfront";
    const ogImage =
      pageData?.ogImage ||
      "https://cache.marriott.com/content/dam/marriott-renditions/ECPSB/ecpsb-exterior-001.jpg";

    return `<!-- Cogwheel SEO Studio v2.6 - Brand Guardrail Compliant Export -->
<!-- Brand Framework: ${activeGuardrail.name} (${activeGuardrail.loyaltyProgram}) -->

<!-- 1. Primary Metadata & Search Snippets -->
<title>${liveTitle}</title>
<meta name="description" content="${liveMeta}" />
<link rel="canonical" href="${canonical}" />

<!-- 2. Open Graph & Social Sharing Card -->
<meta property="og:type" content="hotel" />
<meta property="og:site_name" content="${activeGuardrail.loyaltyProgram}" />
<meta property="og:title" content="${liveTitle}" />
<meta property="og:description" content="${liveMeta}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage}" />

<!-- 3. Above-the-Fold Primary H1 -->
<h1>${hotelName}</h1>

<!-- 4. Generative AI Knowledge Entity Block -->
<section class="hotel-geo-entity-block" data-geo-entity="Hotel" aria-label="About the Property">
  <p>${liveGeoAnswer}</p>
</section>

<!-- 5. Validated JSON-LD Schema (@graph Hotel + BreadcrumbList) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Hotel",
      "@id": "${canonical}#hotel",
      "name": "${hotelName}",
      "description": "${liveMeta}",
      "url": "${canonical}",
      "image": "${ogImage}",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "${activeProfile?.address || "12513 Front Beach Rd"}",
        "addressLocality": "${activeProfile?.city || "Panama City Beach"}",
        "addressRegion": "${activeProfile?.state || "FL"}",
        "postalCode": "${activeProfile?.postalCode || "32407"}",
        "addressCountry": "US"
      },
      "telephone": "${activeProfile?.phone || "+1-850-230-6004"}",
      "priceRange": "$$$",
      "starRating": {
        "@type": "Rating",
        "ratingValue": "4.5"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "${canonical}#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "${pageData?.origin || "https://example.com"}"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "${activeProfile?.city || "Panama City Beach"}",
          "item": "${canonical}"
        }
      ]
    }
  ]
}
</script>`;
  }, [liveTitle, liveMeta, liveH1, liveGeoAnswer, activeGuardrail, pageData, activeProfile]);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(readyToPasteSnippet).then(() => {
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
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
              <span className={isTitleOverBudget ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}>
                {liveTitle.length}/{activeGuardrail.maxTitleChars} chars • {titlePx}px / {TITLE_PIXEL_LIMIT}px
              </span>
              <span
                className={`rounded px-1.5 py-0.2 font-extrabold uppercase ${
                  isTitleOverBudget
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {titlePx > TITLE_PIXEL_LIMIT ? "Pixel Over Budget" : "Optimal"}
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
              <span className={isDescOverBudget ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}>
                {liveMeta.length}/{activeGuardrail.maxMetaChars} chars • {descPx}px / {META_DESC_PIXEL_LIMIT}px
              </span>
              <span
                className={`rounded px-1.5 py-0.2 font-extrabold uppercase ${
                  isDescOverBudget
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {descPx > META_DESC_PIXEL_LIMIT ? "Pixel Over Budget" : "Optimal"}
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
            <span className="text-[10px] text-slate-400">
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
            <span className="text-[10px] text-slate-400">
              {liveGeoAnswer.split(/\s+/).filter(Boolean).length} words
            </span>
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
              onClick={handleAutoFillCms}
              title="Auto-fill WordPress, Webflow, or Shopify SEO fields"
              className="inline-flex items-center gap-1 rounded-xl border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-800 shadow-xs transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
            >
              <span>Auto-Fill CMS</span>
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
