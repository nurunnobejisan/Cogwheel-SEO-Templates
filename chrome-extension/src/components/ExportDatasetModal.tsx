import React, { useState, useMemo } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  Cpu,
  Terminal,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { TrainingPairRecord } from "../storage/training-vault";
import {
  buildGeminiJsonl,
  buildChatMlJsonl,
  filterRecords,
  estimateTokenCount,
  ApiSyncConfig,
  syncBatchToApi,
  BatchSyncSummary,
} from "../../../shared/ts/dataset-builder";

export interface ExportDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: TrainingPairRecord[];
  apiConfig: ApiSyncConfig;
  onSaveApiConfig: (config: ApiSyncConfig) => void;
}

export function ExportDatasetModal({
  isOpen,
  onClose,
  records,
  apiConfig,
  onSaveApiConfig,
}: ExportDatasetModalProps) {
  const [activeFormat, setActiveFormat] = useState<"gemini" | "chatml" | "api">("gemini");
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedBrand, setSelectedBrand] = useState<string>("All");
  const [copied, setCopied] = useState(false);

  // API Sync Form State
  const [endpointUrl, setEndpointUrl] = useState(apiConfig.endpointUrl || "");
  const [bearerToken, setBearerToken] = useState(apiConfig.bearerToken || "");
  const [autoSyncOnApproval, setAutoSyncOnApproval] = useState(
    Boolean(apiConfig.autoSyncOnApproval)
  );
  const [showToken, setShowToken] = useState(false);
  const [syncingApi, setSyncingApi] = useState(false);
  const [syncResult, setSyncResult] = useState<BatchSyncSummary | null>(null);
  const [configSavedToast, setConfigSavedToast] = useState(false);

  const filteredRecords = useMemo(() => {
    return filterRecords(records, {
      onlyApproved,
      minQualityScore: minScore > 0 ? minScore : undefined,
      brandFilter: selectedBrand !== "All" ? selectedBrand : undefined,
    });
  }, [records, onlyApproved, minScore, selectedBrand]);

  const jsonlOutput = useMemo(() => {
    if (activeFormat === "gemini") {
      return buildGeminiJsonl(records, {
        onlyApproved,
        minQualityScore: minScore > 0 ? minScore : undefined,
        brandFilter: selectedBrand !== "All" ? selectedBrand : undefined,
      });
    } else if (activeFormat === "chatml") {
      return buildChatMlJsonl(records, {
        onlyApproved,
        minQualityScore: minScore > 0 ? minScore : undefined,
        brandFilter: selectedBrand !== "All" ? selectedBrand : undefined,
        includeMetadata: true,
      });
    }
    return "";
  }, [records, activeFormat, onlyApproved, minScore, selectedBrand]);

  const tokenEstimate = useMemo(() => {
    return estimateTokenCount(jsonlOutput);
  }, [jsonlOutput]);

  const previewSnippet = useMemo(() => {
    if (!jsonlOutput) return "No samples matching filter criteria.";
    const firstLine = jsonlOutput.split("\n")[0];
    try {
      return JSON.stringify(JSON.parse(firstLine), null, 2);
    } catch {
      return firstLine;
    }
  }, [jsonlOutput]);

  const handleCopy = () => {
    if (!jsonlOutput) return;
    navigator.clipboard.writeText(jsonlOutput).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!jsonlOutput) return;
    const filename = `seo-studio_${activeFormat}_sft_${new Date().toISOString().slice(0, 10)}.jsonl`;
    const blob = new Blob([jsonlOutput], { type: "application/jsonlines;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveConfig = () => {
    const updated: ApiSyncConfig = {
      endpointUrl: endpointUrl.trim(),
      bearerToken: bearerToken.trim(),
      autoSyncOnApproval,
    };
    onSaveApiConfig(updated);
    setConfigSavedToast(true);
    setTimeout(() => setConfigSavedToast(false), 2500);
  };

  const handleTriggerBatchSync = async () => {
    if (!endpointUrl.trim()) return;
    setSyncingApi(true);
    setSyncResult(null);

    const config: ApiSyncConfig = {
      endpointUrl: endpointUrl.trim(),
      bearerToken: bearerToken.trim(),
      autoSyncOnApproval,
    };

    try {
      const summary = await syncBatchToApi(filteredRecords, config);
      setSyncResult(summary);
    } catch (err) {
      setSyncResult({
        total: filteredRecords.length,
        successful: 0,
        failed: filteredRecords.length,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    } finally {
      setSyncingApi(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-[#27272A] bg-[#09090B] text-[#FAFAFA] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] bg-[#111113] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#27272A] bg-[#18181B] text-[#FAFAFA]">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#FAFAFA]">
                Export Training Dataset
              </h2>
              <p className="text-[11px] text-[#A1A1AA]">
                Format-compliant JSONL outputs for model fine-tuning and REST webhook synchronization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#71717A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex border-b border-[#27272A] bg-[#09090B] px-5 pt-2 gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveFormat("gemini")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition ${
              activeFormat === "gemini"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Google Gemini SFT</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFormat("chatml")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition ${
              activeFormat === "chatml"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>OpenAI / ChatML</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFormat("api")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition ${
              activeFormat === "api"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-[#71717A] hover:text-[#FAFAFA]"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Direct App API Sync</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Filtering Controls */}
          <div className="rounded-lg border border-[#27272A] bg-[#111113] p-3 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Dataset Filters
              </span>
              <span className="font-mono tabular-nums text-emerald-400">
                {filteredRecords.length} / {records.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2">
                <input
                  type="checkbox"
                  checked={onlyApproved}
                  onChange={(e) => setOnlyApproved(e.target.checked)}
                  className="rounded border-[#27272A] text-emerald-500 focus:ring-0"
                />
                <span className="text-[#FAFAFA]">Approved Only</span>
              </label>

              <div>
                <select
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-2 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
                >
                  <option value={0}>All Quality Scores</option>
                  <option value={70}>Quality &gt;= 70 (Standard)</option>
                  <option value={80}>Quality &gt;= 80 (High)</option>
                  <option value={90}>Quality &gt;= 90 (Elite)</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-2 text-xs text-[#FAFAFA] focus:border-emerald-500 focus:outline-none"
                >
                  <option value="All">All Hotel Brands</option>
                  <option value="Marriott">Marriott</option>
                  <option value="Hilton">Hilton</option>
                  <option value="IHG">IHG</option>
                  <option value="Hyatt">Hyatt</option>
                  <option value="Independent">Independent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Formats: Gemini & ChatML view */}
          {(activeFormat === "gemini" || activeFormat === "chatml") && (
            <div className="space-y-3">
              {/* Token & Lines Readout */}
              <div className="flex items-center justify-between rounded-lg border border-[#27272A] bg-[#111113] px-3.5 py-2.5 text-[11px]">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[#71717A]">Lines: </span>
                    <span className="font-mono font-bold text-[#FAFAFA] tabular-nums">
                      {filteredRecords.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#71717A]">Est. Tokens: </span>
                    <span className="font-mono font-bold text-[#FAFAFA] tabular-nums">
                      ~{tokenEstimate.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#71717A]">Format: </span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {activeFormat === "gemini" ? "systemInstruction + contents" : "messages (ChatML)"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={filteredRecords.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-1.5 text-[11px] font-semibold text-[#FAFAFA] hover:bg-[#27272A] disabled:opacity-50 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-[#A1A1AA]" />
                        <span>Copy JSONL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={filteredRecords.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download .jsonl</span>
                  </button>
                </div>
              </div>

              {/* Sample Code Preview */}
              <div>
                <div className="flex items-center justify-between pb-1 text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
                  <span>First Sample Output Preview</span>
                  <span>Line 1 of {filteredRecords.length}</span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-[#27272A] bg-[#111113] p-3 font-mono text-[11px] text-[#A1A1AA] leading-relaxed">
                  <pre className="whitespace-pre-wrap break-all">{previewSnippet}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Format: Direct App API Sync View */}
          {activeFormat === "api" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#27272A] bg-[#111113] p-4 space-y-3.5">
                <div>
                  <h3 className="text-xs font-semibold text-[#FAFAFA]">
                    Direct App Webhook &amp; REST Synchronization
                  </h3>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Sync newly approved training pairs directly into your backend database via authenticated HTTP POST requests.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                      Endpoint Webhook URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://api.cogwheel-seo.com/v1/training-vault/sync"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-xs text-[#FAFAFA] placeholder-[#52525B] focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                      Authorization Bearer Token
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        placeholder="cgw_sec_..."
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        className="w-full rounded-md border border-[#27272A] bg-[#18181B] pl-8 pr-9 py-2 text-xs font-mono text-[#FAFAFA] placeholder-[#52525B] focus:border-emerald-500 focus:outline-none"
                      />
                      <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#71717A]" />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2.5 top-2.5 text-[#71717A] hover:text-[#FAFAFA]"
                      >
                        {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={autoSyncOnApproval}
                      onChange={(e) => setAutoSyncOnApproval(e.target.checked)}
                      className="rounded border-[#27272A] text-emerald-500 focus:ring-0"
                    />
                    <span className="text-[11px] text-[#FAFAFA]">
                      Automatically push to API when a sample is approved in the Studio
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between border-t border-[#27272A] pt-3">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="rounded-md border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-[#FAFAFA] hover:bg-[#27272A] transition"
                  >
                    {configSavedToast ? "Configuration Saved!" : "Save Configuration"}
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerBatchSync}
                    disabled={syncingApi || !endpointUrl.trim() || filteredRecords.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncingApi ? "animate-spin" : ""}`} />
                    <span>
                      {syncingApi
                        ? "Syncing Pairs..."
                        : `Sync ${filteredRecords.length} Records Now`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Sync Status Banner */}
              {syncResult && (
                <div
                  className={`rounded-lg border p-3 ${
                    syncResult.failed === 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {syncResult.failed === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                    <span>
                      Sync Completed: {syncResult.successful} / {syncResult.total} successful (
                      {syncResult.failed} failed)
                    </span>
                  </div>
                  {syncResult.errors.length > 0 && (
                    <div className="mt-2 text-[10px] text-amber-400 space-y-1 font-mono">
                      {syncResult.errors.slice(0, 3).map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#27272A] bg-[#111113] px-5 py-3 text-[11px] text-[#71717A]">
          <span>
            Strict Schema.org and Brand Guardrails Enforced
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#27272A] px-3 py-1 text-xs font-medium text-[#FAFAFA] hover:bg-[#18181B]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
