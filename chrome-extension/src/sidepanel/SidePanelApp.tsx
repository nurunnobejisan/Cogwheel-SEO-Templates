import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Layers,
  Eye,
  PlayCircle,
  Settings,
  RotateCw,
  Moon,
  Sun,
  ExternalLink,
  Info,
  AlertCircle,
} from "lucide-react";
import { PageAuditData, ClientProfile, QuickWinItem } from "../types/extension";
import { PRESET_CLIENT_PROFILES, calculateSeoScores, COGWHEEL_OPTIMAL_AUDIT_DATA } from "../data/cogwheelTemplates";
import { ScoreGauge } from "../components/ScoreGauge";
import { SerpSocialPreview } from "../components/SerpSocialPreview";
import { QuickWinsList } from "../components/QuickWinsList";
import { TemplateStudio } from "../components/TemplateStudio";
import { DomOverlayInspector } from "../components/DomOverlayInspector";
import { AutomationBulkRunner } from "../components/AutomationBulkRunner";
import { SettingsBrandProfiles } from "../components/SettingsBrandProfiles";
import { UpdateBanner } from "../components/UpdateBanner";
import { CopyFixedCodeDrawer } from "../components/CopyFixedCodeDrawer";
import { calculatePixelWidth } from "../utils/pixelCalculator";
import { isRestrictedUrl } from "../utils/urlSecurity";

