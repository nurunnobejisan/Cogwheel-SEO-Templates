"use client";

import { useState } from "react";
import { Button } from "./ui";
import { downloadManager, downloadTextWithCountdown } from "@/lib/download-manager";

interface VisibilitySuiteModalProps {
  property?: {
    name?: string;
    brand?: string;
    city?: string;
    state?: string;
    url?: string;
  };
  onClose: () => void;
  onImportScore?: (score: number) => void;
}

export function VisibilitySuiteModal({
  property,
  onClose,
  onImportScore,
}: VisibilitySuiteModalProps) {
  const propertyName = property?.name || "Renaissance Shoals Resort & Spa";
  const propertyUrl =
    property?.url ||
    "https://www.marriott.com/en-us/hotels/mslbr-renaissance-shoals-resort-and-spa/overview/";
  const propertyCity = property?.city || "Florence";
  const propertyState = property?.state || "AL";

  const [activeTab, setActiveTab] = useState<"export" | "api" | "import">("export");
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteJson, setPasteJson] = useState("");

  const batchPayload = {
    organization: {
      brandName: propertyName,
      domain: propertyUrl,
      city: propertyCity,
      state: propertyState,
      source: "Cogwheel SEO Templates v2.4",
    },
    promptsBatch: [
      {
        prompt: `Best boutique hotel with river view and spa in ${propertyCity} ${propertyState}`,
        category: "Discovery",
        targetEngines: ["ChatGPT", "Perplexity", "Google AI Overviews"],
      },
      {
        prompt: `Does ${propertyName} allow pets and what are the pet fees?`,
        category: "Amenities",
        targetEngines: ["Google AI Overviews", "ChatGPT"],
      },
      {
        prompt: `Spa packages and treatment pricing at ${propertyName}`,
        category: "Spa & Wellness",
        targetEngines: ["Perplexity", "ChatGPT"],
      },
      {
        prompt: `Where to stay near downtown ${propertyCity} with riverfront fine dining`,
        category: "Dining",
        targetEngines: ["ChatGPT", "Google AI Overviews"],
      },
      {
        prompt: `Corporate meeting and wedding venues at ${propertyName}`,
        category: "Groups & Events",
        targetEngines: ["Copilot", "Perplexity"],
      },
    ],
    competitors: [
      { name: "GunRunner Boutique Hotel", domain: "gunrunnerhotel.com" },
      { name: "Courtyard Florence", domain: "marriott.com" },
      { name: "Hampton Inn Downtown", domain: "hilton.com" },
    ],
  };

  const jsonString = JSON.stringify(batchPayload, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    const filename = `${propertyName.replace(/[^a-zA-Z0-9]/g, "_")}_VisibilitySuite_Batch.json`;
    downloadTextWithCountdown(filename, jsonString, "application/json", 3);
  };

  const handleDownloadCsv = () => {
    const filename = `${propertyName.replace(/[^a-zA-Z0-9]/g, "_")}_VisibilitySuite_Prompts.csv`;
    const csvContent = [
      ["Prompt", "Category", "Target Engines", "Target Property", "Domain"].join(","),
      ...batchPayload.promptsBatch.map((p) =>
        [
          `"${p.prompt.replace(/"/g, '""')}"`,
          `"${p.category}"`,
          `"${p.targetEngines.join("; ")}"`,
          `"${propertyName.replace(/"/g, '""')}"`,
          `"${propertyUrl}"`,
        ].join(",")
      ),
    ].join("\n");

    downloadTextWithCountdown(filename, csvContent, "text/csv;charset=utf-8", 3);
  };

  const handleDirectSync = async () => {
    if (!apiKey.trim()) {
      setSyncStatus({
        type: "error",
        msg: "Please enter your VisibilitySuite API Key (found in your VisibilitySuite Dashboard Settings).",
      });
      return;
    }
    setSyncBusy(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/visibility-suite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_api",
          apiKey: apiKey.trim(),
          workspaceId: workspaceId.trim(),
          property: {
            name: propertyName,
            url: propertyUrl,
            city: propertyCity,
            state: propertyState,
          },
          prompts: batchPayload.promptsBatch,
          competitors: batchPayload.competitors,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to sync with VisibilitySuite API.");
      }
      setSyncStatus({
        type: "success",
        msg: "Data successfully synced to VisibilitySuite.ai. Check your dashboard.",
      });
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        msg: err.message || "Could not connect to VisibilitySuite API.",
      });
    } finally {
      setSyncBusy(false);
    }
  };

  const handleImportReport = () => {
    if (!pasteJson.trim()) {
      setSyncStatus({ type: "error", msg: "Paste VisibilitySuite snapshot JSON or score first." });
      return;
    }
    try {
      let score = 82;
      try {
        const parsed = JSON.parse(pasteJson);
        score = parsed.score || parsed.citationScore || parsed.geoScore || 82;
      } catch {
        const matchedNum = pasteJson.match(/\b([0-9]{2,3})\b/);
        if (matchedNum) score = parseInt(matchedNum[1], 10);
      }
      if (onImportScore) onImportScore(score);
      setSyncStatus({
        type: "success",
        msg: `Successfully imported VisibilitySuite score (${score}%) into your GEO Radar.`,
      });
    } catch (err: any) {
      setSyncStatus({ type: "error", msg: "Invalid format. Paste JSON from VisibilitySuite." });
    }
  };

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-300 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
            Integration Connector
          </div>
          <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
            Connect with VisibilitySuite.ai
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Sync <span className="font-semibold text-slate-800 dark:text-slate-200">{propertyName}</span> data, AI prompts, and comp-set tracking with your VisibilitySuite dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://app.visibilitysuite.ai/sign-in?redirectUrl=%2Fdashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700"
          >
            Sign In to VisibilitySuite
          </a>
          <Button variant="ghost" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("export")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "export"
              ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          1-Click Batch Export (Recommended)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("api")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "api"
              ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          Direct API Sync
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("import")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "import"
              ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          Import Citation Report
        </button>
      </div>

      {syncStatus && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-semibold ${
            syncStatus.type === "success"
              ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
          }`}
        >
          {syncStatus.msg}
        </div>
      )}

      {/* Tab 1: Export */}
      {activeTab === "export" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Prepared VisibilitySuite Batch Payload
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Includes your property details, 5 conversational GEO prompts targeting ChatGPT, Perplexity &amp; Google AI Overviews, and 3 local comp-set competitors.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400">Brand Domain</span>
                <div className="font-semibold text-slate-800 dark:text-white truncate">{propertyUrl}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400">Prompts Count</span>
                <div className="font-semibold text-slate-800 dark:text-white">5 High-Intent Prompts</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400">Competitors</span>
                <div className="font-semibold text-slate-800 dark:text-white">3 Local Properties</div>
              </div>
            </div>

            <div className="mt-3">
              <pre className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] text-purple-300 dark:border-slate-800">
                {jsonString}
              </pre>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleCopyJson} className="text-xs">
                {copied ? "Copied JSON" : "Copy Payload"}
              </Button>
              <Button variant="secondary" onClick={handleDownloadCsv} className="text-xs">
                Download Prompts CSV
              </Button>
            </div>

            <Button variant="primary" onClick={handleDownloadJson} className="text-xs">
              Download VisibilitySuite Batch File (.json)
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: API Direct Sync */}
      {activeTab === "api" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Direct VisibilitySuite API v1 Sync
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Push your property prompts and compset radar directly into your VisibilitySuite account without manual file uploads.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">VisibilitySuite API Key / Bearer Token</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste vs_live_... or Clerk Bearer token"
                  className="input font-mono text-xs"
                />
                <span className="mt-1 block text-[10px] text-slate-400">
                  Found under VisibilitySuite &gt; Settings &gt; Developer / API Keys.
                </span>
              </div>

              <div>
                <label className="label">Workspace ID (Optional)</label>
                <input
                  type="text"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="e.g. ws_948274"
                  className="input font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={syncBusy}
              onClick={handleDirectSync}
              className="text-xs"
            >
              {syncBusy ? "Syncing..." : "Push Data to VisibilitySuite.ai"}
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Import Report */}
      {activeTab === "import" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Import VisibilitySuite Citation Report
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Paste the snapshot JSON report or citation percentage from VisibilitySuite to calibrate your active GEO Readiness Radar.
            </p>

            <div className="mt-3">
              <textarea
                value={pasteJson}
                onChange={(e) => setPasteJson(e.target.value)}
                placeholder='Paste VisibilitySuite report JSON or citation score (e.g. { "score": 84, "citations": [...] })'
                rows={5}
                className="input font-mono text-xs resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" onClick={handleImportReport} className="text-xs">
              Calibrate GEO Radar with Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
