import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Database,
  PlusCircle,
  CopyCheck,
  Download,
  Search,
  Check,
  X,
  Trash2,
  ExternalLink,
  Code2,
  FileEdit,
  Globe,
  Sparkles,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  TrainingPairRecord,
  TrainingVaultStats,
  RawWebInput,
  getAllTrainingPairs,
  saveTrainingPair,
  updateTrainingPairTarget,
  updateTrainingPairStatus,
  deleteTrainingPair,
  getTrainingVaultStats,
  TargetOptimizedOutput,
} from "../storage/training-vault";
import { PageAuditData, ClientProfile } from "../types/extension";
import { ExportDatasetModal } from "./ExportDatasetModal";
import {
  ApiSyncConfig,
  syncRecordToApi,
} from "../../../shared/ts/dataset-builder";
import { isRestrictedUrl } from "../utils/urlSecurity";

export interface DatasetVaultManagerProps {
  activeTabId?: number;
  pageData?: PageAuditData;
  activeProfile?: ClientProfile;
}

const DEFAULT_API_CONFIG_KEY = "cogwheel_api_sync_config";

export function DatasetVaultManager({
  activeTabId,
  pageData,
  activeProfile,
}: DatasetVaultManagerProps) {
  const [records, setRecords] = useState<TrainingPairRecord[]>([]);
  const [stats, setStats] = useState<TrainingVaultStats>({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    avgQualityScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "rejected">("all");
  const [brandFilter, setBrandFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"score" | "newest" | "oldest">("newest");

  // Modals & Drawers
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [expandedJsonId, setExpandedJsonId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TargetOptimizedOutput | null>(null);

  // Action status toasts
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    running: boolean;
    current: number;
    total: number;
  }>({ running: false, current: 0, total: 0 });

  // Webhook / API sync configuration
  const [apiConfig, setApiConfig] = useState<ApiSyncConfig>(() => {
    try {
      const stored = localStorage.getItem(DEFAULT_API_CONFIG_KEY);
      return stored ? JSON.parse(stored) : { endpointUrl: "", bearerToken: "", autoSyncOnApproval: false };
    } catch {
      return { endpointUrl: "", bearerToken: "", autoSyncOnApproval: false };
    }
  });

  const loadVaultData = useCallback(async () => {
    try {
      const all = await getAllTrainingPairs();
      const vaultStats = await getTrainingVaultStats();
      setRecords(all);
      setStats(vaultStats);
    } catch (err) {
      console.error("Failed to load training vault:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  const handleSaveApiConfig = (updated: ApiSyncConfig) => {
    setApiConfig(updated);
    try {
      localStorage.setItem(DEFAULT_API_CONFIG_KEY, JSON.stringify(updated));
    } catch {
      // storage quota or disabled
    }
  };

  // 1. One-Click: Capture Current Tab
  const handleCaptureCurrentTab = async () => {
    setActionFeedback("Extracting DOM snapshot...");
    try {
      let rawData: RawWebInput = {
        url: pageData?.url || "https://example.com/hotel",
        canonicalUrl: pageData?.canonical || pageData?.url || "https://example.com/hotel",
        domain: pageData?.hostname || "example.com",
        rawTitle: pageData?.title || "",
        rawMetaDesc: pageData?.metaDesc || "",
        rawH1: pageData?.h1Elements || [],
        rawH2: pageData?.h2Elements || [],
        rawBodyText: pageData?.h2Elements?.join(". ") || "Luxury beachfront accommodations.",
        detectedSchemas: (pageData?.schemas || []).map((s) => String(s["@type"] || "")),
        wordCount: pageData?.words || 450,
      };

      // Query content script if tab connected
      if (activeTabId && typeof chrome !== "undefined" && chrome.tabs?.sendMessage) {
        try {
          const res = await new Promise<{ success: boolean; sample?: unknown }>((resolve) => {
            chrome.tabs.sendMessage(activeTabId, { type: "CAPTURE_TRAINING_SAMPLE" }, (response) => {
              if (chrome.runtime.lastError || !response) {
                resolve({ success: false });
              } else {
                resolve(response);
              }
            });
          });

          if (res.success && res.sample) {
            const s = res.sample as {
              url: string;
              canonicalUrl: string;
              domain: string;
              title: string;
              metaDescription: string;
              h1Elements: string[];
              h2Elements: string[];
              mainBodyText: string;
              schemaTypes: string[];
              metrics: { wordCount: number };
            };
            rawData = {
              url: s.url,
              canonicalUrl: s.canonicalUrl,
              domain: s.domain,
              rawTitle: s.title,
              rawMetaDesc: s.metaDescription,
              rawH1: s.h1Elements,
              rawH2: s.h2Elements,
              rawBodyText: s.mainBodyText,
              detectedSchemas: s.schemaTypes,
              wordCount: s.metrics?.wordCount || 450,
            };
          }
        } catch {
          // Fall back to pageData
        }
      }

      const brand = activeProfile?.brand || "Marriott";
      const cleanH1 = rawData.rawH1[0] || activeProfile?.name || "SpringHill Suites Panama City Beachfront";

      // Formulate target output
      const targetOutput: TargetOptimizedOutput = {
        optimizedTitle: `${cleanH1} | Official Hotel & Resort`,
        optimizedMetaDesc: `Book direct at ${cleanH1} for exclusive lowest rates, luxury beachfront rooms, on-site dining, and verified franchise amenities.`,
        optimizedH1: cleanH1,
        jsonLdSchema: {
          "@context": "https://schema.org",
          "@type": "Hotel",
          name: cleanH1,
          url: rawData.canonicalUrl,
          description: rawData.rawMetaDesc || `Official lodging accommodations at ${cleanH1}.`,
        },
        geoEntityBlock: `${cleanH1} is an established hospitality property offering prime accommodations, full guest amenities, and direct booking benefits under the ${brand} portfolio.`,
        brandGuardrail: brand,
      };

      const record = await saveTrainingPair({
        rawInput: rawData,
        targetOutput,
        brand,
        status: "pending",
      });

      await loadVaultData();
      setActionFeedback(`Captured ${record.domain} (${record.qualityScore}/100)`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      setActionFeedback(`Capture failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // 2. One-Click: Batch Capture Open Tabs
  const handleBatchCaptureOpenTabs = async () => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      setActionFeedback("Tab querying requires Chrome extension runtime.");
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const validTabs = tabs.filter(
        (t) => t.id && t.url && (t.url.startsWith("http://") || t.url.startsWith("https://")) && !isRestrictedUrl(t.url)
      );

      if (validTabs.length === 0) {
        setActionFeedback("No web pages found in active window.");
        setTimeout(() => setActionFeedback(null), 3000);
        return;
      }

      setBatchProgress({ running: true, current: 0, total: validTabs.length });
      let capturedCount = 0;

      for (let i = 0; i < validTabs.length; i++) {
        const tab = validTabs[i];
        setBatchProgress({ running: true, current: i + 1, total: validTabs.length });

        try {
          const res = await new Promise<{ success: boolean; sample?: unknown }>((resolve) => {
            if (!tab.id) return resolve({ success: false });
            chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_TRAINING_SAMPLE" }, (response) => {
              if (chrome.runtime.lastError || !response) {
                resolve({ success: false });
              } else {
                resolve(response);
              }
            });
          });

          const title = tab.title || "Hotel Property";
          const tabUrl = tab.url || "https://example.com";
          const domain = new URL(tabUrl).hostname;

          let rawData: RawWebInput = {
            url: tabUrl,
            canonicalUrl: tabUrl,
            domain,
            rawTitle: title,
            rawMetaDesc: "",
            rawH1: [title],
            rawH2: [],
            rawBodyText: "Automated batch capture from active Chrome window.",
            detectedSchemas: [],
            wordCount: 300,
          };

          if (res.success && res.sample) {
            const s = res.sample as {
              url: string;
              canonicalUrl: string;
              domain: string;
              title: string;
              metaDescription: string;
              h1Elements: string[];
              h2Elements: string[];
              mainBodyText: string;
              schemaTypes: string[];
              metrics: { wordCount: number };
            };
            rawData = {
              url: s.url,
              canonicalUrl: s.canonicalUrl,
              domain: s.domain,
              rawTitle: s.title,
              rawMetaDesc: s.metaDescription,
              rawH1: s.h1Elements,
              rawH2: s.h2Elements,
              rawBodyText: s.mainBodyText,
              detectedSchemas: s.schemaTypes,
              wordCount: s.metrics?.wordCount || 300,
            };
          }

          const brand = domain.includes("marriott")
            ? "Marriott"
            : domain.includes("hilton")
            ? "Hilton"
            : domain.includes("ihg")
            ? "IHG"
            : domain.includes("hyatt")
            ? "Hyatt"
            : "Independent";

          const cleanH1 = rawData.rawH1[0] || rawData.rawTitle || "Hotel Property";

          const targetOutput: TargetOptimizedOutput = {
            optimizedTitle: `${cleanH1.slice(0, 45)} | Official Hotel`,
            optimizedMetaDesc: `Reserve your stay direct at ${cleanH1}. Enjoy premier accommodations, luxury amenities, and lowest rate guarantees.`,
            optimizedH1: cleanH1.slice(0, 50),
            jsonLdSchema: {
              "@context": "https://schema.org",
              "@type": "Hotel",
              name: cleanH1,
              url: rawData.canonicalUrl,
            },
            geoEntityBlock: `${cleanH1} provides luxury lodging and event venues located in its local destination market under ${brand} brand guidelines.`,
            brandGuardrail: brand,
          };

          await saveTrainingPair({
            rawInput: rawData,
            targetOutput,
            brand,
            status: "pending",
          });

          capturedCount++;
        } catch {
          // Continue to next tab
        }
      }

      setBatchProgress({ running: false, current: 0, total: 0 });
      await loadVaultData();
      setActionFeedback(`Batch captured ${capturedCount} of ${validTabs.length} tabs!`);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err) {
      setBatchProgress({ running: false, current: 0, total: 0 });
      setActionFeedback(`Batch capture error: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  // Status Action: Approve
  const handleApprove = async (record: TrainingPairRecord) => {
    try {
      const updated = await updateTrainingPairStatus(record.id, "approved");
      await loadVaultData();

      // If auto-sync is enabled, trigger background webhook push
      if (apiConfig.autoSyncOnApproval && apiConfig.endpointUrl) {
        syncRecordToApi(updated, apiConfig).then((res) => {
          if (res.success) {
            setActionFeedback(`Approved & Synced to API (${record.domain})`);
          } else {
            setActionFeedback(`Approved, but API sync failed: ${res.error || res.message}`);
          }
          setTimeout(() => setActionFeedback(null), 3000);
        });
      } else {
        setActionFeedback(`Approved sample for ${record.domain}`);
        setTimeout(() => setActionFeedback(null), 2500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Status Action: Reject
  const handleReject = async (id: string) => {
    try {
      await updateTrainingPairStatus(id, "rejected");
      await loadVaultData();
      setActionFeedback("Sample marked as rejected");
      setTimeout(() => setActionFeedback(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Record
  const handleDelete = async (id: string, domain: string) => {
    try {
      await deleteTrainingPair(id);
      await loadVaultData();
      setActionFeedback(`Deleted sample from ${domain}`);
      setTimeout(() => setActionFeedback(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Start Editing Target Output
  const handleStartEdit = (record: TrainingPairRecord) => {
    setEditingRecordId(record.id);
    setEditForm({ ...record.targetOutput });
  };

  // Save Target Output Edits
  const handleSaveEdit = async (recordId: string) => {
    if (!editForm) return;
    try {
      const updated = await updateTrainingPairTarget(recordId, editForm);
      setEditingRecordId(null);
      setEditForm(null);
      await loadVaultData();
      setActionFeedback(`Updated target output (New Score: ${updated.qualityScore}/100)`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      setActionFeedback(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    return records
      .filter((rec) => {
        if (statusFilter !== "all" && rec.status !== statusFilter) return false;
        if (brandFilter !== "All" && rec.brand.toLowerCase() !== brandFilter.toLowerCase()) return false;
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase();
          const matchUrl = rec.canonicalUrl.toLowerCase().includes(q);
          const matchDomain = rec.domain.toLowerCase().includes(q);
          const matchBrand = rec.brand.toLowerCase().includes(q);
          const matchTitle = rec.rawInput.rawTitle.toLowerCase().includes(q);
          const matchTarget = rec.targetOutput.optimizedTitle.toLowerCase().includes(q);
          return matchUrl || matchDomain || matchBrand || matchTitle || matchTarget;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score") return b.qualityScore - a.qualityScore;
        if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [records, statusFilter, brandFilter, searchQuery, sortBy]);

  // SFT Threshold Calculation (100 minimum examples)
  const SFT_THRESHOLD = 100;
  const sftProgressPct = Math.min(100, Math.round((stats.approved / SFT_THRESHOLD) * 100));
  const isSftReady = stats.approved >= SFT_THRESHOLD;

  return (
    <div className="space-y-4">
      {/* 1. Header & KPI Gauges Bar */}
      <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA]">
        <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#27272A] bg-[#18181B] text-emerald-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#FAFAFA]">
                Training Data Vault
              </h2>
              <p className="text-[11px] text-[#A1A1AA]">
                Curate paired DOM snapshots for Supervised Fine-Tuning (SFT) &amp; GEO
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-[#FAFAFA] hover:bg-[#27272A] transition"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Export Dataset</span>
            </button>
          </div>
        </div>

        {/* 4 Micro-KPI Gauges */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2.5">
            <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
              Total Samples
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-[#FAFAFA] tabular-nums">
              {stats.total}
            </div>
          </div>

          <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2.5">
            <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
              Approved (SFT)
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-emerald-400 tabular-nums">
              {stats.approved}
            </div>
          </div>

          <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2.5">
            <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
              Pending Review
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-amber-400 tabular-nums">
              {stats.pending}
            </div>
          </div>

          <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2.5">
            <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
              Avg Quality
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-indigo-400 tabular-nums">
              {stats.avgQualityScore}
              <span className="text-xs font-normal text-[#71717A]">/100</span>
            </div>
          </div>
        </div>

        {/* Supervised Fine-Tuning 100-Example Threshold Progress */}
        <div className="mt-3.5 rounded-lg border border-[#27272A] bg-[#18181B] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-[#FAFAFA]">
                Supervised Fine-Tuning Minimum Threshold
              </span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isSftReady
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              {isSftReady ? "Ready for SFT" : "Collecting Samples"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
            <span>
              Target: <strong className="text-[#FAFAFA] font-mono">100</strong> approved pairs
            </span>
            <span className="font-mono tabular-nums text-emerald-400 font-bold">
              {stats.approved} / {SFT_THRESHOLD} ({sftProgressPct}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#27272A]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${sftProgressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Action Toolbar: Capture Current Tab & Batch Capture */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#27272A] bg-[#111113] p-3">
        <button
          type="button"
          onClick={handleCaptureCurrentTab}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-black hover:bg-emerald-400 transition shadow-xs"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Capture Current Tab</span>
        </button>

        <button
          type="button"
          onClick={handleBatchCaptureOpenTabs}
          disabled={batchProgress.running}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-3.5 py-2 text-xs font-semibold text-[#FAFAFA] hover:bg-[#27272A] disabled:opacity-50 transition"
        >
          <Layers className={`h-4 w-4 ${batchProgress.running ? "animate-spin" : ""}`} />
          <span>
            {batchProgress.running
              ? `Capturing ${batchProgress.current}/${batchProgress.total}...`
              : "Batch Capture Open Tabs"}
          </span>
        </button>

        {apiConfig.endpointUrl && (
          <div className="inline-flex items-center gap-1 rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-2 text-[11px] text-[#A1A1AA]">
            <Globe className="h-3 w-3 text-emerald-400" />
            <span className="font-mono">API Sync Active</span>
          </div>
        )}
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300 transition">
          {actionFeedback}
        </div>
      )}

      {/* 3. Search, Filter & Sort Bar */}
      <div className="rounded-xl border border-[#27272A] bg-[#111113] p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#71717A]" />
            <input
              type="text"
              placeholder="Filter by domain, URL, brand, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#27272A] bg-[#18181B] pl-9 pr-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#52525B] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Brand Filter */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
          >
            <option value="All">All Brands</option>
            <option value="Marriott">Marriott</option>
            <option value="Hilton">Hilton</option>
            <option value="IHG">IHG</option>
            <option value="Hyatt">Hyatt</option>
            <option value="Independent">Independent</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "score" | "newest" | "oldest")}
            className="rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="score">Highest Quality Score</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              statusFilter === "all"
                ? "bg-emerald-500 text-black font-semibold"
                : "border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]"
            }`}
          >
            All ({records.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              statusFilter === "approved"
                ? "bg-emerald-500 text-black font-semibold"
                : "border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]"
            }`}
          >
            Approved ({stats.approved})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              statusFilter === "pending"
                ? "bg-emerald-500 text-black font-semibold"
                : "border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]"
            }`}
          >
            Pending ({stats.pending})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              statusFilter === "rejected"
                ? "bg-emerald-500 text-black font-semibold"
                : "border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]"
            }`}
          >
            Rejected ({stats.rejected})
          </button>
        </div>
      </div>

      {/* 4. Filterable Captured Samples List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-xs text-[#71717A]">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading Training Vault...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-xl border border-[#27272A] bg-[#111113] p-8 text-center text-xs text-[#71717A] space-y-2">
            <Database className="h-8 w-8 mx-auto text-[#3F3F46]" />
            <div className="font-semibold text-[#FAFAFA]">No training samples found</div>
            <p className="max-w-xs mx-auto text-[11px] text-[#A1A1AA]">
              Capture your first hotel webpage using the buttons above or optimize templates in the Studio to auto-pair samples.
            </p>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const isEditing = editingRecordId === record.id;
            const isJsonExpanded = expandedJsonId === record.id;

            return (
              <div
                key={record.id}
                className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-xs text-[#FAFAFA] space-y-3 transition hover:border-[#3F3F46]"
              >
                {/* Top Card Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-[#27272A] bg-[#18181B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FAFAFA]">
                        {record.brand}
                      </span>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          record.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : record.status === "rejected"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {record.status}
                      </span>

                      <span className="font-mono text-[11px] font-bold text-emerald-400 tabular-nums">
                        {record.qualityScore}/100 Quality
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate text-[11px] text-[#A1A1AA]">
                      <span className="font-semibold text-[#FAFAFA] truncate">
                        {record.domain}
                      </span>
                      <span>&bull;</span>
                      <a
                        href={record.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span className="truncate">{record.canonicalUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Top Right Quick Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {record.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => handleApprove(record)}
                        title="Approve Sample"
                        className="rounded-md border border-[#27272A] bg-[#18181B] p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {record.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => handleReject(record.id)}
                        title="Reject Sample"
                        className="rounded-md border border-[#27272A] bg-[#18181B] p-1.5 text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStartEdit(record)}
                      title="Edit Target Output"
                      className="rounded-md border border-[#27272A] bg-[#18181B] p-1.5 text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#27272A] transition"
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedJsonId(isJsonExpanded ? null : record.id)}
                      title="Inspect JSON Pair"
                      className="rounded-md border border-[#27272A] bg-[#18181B] p-1.5 text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#27272A] transition"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(record.id, record.domain)}
                      title="Delete Duplicate"
                      className="rounded-md border border-[#27272A] bg-[#18181B] p-1.5 text-[#71717A] hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Optimization Delta Preview */}
                <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
                    Optimization Pair Overview
                  </div>
                  <div className="truncate">
                    <span className="text-[#71717A]">Raw Title: </span>
                    <span className="text-[#A1A1AA]">
                      {record.rawInput.rawTitle || "(Missing title)"}
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-emerald-400 font-semibold">Target: </span>
                    <span className="text-[#FAFAFA] font-medium">
                      {record.targetOutput.optimizedTitle}
                    </span>
                  </div>
                </div>

                {/* Inline Target Output Editor Drawer */}
                {isEditing && editForm && (
                  <div className="rounded-lg border border-emerald-500/30 bg-[#141416] p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                      <span className="text-xs font-semibold text-emerald-400">
                        Edit Target Optimization Output
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecordId(null);
                          setEditForm(null);
                        }}
                        className="text-[#71717A] hover:text-[#FAFAFA]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[#71717A] mb-1">
                          Optimized Title ({editForm.optimizedTitle.length} chars)
                        </label>
                        <input
                          type="text"
                          value={editForm.optimizedTitle}
                          onChange={(e) =>
                            setEditForm({ ...editForm, optimizedTitle: e.target.value })
                          }
                          className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[#71717A] mb-1">
                          Optimized Meta Description ({editForm.optimizedMetaDesc.length} chars)
                        </label>
                        <textarea
                          rows={2}
                          value={editForm.optimizedMetaDesc}
                          onChange={(e) =>
                            setEditForm({ ...editForm, optimizedMetaDesc: e.target.value })
                          }
                          className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[#71717A] mb-1">
                          Optimized H1
                        </label>
                        <input
                          type="text"
                          value={editForm.optimizedH1}
                          onChange={(e) =>
                            setEditForm({ ...editForm, optimizedH1: e.target.value })
                          }
                          className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[#71717A] mb-1">
                          GEO Entity Block
                        </label>
                        <textarea
                          rows={2}
                          value={editForm.geoEntityBlock}
                          onChange={(e) =>
                            setEditForm({ ...editForm, geoEntityBlock: e.target.value })
                          }
                          className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272A]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecordId(null);
                          setEditForm(null);
                        }}
                        className="rounded-md border border-[#27272A] px-2.5 py-1 text-xs text-[#A1A1AA] hover:bg-[#18181B]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(record.id)}
                        className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-black hover:bg-emerald-400"
                      >
                        Save &amp; Recalculate Score
                      </button>
                    </div>
                  </div>
                )}

                {/* Inspect JSON Pair Inspector */}
                {isJsonExpanded && (
                  <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3 space-y-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#71717A]">
                      <span>Structured Pair Inspection (Input -&gt; Target Output)</span>
                      <button
                        type="button"
                        onClick={() => setExpandedJsonId(null)}
                        className="hover:text-[#FAFAFA]"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      <div className="rounded border border-[#27272A] bg-[#111113] p-2.5">
                        <div className="text-[10px] font-bold text-[#71717A] mb-1">
                          RAW INPUT (DOM)
                        </div>
                        <pre className="whitespace-pre-wrap break-all text-[#A1A1AA]">
                          {JSON.stringify(record.rawInput, null, 2)}
                        </pre>
                      </div>

                      <div className="rounded border border-[#27272A] bg-[#111113] p-2.5">
                        <div className="text-[10px] font-bold text-emerald-400 mb-1">
                          TARGET OUTPUT
                        </div>
                        <pre className="whitespace-pre-wrap break-all text-[#FAFAFA]">
                          {JSON.stringify(record.targetOutput, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Export Training Dataset Modal */}
      <ExportDatasetModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        records={records}
        apiConfig={apiConfig}
        onSaveApiConfig={handleSaveApiConfig}
      />
    </div>
  );
}
