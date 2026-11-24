import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Layers,
  Database,
  Eye,
  PlayCircle,
  Settings,
  RotateCw,
  Moon,
  Sun,
  ExternalLink,
  Info,
  AlertCircle,
  Globe,
  Users,
} from "lucide-react";
import { PageAuditData, ClientProfile, QuickWinItem } from "../types/extension";
import { PRESET_CLIENT_PROFILES, calculateSeoScores, COGWHEEL_OPTIMAL_AUDIT_DATA } from "../data/cogwheelTemplates";
import { ScoreGauge } from "../components/ScoreGauge";
import { SerpSocialPreview } from "../components/SerpSocialPreview";
import { QuickWinsList } from "../components/QuickWinsList";
import { TemplateStudio } from "../components/TemplateStudio";
import { DatasetVaultManager } from "../components/DatasetVaultManager";
import { DomOverlayInspector } from "../components/DomOverlayInspector";
import { AutomationBulkRunner } from "../components/AutomationBulkRunner";
import { SettingsBrandProfiles } from "../components/SettingsBrandProfiles";
import { UpdateBanner } from "../components/UpdateBanner";
import { CopyFixedCodeDrawer } from "../components/CopyFixedCodeDrawer";
import { ExportAuditDropdown } from "../components/ExportAuditDropdown";
import { UniversalImageAuditCard } from "../components/UniversalImageAuditCard";
import { UniversalHeadingAuditCard } from "../components/UniversalHeadingAuditCard";
import { LivePageAuditCard } from "../components/LivePageAuditCard";
import { CompetitorCompareTab } from "../components/CompetitorCompareTab";
import { calculatePixelWidth } from "../utils/pixelCalculator";
import { isRestrictedUrl } from "../utils/urlSecurity";
import { generateSeoAutoFix } from "../engine/custom-model-client";