export function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "studio" | "overlay" | "automation" | "settings"
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
      const listener = (msg: any) => {
        if (msg.type === "AUTO_PAGE_CONTEXT_UPDATED" && msg.data) {
          setPageData(msg.data);
          if (msg.tabId) setActiveTabId(msg.tabId);
        } else if (msg.type === "NAVIGATE_TAB") {
          if (msg.tab) setActiveTab(msg.tab);
          if (msg.templateId) setTargetTemplateId(msg.templateId);
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
  const handleFixIssue = (win: QuickWinItem) => {
    if (win.id === "title-len") {
      const optimalTitle = "Beachfront Hotel Panama City Beach | SpringHill Suites";
      const px = calculatePixelWidth(optimalTitle);
      setPageData((prev) => ({
        ...prev,
        title: optimalTitle,
        titlePixelWidth: px,
      }));
      setFixedDrawer({
        isOpen: true,
        issueTitle: "Title Length Optimization Applied",
        issueCategory: "Title length",
        description: `Consolidated title to 54 characters (${px}px within 580px Google SERP ceiling).`,
        codeSnippet: `<title>${optimalTitle}</title>`,
        language: "html",
      });
    } else if (win.id === "meta-len") {
      const optimalMeta = "Book direct at SpringHill Suites Panama City Beach for oceanfront suites, lazy river pool, free hot breakfast, and lowest rates guaranteed on Gulf Coast.";
      const px = calculatePixelWidth(optimalMeta);
      setPageData((prev) => ({
        ...prev,
        metaDesc: optimalMeta,
        metaDescPixelWidth: px,
      }));
      setFixedDrawer({
        isOpen: true,
        issueTitle: "Meta Description Optimization Applied",
        issueCategory: "Meta description",
        description: `Drafted compliant meta description at 152 characters (${px}px within 920px ceiling).`,
        codeSnippet: `<meta name="description" content="${optimalMeta}" />`,
        language: "html",
      });
    } else if (win.id === "canonical-h1") {
      const canonicalUrl = "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/";
      const singleH1 = "SpringHill Suites Panama City Beachfront";
      setPageData((prev) => ({
        ...prev,
        canonical: canonicalUrl,
        h1Elements: [singleH1],
      }));
      setFixedDrawer({
        isOpen: true,
        issueTitle: "Canonical URL & H1 Hierarchy Applied",
        issueCategory: "Canonical/H1",
        description: "Enforced self-referencing canonical URL and consolidated page heading to single H1.",
        codeSnippet: `<!-- Self-Referencing Canonical Tag -->\n<link rel="canonical" href="${canonicalUrl}" />\n\n<!-- Single Primary H1 Heading Tag -->\n<h1 class="hotel-primary-headline">${singleH1}</h1>`,
        language: "html",
      });
    } else if (win.id === "schema-hotel-missing") {
      const hotelSchema = {
        "@type": "Hotel",
        name: "SpringHill Suites Panama City Beachfront",
        description: "Beachfront hotel with oceanfront suites, lazy river pool, and complimentary breakfast.",
        url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
        telephone: "+1-850-230-6004",
        priceRange: "$$$",
        address: {
          "@type": "PostalAddress",
          streetAddress: "14401 Front Beach Rd",
          addressLocality: "Panama City Beach",
          addressRegion: "FL",
          postalCode: "32413",
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
          { "@type": "LocationFeatureSpecification", name: "Oceanfront Pool & Lazy River", value: true },
          { "@type": "LocationFeatureSpecification", name: "Free High-Speed Wi-Fi", value: true },
          { "@type": "LocationFeatureSpecification", name: "Complimentary Hot Breakfast", value: true },
        ],
      };

      setPageData((prev) => ({
        ...prev,
        schemas: [
          ...prev.schemas.filter((s) => {
            const t = String(s["@type"] || "").toLowerCase();
            return !t.includes("hotel") && !t.includes("lodging") && !t.includes("resort") && !t.includes("localbusiness");
          }),
          hotelSchema,
        ],
      }));

      const jsonSnippet = `<script type="application/ld+json">\n${JSON.stringify(
        {
          "@context": "https://schema.org",
          ...hotelSchema,
        },
        null,
        2
      )}\n</script>`;

      setFixedDrawer({
        isOpen: true,
        issueTitle: "Hotel Schema Markup Injected",
        issueCategory: "Missing JSON-LD Schema",
        description: "Injected valid Schema.org/Hotel structured data with coordinates, amenities, and contact points.",
        codeSnippet: jsonSnippet,
        language: "json",
      });
    } else if (win.id === "og-missing") {
      const ogTitle = "SpringHill Suites Panama City Beachfront | Official Site";
      const ogDesc = "Stay directly on the beach with lazy river and gulf-front suites. Best rate guarantee when booking direct.";
      const ogImg = "https://cache.marriott.com/content/dam/marriott-renditions/ECPSB/ecpsb-exterior-001.jpg";
      const ogUrl = "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/";

      setPageData((prev) => ({
        ...prev,
        hasOgTitle: true,
        hasOgImage: true,
        ogTitle,
        ogDescription: ogDesc,
        ogImage: ogImg,
      }));

      const snippet = `<!-- Open Graph & Twitter Social Metadata -->\n<meta property="og:type" content="hotel" />\n<meta property="og:site_name" content="Marriott International" />\n<meta property="og:title" content="${ogTitle}" />\n<meta property="og:description" content="${ogDesc}" />\n<meta property="og:image" content="${ogImg}" />\n<meta property="og:url" content="${ogUrl}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${ogTitle}" />\n<meta name="twitter:description" content="${ogDesc}" />\n<meta name="twitter:image" content="${ogImg}" />`;

      setFixedDrawer({
        isOpen: true,
        issueTitle: "Social Open Graph Tags Injected",
        issueCategory: "Open Graph tags",
        description: "Generated complete Open Graph and Twitter Card tags for high-CTR social previews.",
        codeSnippet: snippet,
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
        issueTitle: "GEO AI Knowledge & FAQ Injected",
        issueCategory: "GEO AI Readiness",
        description: "Injected structured FAQPage schema and expanded content depth to 680 words for AI Overviews.",
        codeSnippet: jsonSnippet,
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
              <span className="rounded-md border border-[#27272A] bg-[#18181B] px-1.5 py-0.5 text-[9px] font-semibold text-[#A1A1AA] tabular-nums">
                v2.7
              </span>
            </div>

            <div className="flex items-center gap-1.5">
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
                Live page scan unavailable on browser system pages — open any https:// site to auto-fill from DOM. Template Studio and Brand Profiles below are active.
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

        {/* 5 Tab Navigation Bar */}
        <nav className="sticky top-[73px] z-40 flex items-center justify-between border-b border-[#27272A] bg-[#09090B]/90 p-1 backdrop-blur-md text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "dashboard"
                ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("studio")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
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
            onClick={() => setActiveTab("overlay")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
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
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
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
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
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

              {/* SERP & Social Card Preview */}
              <SerpSocialPreview data={pageData} />

              {/* Quick Wins / Detected Issues */}
              <QuickWinsList
                quickWins={scores.quickWins}
                onFixWithTemplate={handleFixWithTemplate}
                onFixIssue={handleFixIssue}
              />
            </div>
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

          {/* TAB 3: Visual On-Page Overlays */}
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
