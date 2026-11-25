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
  onImportBatch?: (batchData: {
    property: { name: string; brand: string; city: string; state: string; url: string };
    competitors?: Array<{ name: string; domain: string }>;
    prompts?: Array<{ prompt?: string; text?: string; category?: string }>;
  }) => void;
}

export function VisibilitySuiteModal({
  property,
  onClose,
  onImportScore,
  onImportBatch,
}: VisibilitySuiteModalProps) {
  const propertyName = property?.name?.trim() || "";
  const propertyUrl = property?.url?.trim() || "";
  const propertyCity = property?.city?.trim() || "";
  const propertyState = property?.state?.trim() || "";
  const displayName = propertyName || "[property name]";
  const locationLabel = [propertyCity, propertyState].filter(Boolean).join(", ") || "[city, state]";

  const [activeTab, setActiveTab] = useState<"export" | "ingest" | "api" | "import">("ingest");
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteJson, setPasteJson] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importedSummary, setImportedSummary] = useState<string | null>(null);
  const [loadedBatch, setLoadedBatch] = useState<{
    property: { name: string; brand: string; city: string; state: string; url: string };
    competitors: Array<{ name: string; domain: string }>;
    prompts: Array<{ prompt: string; category: string; targetEngines: string[] }>;
  } | null>(null);

  // Competitors are operator-supplied: one `Name, domain` pair per line.
  // The modal never guesses comp-set names or domains.
  const [competitorsText, setCompetitorsText] = useState("");
  const competitors = competitorsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, domain] = line.split(",").map((part) => part.trim());
      return { name: name || domain || "", domain: domain || "" };
    })
    .filter((competitor) => competitor.name && competitor.domain);

  const batchPayload = {
    organization: {
      brandName: propertyName,
      domain: propertyUrl,
      city: propertyCity,
      state: propertyState,
      source: "Cogwheel SEO Templates",
    },
    promptsBatch: [
      {
        prompt: `Best boutique hotel with river view and spa in ${locationLabel}`,
        category: "Discovery",
        targetEngines: ["ChatGPT", "Perplexity", "Google AI Overviews"],
      },
      {
        prompt: `Does ${displayName} allow pets and what are the pet fees?`,
        category: "Amenities",
        targetEngines: ["Google AI Overviews", "ChatGPT"],
      },
      {
        prompt: `Spa packages and treatment pricing at ${displayName}`,
        category: "Spa & Wellness",
        targetEngines: ["Perplexity", "ChatGPT"],
      },
      {
        prompt: `Where to stay near downtown ${propertyCity || "[city]"} with riverfront fine dining`,
        category: "Dining",
        targetEngines: ["ChatGPT", "Google AI Overviews"],
      },
      {
        prompt: `Corporate meeting and wedding venues at ${displayName}`,
        category: "Groups & Events",
        targetEngines: ["Copilot", "Perplexity"],
      },
    ],
    competitors,
  };

  const jsonString = JSON.stringify(batchPayload, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(jsonString);
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

  const processBatchJsonString = (rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.organization) {
        const org = parsed.organization;
        const newProperty = {
          name: org.brandName || propertyName,
          brand: org.brandName || propertyName,
          city: org.city || propertyCity,
          state: org.state || propertyState,
          url: org.domain || propertyUrl,
        };
        const competitors = Array.isArray(parsed.competitors) ? parsed.competitors : [];
        const prompts = Array.isArray(parsed.promptsBatch) ? parsed.promptsBatch : [];

        onImportBatch?.({
          property: newProperty,
          competitors,
          prompts,
        });

        setLoadedBatch({
          property: newProperty,
          competitors,
          prompts,
        });

        setImportedSummary(
          `Loaded "${newProperty.name}" (${newProperty.city}, ${newProperty.state}) with ${competitors.length} competitors and ${prompts.length} prompts.`
        );
        setSyncStatus({
          type: "success",
          msg: `Batch file ingested! Active hotel updated to ${newProperty.name}.`,
        });
        return true;
      } else if (
        typeof (parsed.score ?? parsed.citationScore ?? parsed.geoScore) === "number"
      ) {
        const score = Number(parsed.score ?? parsed.citationScore ?? parsed.geoScore);
        onImportScore?.(score);
        setSyncStatus({
          type: "success",
          msg: `Imported VisibilitySuite score: ${score}%`,
        });
        return true;
      } else {
        throw new Error("Missing organization or score keys in JSON.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncStatus({
        type: "error",
        msg: `Failed to parse batch JSON: ${msg}`,
      });
      return false;
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setPasteJson(text);
          processBatchJsonString(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setPasteJson(text);
          processBatchJsonString(text);
        }
      };
      reader.readAsText(file);
    }
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
            name: displayName,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not connect to VisibilitySuite API.";
      setSyncStatus({
        type: "error",
        msg,
      });
    } finally {
      setSyncBusy(false);
    }
  };

  const handleImportReport = () => {
    if (!pasteJson.trim()) {
      setSyncStatus({ type: "error", msg: "Paste VisibilitySuite snapshot JSON or batch file first." });
      return;
    }
    processBatchJsonString(pasteJson);
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
            Sync <span className="font-semibold text-slate-800 dark:text-slate-200">{displayName}</span> data, AI prompts, and comp-set tracking with your VisibilitySuite dashboard.
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
          onClick={() => setActiveTab("ingest")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "ingest"
              ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          Drop Batch JSON (Fast Import)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("export")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "export"
              ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          1-Click Batch Export
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
          Paste Raw Report
        </button>
      </div>

      {syncStatus && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-medium ${
            syncStatus.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {syncStatus.msg}
        </div>
      )}

      {/* Tab 1: Drop Batch JSON (Fast Ingestion) */}
      {activeTab === "ingest" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
              isDragging
                ? "border-purple-500 bg-purple-50/70 dark:bg-purple-950/40"
                : "border-slate-300 bg-slate-50/60 hover:border-purple-400 dark:border-slate-700 dark:bg-slate-800/40"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-950/80">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="mt-3 font-display text-sm font-bold text-slate-900 dark:text-white">
              Drop VisibilitySuite Batch File Here
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              Drag and drop any <code className="rounded bg-slate-200 px-1 py-0.5 text-slate-800 dark:bg-slate-700 dark:text-slate-200">*__VisibilitySuite_Batch.json</code> file to auto-configure this property.
            </p>

            <div className="mt-4">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700">
                Browse Files
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {loadedBatch ? (
            <div className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-900/60 dark:bg-purple-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                    Ingested Batch Property
                  </span>
                  <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {loadedBatch.property.name}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {loadedBatch.property.city}, {loadedBatch.property.state} &bull; <span className="font-mono text-[11px] text-purple-700 dark:text-purple-400">{loadedBatch.property.url}</span>
                  </p>
                </div>
                <Button variant="primary" onClick={onClose} className="text-xs">
                  Apply &amp; Return to Dashboard
                </Button>
              </div>

              {loadedBatch.competitors.length > 0 && (
                <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Comp-Set Competitors Ingested ({loadedBatch.competitors.length}):
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {loadedBatch.competitors.map((comp, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 dark:border-purple-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {comp.name} <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400">({comp.domain})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {loadedBatch.prompts.length > 0 && (
                <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    GEO Search Prompts Ingested ({loadedBatch.prompts.length}):
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {loadedBatch.prompts.map((p, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-purple-100/80 px-2 py-0.5 text-[10px] font-semibold text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
                      >
                        {p.category}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : importedSummary ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-3.5 text-xs text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300">
              <div className="font-bold">Active Property Configured:</div>
              <div className="mt-0.5 text-[11px]">{importedSummary}</div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">What gets auto-filled:</span>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Hotel name, brand, official URL, and city/state location</li>
              <li>Comp-set competitor domains &amp; names that you enter (never guessed)</li>
              <li>GEO AI prompts calibrated for ChatGPT Search, Google AI Overviews &amp; Perplexity</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: 1-Click Batch Export */}
      {activeTab === "export" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Export AI Prompts &amp; Comp-Set Batch
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Download this prepared JSON configuration to upload directly into VisibilitySuite.ai batch processor.
            </p>

            <div className="mt-3">
              <label className="label">Competitors (one per line: Name, domain)</label>
              <textarea
                value={competitorsText}
                onChange={(e) => setCompetitorsText(e.target.value)}
                rows={3}
                placeholder={"GunRunner Boutique Hotel, gunrunnerhotel.com\nCourtyard Florence, marriott.com"}
                className="input font-mono text-xs resize-y"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Leave blank to export prompts without a comp-set. Domains are not generated.
              </p>
            </div>

            <div className="mt-3">
              <pre className="max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-emerald-400">
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

      {/* Tab 3: API Direct Sync */}
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

      {/* Tab 4: Paste Raw Report */}
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