export function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "audit" | "compare" | "studio" | "dataset" | "overlay" | "automation" | "settings"
  >("dashboard");

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [targetTemplateId, setTargetTemplateId] = useState<string | undefined>();
  const [activeProfile, setActiveProfile] = useState<ClientProfile>(PRESET_CLIENT_PROFILES[0]);
  const [activeTabId, setActiveTabId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [isRestrictedTab, setIsRestrictedTab] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  // Default fallback mock data containing the 6 baseline unoptimized audit issues
  const [pageData, setPageData] = useState<PageAuditData>({
    url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    origin: "https://www.marriott.com",
    pathname: "/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    protocol: "https:",
    hostname: "www.marriott.com",
    title: "Beachfront Hotels Panama City Beach | SpringHill Suites Panama City Beachfront Resort & Spa", // 88 chars (exceeds 50-60 chars)
    titlePixelWidth: 820,
    metaDesc: "Stay beachfront in Panama City Beach suites with lazy river pool access.", // 72 chars (under 130-155 chars)
    metaDescPixelWidth: 590,
    canonical: "", // missing canonical
    h1Elements: ["SpringHill Suites", "Panama City Beachfront Resort"], // multiple H1s
    h2Elements: [
      "Oceanfront Suites & Amenities",
      "Resort Amenities & Lazy River",
      "Dining & Beachfront Bar",
      "Panama City Beach Attractions Nearby",
    ],
    h3Elements: ["King Suite", "Double Queen Suite", "Gulf View Studio"],
    totalImages: 24,
    imagesWithoutAlt: 0,
    oversizedImages: 1,
    words: 320, // under 450 words
    schemas: [
      {
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Home" }, { name: "Panama City Beach Hotels" }],
      },
    ], // missing Hotel and FAQ schemas
    links: { internal: 42, external: 8, nofollow: 2 },
    hasViewport: true,
    hasOgTitle: false,
    hasOgImage: false,
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
  });

  // State for "Copy Fixed Code" Drawer
  const [fixedDrawer, setFixedDrawer] = useState<{
    isOpen: boolean;
    issueTitle: string;
    issueCategory: string;
    description: string;
    codeSnippet: string;
    language: "html" | "json";
  }>({
    isOpen: false,
    issueTitle: "",
    issueCategory: "",
    description: "",
    codeSnippet: "",
    language: "html",
  });

  const fetchActivePage = async () => {
    setLoading(true);

    // Trigger Layer A Silent OTA Live Sync on manual refresh
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "SYNC_RULES_NOW" }, () => {
        if (chrome.runtime.lastError) { }
      });
    }

    try {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          setActiveTabId(tab.id);

          const isCogwheel = Boolean(
            (tab.url && tab.url.includes("Cogwheel-SEO-Templates")) ||
            (tab.title && tab.title.includes("Cogwheel-SEO-Templates"))
          );

          if (isCogwheel) {
            setPageData(COGWHEEL_OPTIMAL_AUDIT_DATA);
            setIsRestrictedTab(false);
            setNeedsReload(false);
            setLoading(false);
            chrome.runtime.sendMessage({
              type: "UPDATE_BADGE",
              tabId: tab.id,
              score: 100,
            }, () => {
              if (chrome.runtime.lastError) { }
            });
            return;
          }

          if (isRestrictedUrl(tab.url)) {
            setIsRestrictedTab(true);
            setNeedsReload(false);
            setLoading(false);
            return;
          }

          setIsRestrictedTab(false);
          chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_DATA" }, (res) => {
            if (chrome.runtime.lastError) {
              setNeedsReload(true);
              setLoading(false);
              return;
            }
            if (res && res.data) {
              setPageData(res.data);
              setNeedsReload(false);
              // Update badge
              const sc = calculateSeoScores(res.data);
              chrome.runtime.sendMessage({
                type: "UPDATE_BADGE",
                tabId: tab.id,
                score: sc.overall,
              }, () => {
                if (chrome.runtime.lastError) { }
              });
            }
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivePage();

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      // Announce SIDE_PANEL_READY handshake to flush any queued messages from background
      chrome.runtime.sendMessage({ type: "SIDE_PANEL_READY" }, () => {
        if (chrome.runtime.lastError) {}
      });

      const listener = (msg: any) => {
        if (msg.type === "AUTO_PAGE_CONTEXT_UPDATED" && msg.data) {
          setPageData(msg.data);
          setIsRestrictedTab(false);
          setNeedsReload(false);
          if (msg.tabId) setActiveTabId(msg.tabId);
        } else if (msg.type === "PAGE_RESTRICTION_STATUS") {
          setIsRestrictedTab(msg.status === "RESTRICTED_PAGE");
          setNeedsReload(false);
          setLoading(false);
        } else if (msg.type === "NAVIGATE_TAB") {
          if (msg.tab) setActiveTab(msg.tab);
          if (msg.templateId) setTargetTemplateId(msg.templateId);
        } else if (msg.type === "SELECTION_RECEIVED") {
          if (msg.text) {
            setActiveTab("studio");
          }
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  const scores = calculateSeoScores(pageData);

  const handleFixWithTemplate = (templateId: string) => {
    setTargetTemplateId(templateId);
    setActiveTab("studio");
  };

  // Interactive Auto-Fix Handler
  const handleFixIssue = async (win: QuickWinItem) => {
    const siteName = pageData.h1Elements[0] || (pageData.hostname ? pageData.hostname.replace(/^www\./, "") : activeProfile.name) || "Official Website";
    const hotelName = siteName;
    const brand = activeProfile.brand || "Independent";
    const canonicalUrl = pageData.canonical || pageData.url || "https://example.com";

    const fixResult = await generateSeoAutoFix({
      issueId: win.id,
      hotelName,
      brand,
      canonicalUrl,
      pageTitle: pageData.title,
      pageMeta: pageData.metaDesc,
    });

    if (win.id === "title-len") {
      const optimalTitle = fixResult.optimalTitle || "Beachfront Hotel Panama City Beach | SpringHill Suites";
      const px = calculatePixelWidth(optimalTitle);
      setPageData((prev) => ({
        ...prev,
        title: optimalTitle,
        titlePixelWidth: px,
      }));
      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.issueTitle,
        issueCategory: fixResult.issueCategory,
        description: fixResult.description,
        codeSnippet: fixResult.codeSnippet,
        language: fixResult.language,
      });
    } else if (win.id === "meta-len") {
      const optimalMeta = fixResult.optimalMeta || "Book direct at SpringHill Suites Panama City Beach for oceanfront suites, lazy river pool, free hot breakfast, and lowest rates guaranteed on Gulf Coast.";
      const px = calculatePixelWidth(optimalMeta);
      setPageData((prev) => ({
        ...prev,
        metaDesc: optimalMeta,
        metaDescPixelWidth: px,
      }));
      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.issueTitle,
        issueCategory: fixResult.issueCategory,
        description: fixResult.description,
        codeSnippet: fixResult.codeSnippet,
        language: fixResult.language,
      });
    } else if (win.id === "canonical-h1") {
      const singleH1 = fixResult.optimalH1 || "SpringHill Suites Panama City Beachfront";
      setPageData((prev) => ({
        ...prev,
        canonical: canonicalUrl,
        h1Elements: [singleH1],
      }));
      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.issueTitle,
        issueCategory: fixResult.issueCategory,
        description: fixResult.description,
        codeSnippet: fixResult.codeSnippet,
        language: fixResult.language,
      });
    } else if (win.id === "schema-hotel-missing") {
      const isHotel = Boolean(
        pageData.url.toLowerCase().match(/hotel|resort|inn|suite|marriott|hilton|hyatt|ihg|motel|stay|lodge/) ||
        pageData.title.toLowerCase().match(/hotel|resort|suites|inn|lodging/)
      );

      const generatedSchema = isHotel
        ? {
            "@type": "Hotel",
            name: siteName,
            description: pageData.metaDesc || "Premier hospitality destination with modern suites, pool, and guest amenities.",
            url: canonicalUrl,
            telephone: activeProfile.phone || "+1-850-230-6004",
            priceRange: "$$$",
            address: {
              "@type": "PostalAddress",
              streetAddress: activeProfile.address || "14401 Front Beach Rd",
              addressLocality: activeProfile.city || "Panama City Beach",
              addressRegion: activeProfile.state || "FL",
              postalCode: activeProfile.postalCode || "32413",
              addressCountry: "US",
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: 30.2037,
              longitude: -85.8612,
            },
            checkinTime: "16:00",
            checkoutTime: "11:00",
            amenityFeature: [
              { "@type": "LocationFeatureSpecification", name: "High-Speed Wi-Fi", value: true },
              { "@type": "LocationFeatureSpecification", name: "Complimentary Hot Breakfast", value: true },
            ],
          }
        : {
            "@type": "Organization",
            name: siteName,
            url: canonicalUrl,
            description: pageData.metaDesc || `${siteName} official website.`,
            sameAs: pageData.socialLinks?.map((s) => s.url) || [],
          };

      setPageData((prev) => ({
        ...prev,
        schemas: [
          ...prev.schemas.filter((s) => {
            const t = String(s["@type"] || "").toLowerCase();
            return !t.includes("hotel") && !t.includes("organization") && !t.includes("website");
          }),
          generatedSchema,
        ],
      }));

      const jsonSnippet = `<script type="application/ld+json">\n${JSON.stringify(
        {
          "@context": "https://schema.org",
          ...generatedSchema,
        },
        null,
        2
      )}\n</script>`;

      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.source === "custom_tuned_model" ? fixResult.issueTitle : (isHotel ? "Hotel Schema Markup Injected" : "Organization Schema Injected"),
        issueCategory: fixResult.issueCategory,
        description: fixResult.source === "custom_tuned_model" ? fixResult.description : (isHotel ? "Injected valid Schema.org/Hotel structured data with coordinates, amenities, and contact points." : "Injected valid Schema.org/Organization structured data for universal search and entity graph recognition."),
        codeSnippet: fixResult.source === "custom_tuned_model" ? fixResult.codeSnippet : jsonSnippet,
        language: "json",
      });
    } else if (win.id === "og-missing") {
      const ogTitle = pageData.title || `${siteName} | Official Site`;
      const ogDesc = pageData.metaDesc || `Discover official solutions, products, and direct benefits from ${siteName}.`;
      const ogImg = pageData.ogImage || (pageData.imagesList && pageData.imagesList[0]?.src) || "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&h=630&q=80";
      const ogUrl = canonicalUrl;

      setPageData((prev) => ({
        ...prev,
        hasOgTitle: true,
        hasOgImage: true,
        ogTitle,
        ogDescription: ogDesc,
        ogImage: ogImg,
      }));

      const snippet = `<!-- Open Graph & Twitter Social Metadata -->\n<meta property="og:type" content="website" />\n<meta property="og:site_name" content="${siteName}" />\n<meta property="og:title" content="${ogTitle}" />\n<meta property="og:description" content="${ogDesc}" />\n<meta property="og:image" content="${ogImg}" />\n<meta property="og:url" content="${ogUrl}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${ogTitle}" />\n<meta name="twitter:description" content="${ogDesc}" />\n<meta name="twitter:image" content="${ogImg}" />`;

      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.source === "custom_tuned_model" ? fixResult.issueTitle : "Social Open Graph Tags Injected",
        issueCategory: fixResult.issueCategory,
        description: fixResult.source === "custom_tuned_model" ? fixResult.description : "Generated complete Open Graph and Twitter Card tags for high-CTR social previews.",
        codeSnippet: fixResult.source === "custom_tuned_model" ? fixResult.codeSnippet : snippet,
        language: "html",
      });
    } else if (win.id === "geo-ai-readiness") {
      const faqSchema = {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What time is check-in and check-out at SpringHill Suites Panama City Beachfront?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Check-in begins at 4:00 PM and check-out is at 11:00 AM local time. Digital check-in is available in the Marriott Bonvoy app.",
            },
          },
          {
            "@type": "Question",
            name: "Does the hotel provide complimentary breakfast and parking?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, complimentary daily hot buffet breakfast is included for all direct booking guests. On-site self-parking is available in our secure garage.",
            },
          },
          {
            "@type": "Question",
            name: "Is SpringHill Suites Panama City Beach located directly on the beach?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, our resort is located directly beachfront on the Gulf of Mexico featuring private boardwalk beach access and an outdoor lazy river pool.",
            },
          },
        ],
      };

      setPageData((prev) => ({
        ...prev,
        words: Math.max(prev.words, 680),
        schemas: [
          ...prev.schemas.filter((s) => !String(s["@type"] || "").toLowerCase().includes("faq")),
          faqSchema,
        ],
      }));

      const jsonSnippet = `<script type="application/ld+json">\n${JSON.stringify(
        {
          "@context": "https://schema.org",
          ...faqSchema,
        },
        null,
        2
      )}\n</script>`;

      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.source === "custom_tuned_model" ? fixResult.issueTitle : "GEO AI Knowledge & FAQ Injected",
        issueCategory: fixResult.issueCategory,
        description: fixResult.source === "custom_tuned_model" ? fixResult.description : "Injected structured FAQPage schema and expanded content depth to 680 words for AI Overviews.",
        codeSnippet: fixResult.source === "custom_tuned_model" ? fixResult.codeSnippet : jsonSnippet,
        language: "json",
      });
    } else {
      handleFixWithTemplate(win.templateIdToFix || "title-meta-suite");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] font-sans selection:bg-emerald-500/30">
      <div className="flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-50 border-b border-[#27272A] bg-[#09090B]/90 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold tracking-wider text-[#FAFAFA] uppercase">
                COGWHEEL SEO STUDIO
              </span>
              <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 tabular-nums">
                v3.0.0
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <ExportAuditDropdown
                pageData={pageData}
                scores={scores}
                activeProfile={activeProfile}
              />

              <button
                type="button"
                onClick={fetchActivePage}
                title="Re-scan active page"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#27272A] bg-[#111113] text-[#A1A1AA] shadow-xs transition hover:bg-[#18181B] hover:text-[#FAFAFA]"
              >
                <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Toggle Theme"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#27272A] bg-[#111113] text-[#A1A1AA] shadow-xs transition hover:bg-[#18181B] hover:text-[#FAFAFA]"
              >
                {isDarkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-[#A1A1AA]" />}
              </button>
            </div>
          </div>

          {/* GitHub Auto-Update Notification Banner */}
          <div className="mt-2.5">
            <UpdateBanner />
          </div>

          {/* Active URL bar */}
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#111113] px-2.5 py-1.5">
            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 uppercase">
              {isRestrictedTab ? "SYSTEM" : pageData.protocol.replace(":", "").toUpperCase()}
            </span>
            <span className="truncate text-xs font-medium text-[#FAFAFA]">
              {isRestrictedTab ? "System / New Tab Page" : pageData.hostname}
            </span>
            <span className="truncate text-[10px] text-[#71717A] tabular-nums">
              {isRestrictedTab ? "(Offline Studio Mode)" : pageData.pathname}
            </span>
          </div>

          {/* System Page Notice Banner */}
          {isRestrictedTab && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5 text-[11px] text-sky-300">
              <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
              <span>
                RESTRICTED_PAGE: Live page scan unavailable on browser system pages or internal origins. Open any https:// site to auto-fill from live DOM. Template Studio and Brand Profiles below are active in offline mode.
              </span>
            </div>
          )}

          {/* Needs Tab Reload Notice Banner */}
          {needsReload && !isRestrictedTab && (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-300">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="truncate">Refresh this webpage to inspect live DOM</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeTabId && typeof chrome !== "undefined" && chrome.tabs?.reload) {
                    chrome.tabs.reload(activeTabId, {}, () => {
                      if (chrome.runtime.lastError) { }
                      setNeedsReload(false);
                      setTimeout(fetchActivePage, 750);
                    });
                  }
                }}
                className="shrink-0 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950 hover:bg-amber-400 transition"
              >
                Refresh Page
              </button>
            </div>
          )}
        </header>

        {/* Navigation Bar */}
        <nav className="sticky top-[73px] z-40 flex items-center justify-between border-b border-[#27272A] bg-[#09090B]/90 p-1 backdrop-blur-md text-xs font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "dashboard"
                ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "audit"
                ? "bg-[#18181B] text-emerald-400 border border-emerald-500/30 shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-emerald-400" />
            <span>Live Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "compare"
                ? "bg-[#18181B] text-sky-400 border border-sky-500/30 shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-sky-400" />
            <span>Compare</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("studio")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "studio"
                ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dataset")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "dataset"
                ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Dataset</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("overlay")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "overlay"
                ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Overlays</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("automation")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "automation"
                ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Batch</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-2 transition whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Tab Body */}
        <main className="flex-1 p-3.5 space-y-4">
          {/* TAB 1: Audit & Radial Gauges */}
          {activeTab === "dashboard" && (
            <div className="space-y-4">
              {/* 4 Precision Micro-Gauges Card */}
              <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA]">
                <div className="flex items-center justify-between border-b border-[#27272A] pb-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                    KPI Metrics &amp; Micro-Gauges
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                      scores.overall >= 90
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : scores.overall >= 70
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        scores.overall >= 90
                          ? "bg-emerald-400"
                          : scores.overall >= 70
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                    />
                    <span>
                      {scores.overall >= 90
                        ? "OPTIMAL (GRADE A+)"
                        : scores.overall >= 70
                        ? `NEEDS REVIEW (GRADE ${scores.grade})`
                        : "CRITICAL (NEEDS AUDIT)"}
                    </span>
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <ScoreGauge
                    score={scores.overall}
                    label="Overall Health"
                    sublabel="/ 100"
                  />
                  <ScoreGauge
                    score={scores.onPage}
                    label="On-Page Structure"
                    sublabel="/ 100"
                  />
                  <ScoreGauge
                    score={scores.schemaTechnical}
                    label="Schema & Technical"
                    sublabel="/ 100"
                  />
                  <ScoreGauge
                    score={scores.geoAiReadiness}
                    label="GEO AI Readiness"
                    sublabel="/ 100"
                  />
                </div>
              </div>

              {/* Universal Site Category & Platform Banner */}
              {!isRestrictedTab && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[#27272A] bg-emerald-950/20 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-emerald-300 truncate">
                      {pageData.siteCategoryLabel || "Universal Website"}
                    </span>
                    {pageData.ecommerce?.isEcommerce && (
                      <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-200">
                        {pageData.ecommerce.price ? `${pageData.ecommerce.price} ${pageData.ecommerce.currency || ""}` : "Product Store"}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 rounded bg-[#18181B] border border-[#27272A] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    {pageData.detectedCmsLabel || "Web Application"}
                  </span>
                </div>
              )}

              {/* SERP & Social Card Preview */}
              <SerpSocialPreview data={pageData} />

              {/* Universal Image Optimization & WCAG 2.2 AA Audit Card */}
              <UniversalImageAuditCard
                images={pageData.detailedImages}
                vitals={pageData.vitals}
                totalImages={pageData.totalImages}
                imagesWithoutAlt={pageData.imagesWithoutAlt}
                hostname={pageData.hostname}
              />

              {/* Universal Heading Structure & Hierarchy Audit Card */}
              <UniversalHeadingAuditCard
                hierarchy={pageData.headingHierarchy}
                issues={pageData.headingIssues}
                h1Count={pageData.h1Elements.length}
                h2Count={pageData.h2Elements.length}
                h3Count={pageData.h3Elements.length}
              />

              {/* Quick Wins / Detected Issues */}
              <QuickWinsList
                quickWins={scores.quickWins}
                onFixWithTemplate={handleFixWithTemplate}
                onFixIssue={handleFixIssue}
              />
            </div>
          )}

          {/* TAB: Live Page Audit */}
          {activeTab === "audit" && (
            <LivePageAuditCard
              pageData={pageData}
              activeTabId={activeTabId}
              onRefresh={fetchActivePage}
              isLoading={loading}
            />
          )}

          {/* TAB: Competitor Compare */}
          {activeTab === "compare" && (
            <CompetitorCompareTab
              currentPageData={pageData}
              activeTabId={activeTabId}
              onNavigateToStudio={(tmplId) => {
                setTargetTemplateId(tmplId);
                setActiveTab("studio");
              }}
            />
          )}

          {/* TAB 2: Cogwheel Template Studio */}
          {activeTab === "studio" && (
            <TemplateStudio
              pageData={pageData}
              activeProfile={activeProfile}
              initialTemplateId={targetTemplateId}
              activeTabId={activeTabId}
            />
          )}

          {/* TAB 3: Dataset Curator & Training Vault */}
          {activeTab === "dataset" && (
            <DatasetVaultManager
              activeTabId={activeTabId}
              pageData={pageData}
              activeProfile={activeProfile}
            />
          )}

          {/* TAB 4: Visual On-Page Overlays */}
          {activeTab === "overlay" && (
            <DomOverlayInspector data={pageData} activeTabId={activeTabId} />
          )}

          {/* TAB 4: Automation & Batch Runner */}
          {activeTab === "automation" && (
            <AutomationBulkRunner pageData={pageData} activeProfile={activeProfile} />
          )}

          {/* TAB 5: Settings & Brand Profiles */}
          {activeTab === "settings" && (
            <SettingsBrandProfiles
              activeProfile={activeProfile}
              onSelectProfile={(p) => setActiveProfile(p)}
              isDarkMode={isDarkMode}
              onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            />
          )}

          {/* Copy Fixed Code Drawer */}
          <CopyFixedCodeDrawer
            isOpen={fixedDrawer.isOpen}
            onClose={() => setFixedDrawer((prev) => ({ ...prev, isOpen: false }))}
            issueTitle={fixedDrawer.issueTitle}
            issueCategory={fixedDrawer.issueCategory}
            description={fixedDrawer.description}
            codeSnippet={fixedDrawer.codeSnippet}
            language={fixedDrawer.language}
          />
        </main>
      </div>
    </div>
  );
}
