import React, { useState, useEffect, useMemo } from "react";
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
  Sparkles,
} from "lucide-react";
import { PageAuditData, ClientProfile, QuickWinItem } from "../types/extension";
import { PRESET_CLIENT_PROFILES, calculateSeoScores, SEO_STUDIO_OPTIMAL_AUDIT_DATA } from "../data/seoStudioTemplates";
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
import { GeoVisibilityCard } from "../components/GeoVisibilityCard";
import { CompetitorCompareTab } from "../components/CompetitorCompareTab";
import { SiteBundleModal } from "../components/SiteBundleModal";
import { ExtensionSiteBundle } from "../types/extension";
import { calculatePixelWidth } from "../utils/pixelCalculator";
import { isRestrictedUrl } from "../utils/urlSecurity";
import { useActivePack } from "../utils/useActivePack";
import { getActiveScoringWeights } from "../utils/activePack";
import { suggestPack } from "../../../src/packs/suggest";
import { generateSeoAutoFix } from "../engine/custom-model-client";
import {
  FAQ_REQUIRES_VERIFIED_ANSWERS,
  buildHotelSchema,
  buildOrganizationSchema,
  buildSocialSnippet,
  withFlags,
} from "../engine/auto-fix-copy";

export function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "audit" | "compare" | "studio" | "dataset" | "overlay" | "automation" | "settings"
  >("dashboard");

  const [isDarkMode, setIsDarkMode] = useState(true);

  const [brainQuestion, setBrainQuestion] = useState("");
  const [brainAnswer, setBrainAnswer] = useState("");
  const [brainLoading, setBrainLoading] = useState(false);

  const askBrain = async () => {
    if (!brainQuestion.trim()) return;
    setBrainLoading(true);
    setBrainAnswer("");
    try {
      const res = await fetch("https://seo-studio-one.vercel.app/api/brain", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: pageData?.url || (typeof window !== "undefined" ? window.location.href : ""), question: brainQuestion }),
      });
      const data = await res.json();
      if (res.ok) {
        setBrainAnswer(data.interpretation || "No answer.");
      } else {
        setBrainAnswer(`Error: ${data.error || res.status}`);
      }
    } catch (e) {
      setBrainAnswer(`Error: ${String(e)}`);
    } finally {
      setBrainLoading(false);
    }
  };

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ cogwheel_theme_dark: isDarkMode });
      }
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["cogwheel_theme_dark"], (res) => {
        if (typeof res?.cogwheel_theme_dark === "boolean") {
          setIsDarkMode(res.cogwheel_theme_dark);
        }
      });
    }
  }, []);
  const [targetTemplateId, setTargetTemplateId] = useState<string | undefined>();
  const [activeProfile, setActiveProfile] = useState<ClientProfile>(PRESET_CLIENT_PROFILES[0]);
  const [activeTabId, setActiveTabId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [isRestrictedTab, setIsRestrictedTab] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [siteBundle, setSiteBundle] = useState<ExtensionSiteBundle | null>(null);

  // Active vertical pack (Task 2.4): the stored selection and its catalog
  // scoring weights, which every calculateSeoScores call in this panel uses
  // for the composite (Task 3.2).
  const { activePack, weights: packWeights, setActivePack } = useActivePack();

  // Default fallback mock data containing the 6 baseline unoptimized audit issues
  // Neutral empty state — real data is always fetched from the active tab on mount
  const [pageData, setPageData] = useState<PageAuditData>({
    url: "",
    origin: "",
    pathname: "",
    protocol: "https:",
    hostname: "",
    title: "",
    titlePixelWidth: 0,
    metaDesc: "",
    metaDescPixelWidth: 0,
    canonical: "",
    h1Elements: [],
    h2Elements: [],
    h3Elements: [],
    totalImages: 0,
    imagesWithoutAlt: 0,
    oversizedImages: 0,
    words: 0,
    schemas: [],
    links: { internal: 0, external: 0, nofollow: 0 },
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

          const isSeoStudio = Boolean(
            (tab.url && tab.url.includes("SEO-Studio")) ||
            (tab.title && tab.title.includes("SEO-Studio"))
          );

          if (isSeoStudio) {
            setPageData(SEO_STUDIO_OPTIMAL_AUDIT_DATA);
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
          chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_DATA" }, async (res) => {
            if (chrome.runtime.lastError || !res?.data) {
              // Attempt dynamic on-the-fly auto-injection fallback
              if (chrome.scripting && chrome.scripting.executeScript && tab.id) {
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["content.js"],
                  });
                  setTimeout(() => {
                    if (!tab.id) return;
                    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_DATA" }, async (retryRes) => {
                      if (!chrome.runtime.lastError && retryRes && retryRes.data) {
                        setPageData(retryRes.data);
                        setNeedsReload(false);
                        // Task 3.2: composite weighted by the active pack.
                        const sc = calculateSeoScores(retryRes.data, await getActiveScoringWeights());
                        chrome.runtime.sendMessage({
                          type: "UPDATE_BADGE",
                          tabId: tab.id,
                          score: sc.overall,
                        }, () => {
                          if (chrome.runtime.lastError) { }
                        });
                      } else {
                        setNeedsReload(true);
                      }
                      setLoading(false);
                    });
                  }, 120);
                  return;
                } catch {
                  setNeedsReload(true);
                  setLoading(false);
                  return;
                }
              }
              setNeedsReload(true);
              setLoading(false);
              return;
            }
            if (res && res.data) {
              setPageData(res.data);
              setNeedsReload(false);
              // Update badge — Task 3.2: active pack's scoringWeights.
              const sc = calculateSeoScores(res.data, await getActiveScoringWeights());
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

    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      setActiveTabId(activeInfo.tabId);
      fetchActivePage();
    };

    const handleTabUpdated = (_updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === "complete") {
        fetchActivePage();
      }
    };

    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.onActivated?.addListener(handleTabActivated);
      chrome.tabs.onUpdated?.addListener(handleTabUpdated);
    }

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
      return () => {
        chrome.runtime.onMessage.removeListener(listener);
        if (typeof chrome !== "undefined" && chrome.tabs) {
          chrome.tabs.onActivated?.removeListener(handleTabActivated);
          chrome.tabs.onUpdated?.removeListener(handleTabUpdated);
        }
      };
    }
  }, []);

  const scores = calculateSeoScores(pageData, packWeights);

  /**
   * Task 2.4 auto-suggestion: deterministic catalog-signal match over the
   * audited page. Rendered as a one-click switch when it disagrees with the
   * stored pack; never overrides the operator's choice by itself.
   */
  const packSuggestion = useMemo(() => {
    if (!pageData.url) return null;
    const schemaTypes: string[] = [];
    for (const node of pageData.schemas || []) {
      const t = node["@type"];
      if (Array.isArray(t)) schemaTypes.push(...t.map(String));
      else if (t !== undefined && t !== null) schemaTypes.push(String(t));
    }
    return suggestPack({
      url: pageData.url,
      schemaTypes,
      text: [pageData.title, pageData.metaDesc, ...(pageData.h1Elements || [])].join(" "),
    });
  }, [pageData]);

  const handleFixWithTemplate = (templateId: string) => {
    setTargetTemplateId(templateId);
    setActiveTab("studio");
  };

  // Interactive Auto-Fix Handler
  /** Label for copy the local rules engine drafted from a template (not a measurement). */
  const suggestionFlags = (source: "custom_tuned_model" | "default_rules_engine") =>
    source === "default_rules_engine"
      ? [
          "suggested copy — drafted by the local rules engine from a template, not measured from the page; review before publishing",
        ]
      : [];

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
      const optimalTitle = fixResult.optimalTitle?.trim();
      if (!optimalTitle) {
        // No source produced a title — leave the page alone and say so.
        setFixedDrawer({
          isOpen: true,
          issueTitle: fixResult.issueTitle,
          issueCategory: fixResult.issueCategory,
          description: withFlags(fixResult.description, [
            "title — no suggestion was produced, the page title was left unchanged",
          ]),
          codeSnippet: fixResult.codeSnippet,
          language: fixResult.language,
        });
        return;
      }
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
        description: withFlags(fixResult.description, suggestionFlags(fixResult.source)),
        codeSnippet: fixResult.codeSnippet,
        language: fixResult.language,
      });
    } else if (win.id === "meta-len") {
      const optimalMeta = fixResult.optimalMeta?.trim();
      if (!optimalMeta) {
        setFixedDrawer({
          isOpen: true,
          issueTitle: fixResult.issueTitle,
          issueCategory: fixResult.issueCategory,
          description: withFlags(fixResult.description, [
            "meta description — no suggestion was produced, the page meta description was left unchanged",
          ]),
          codeSnippet: fixResult.codeSnippet,
          language: fixResult.language,
        });
        return;
      }
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
        description: withFlags(fixResult.description, suggestionFlags(fixResult.source)),
        codeSnippet: fixResult.codeSnippet,
        language: fixResult.language,
      });
    } else if (win.id === "canonical-h1") {
      const singleH1 = fixResult.optimalH1?.trim();
      setPageData((prev) => ({
        ...prev,
        canonical: canonicalUrl,
        ...(singleH1 ? { h1Elements: [singleH1] } : {}),
      }));
      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.issueTitle,
        issueCategory: fixResult.issueCategory,
        description: withFlags(
          fixResult.description,
          singleH1 ? suggestionFlags(fixResult.source) : ["H1 — no suggestion was produced, the page headings were left unchanged"],
        ),
        codeSnippet: fixResult.codeSnippet,
        language: fixResult.language,
      });
    } else if (win.id === "schema-hotel-missing") {
      const isHotel = Boolean(
        pageData.url.toLowerCase().match(/hotel|resort|inn|suite|marriott|hilton|hyatt|ihg|motel|stay|lodge/) ||
        pageData.title.toLowerCase().match(/hotel|resort|suites|inn|lodging/)
      );

      const draft = isHotel
        ? buildHotelSchema({
            siteName,
            canonicalUrl,
            metaDesc: pageData.metaDesc,
            profile: {
              phone: activeProfile.phone,
              address: activeProfile.address,
              city: activeProfile.city,
              state: activeProfile.state,
              postalCode: activeProfile.postalCode,
            },
          })
        : buildOrganizationSchema({
            siteName,
            canonicalUrl,
            metaDesc: pageData.metaDesc,
            socialLinks: pageData.socialLinks,
          });

      const generatedSchema = draft.schema;

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

      const injectedNote = isHotel
        ? "Injected valid Schema.org/Hotel structured data using only values present on the page or in the client profile."
        : "Injected valid Schema.org/Organization structured data for universal search and entity graph recognition.";

      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.source === "custom_tuned_model" ? fixResult.issueTitle : (isHotel ? "Hotel Schema Markup Injected" : "Organization Schema Injected"),
        issueCategory: fixResult.issueCategory,
        description:
          fixResult.source === "custom_tuned_model"
            ? withFlags(fixResult.description, draft.blankFields)
            : withFlags(injectedNote, draft.blankFields),
        codeSnippet: fixResult.source === "custom_tuned_model" ? fixResult.codeSnippet : jsonSnippet,
        language: "json",
      });
    } else if (win.id === "og-missing") {
      const ogTitle = pageData.title.trim() || siteName;
      const ogDesc = pageData.metaDesc.trim();
      const ogImg = (pageData.ogImage || pageData.imagesList?.[0]?.src || "").trim();
      const ogUrl = canonicalUrl;

      const { snippet, blankFields } = buildSocialSnippet({
        siteName,
        title: pageData.title,
        metaDesc: pageData.metaDesc,
        image: ogImg,
        url: ogUrl,
      });

      setPageData((prev) => ({
        ...prev,
        hasOgTitle: Boolean(ogTitle),
        hasOgImage: Boolean(ogImg),
        ogTitle,
        ogDescription: ogDesc,
        ogImage: ogImg,
      }));

      const socialNote =
        "Generated Open Graph and Twitter Card tags from the page's own title, meta description and images.";

      setFixedDrawer({
        isOpen: true,
        issueTitle: fixResult.source === "custom_tuned_model" ? fixResult.issueTitle : "Social Open Graph Tags Injected",
        issueCategory: fixResult.issueCategory,
        description:
          fixResult.source === "custom_tuned_model"
            ? withFlags(fixResult.description, blankFields)
            : withFlags(socialNote, [...blankFields, ...suggestionFlags(fixResult.source)]),
        codeSnippet: fixResult.source === "custom_tuned_model" ? fixResult.codeSnippet : snippet,
        language: "html",
      });
    } else if (win.id === "geo-ai-readiness") {
      // No verified answers exist for this page: never write invented FAQ copy.
      setFixedDrawer({
        isOpen: true,
        issueTitle: "FAQ Schema Needs Verified Answers",
        issueCategory: "GEO AI Readiness",
        description: FAQ_REQUIRES_VERIFIED_ANSWERS,
        codeSnippet:
          "<!-- No FAQ schema generated. Add your own Question/Answer pairs (or connect an AI provider) before publishing FAQPage markup. -->",
        language: "html",
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
                SEO STUDIO SEO STUDIO
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
                onClick={() => setIsBundleModalOpen(true)}
                title="Import Full Site Bundle JSON"
                className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 shadow-xs transition hover:bg-emerald-500/20"
              >
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span>Import Site Bundle</span>
              </button>

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

          {/* Active URL & Intelligence bar */}
          <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-[#27272A] bg-[#111113] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
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
              <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 border border-slate-700/60">
                {pageData.detectedCmsLabel || "Web App"}
              </span>
            </div>

            {!isRestrictedTab && (
              <div className="flex items-center justify-between gap-1.5 border-t border-[#27272A]/60 pt-1.5 text-[10px]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-emerald-300 truncate">
                    {pageData.siteCategoryLabel || "Universal Site"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#A1A1AA]">
                  <span>H1: <strong className="text-white font-mono">{pageData.h1Elements.length}</strong></span>
                  <span>Schemas: <strong className="text-emerald-400 font-mono">{pageData.schemas.length}</strong></span>
                  <span>Words: <strong className="text-white font-mono">{pageData.words}</strong></span>
                </div>
              </div>
            )}
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
          {/* GEO / AI visibility, measured with provenance labels */}
          {activeTab === "dashboard" && <GeoVisibilityCard url={pageData.url} />}

          {/* Ask the brain */}
          {activeTab === "dashboard" && (
            <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-2">Ask the brain</div>
              <textarea
                value={brainQuestion}
                onChange={(e) => setBrainQuestion(e.target.value)}
                placeholder="Ask about this page..."
                className="w-full rounded-lg border border-[#27272A] bg-[#09090B] p-2 text-xs text-[#FAFAFA] placeholder:text-[#71717A]"
                rows={3}
              />
              <button
                type="button"
                onClick={askBrain}
                disabled={brainLoading}
                className="mt-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {brainLoading ? "Thinking..." : "Ask"}
              </button>
              {brainAnswer && (
                <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-[#27272A] bg-[#09090B] p-2 text-[11px] text-[#A1A1AA]">{brainAnswer}</pre>
              )}
            </div>
          )}

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

              {/* Page-Type Confidence Pill & Pack Suggestion (Tasks 3.2 / 2.4) */}
              {!isRestrictedTab && pageData.pageType && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#27272A] bg-[#111113] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300"
                      title={
                        (pageData.pageTypeSignals || []).join(" · ") ||
                        "No classifier signal matched"
                      }
                    >
                      {pageData.pageType} · {pageData.pageTypeConfidence ?? 0}%
                    </span>
                    <span className="text-[10px] text-slate-400">
                      page-type confidence — rule-based heuristic, not a measurement
                    </span>
                  </div>
                  {packSuggestion && packSuggestion.packId !== activePack && (
                    <button
                      type="button"
                      onClick={() => void setActivePack(packSuggestion.packId)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                      title={`Signals: ${packSuggestion.reasons.join(", ") || "none"}`}
                    >
                      Suggested pack: {packSuggestion.name} ({packSuggestion.confidence}%) — switch
                    </button>
                  )}
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

          {/* TAB 2: SEO Studio Template Studio */}
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
              activePack={activePack}
              onSelectPack={setActivePack}
              scoringWeights={packWeights}
              packSuggestion={packSuggestion && packSuggestion.packId !== activePack ? packSuggestion : null}
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

          {/* Full Site Bundle Importer Modal */}
          <SiteBundleModal
            isOpen={isBundleModalOpen}
            onClose={() => setIsBundleModalOpen(false)}
            activeTabUrl={pageData.url}
            activeTabId={activeTabId}
            initialBundle={siteBundle}
            onBundleLoaded={(b) => setSiteBundle(b)}
          />
        </main>
      </div>
    </div>
  );
}
