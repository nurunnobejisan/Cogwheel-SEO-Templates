import React, { useState, useEffect } from "react";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus,
  Save,
  Database,
  Radio,
  ExternalLink,
} from "lucide-react";
import {
  ExtensionOptions,
  DEFAULT_OPTIONS,
  loadExtensionOptions,
  saveExtensionOptions,
} from "../utils/extensionOptions";
import {
  getAllTrainingPairs,
  clearTrainingVault,
  deleteSamplesByDomain,
  getTrainingVaultStats,
  TrainingVaultStats,
} from "../storage/training-vault";

export function OptionsApp() {
  const [options, setOptions] = useState<ExtensionOptions>(DEFAULT_OPTIONS);
  const [stats, setStats] = useState<TrainingVaultStats | null>(null);
  const [domainsInVault, setDomainsInVault] = useState<Array<{ domain: string; count: number }>>([]);
  const [newAllowlist, setNewAllowlist] = useState("");
  const [newBlocklist, setNewBlocklist] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const loaded = await loadExtensionOptions();
    setOptions(loaded);

    try {
      const vaultStats = await getTrainingVaultStats();
      setStats(vaultStats);
      const all = await getAllTrainingPairs();
      const domainMap = new Map<string, number>();
      all.forEach((r) => {
        const d = r.domain || "unknown";
        domainMap.set(d, (domainMap.get(d) || 0) + 1);
      });
      setDomainsInVault(
        Array.from(domainMap.entries()).map(([domain, count]) => ({ domain, count }))
      );
    } catch {
      // Handled silently
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    await saveExtensionOptions(options);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);

    // Update active tab badge if auto capture is on
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: "SET_RECORDING_BADGE",
        isRecording: options.consent && options.captureMode === "auto",
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  };

  const handleAddAllowlist = () => {
    const val = newAllowlist.trim().toLowerCase();
    if (val && !options.allowlistDomains.includes(val)) {
      setOptions({
        ...options,
        allowlistDomains: [...options.allowlistDomains, val],
      });
      setNewAllowlist("");
    }
  };

  const handleRemoveAllowlist = (d: string) => {
    setOptions({
      ...options,
      allowlistDomains: options.allowlistDomains.filter((x) => x !== d),
    });
  };

  const handleAddBlocklist = () => {
    const val = newBlocklist.trim().toLowerCase();
    if (val && !options.blocklistDomains.includes(val)) {
      setOptions({
        ...options,
        blocklistDomains: [...options.blocklistDomains, val],
      });
      setNewBlocklist("");
    }
  };

  const handleRemoveBlocklist = (d: string) => {
    setOptions({
      ...options,
      blocklistDomains: options.blocklistDomains.filter((x) => x !== d),
    });
  };

  const handleDeleteAll = async () => {
    if (confirm("Are you sure you want to permanently delete all training samples in your local vault?")) {
      await clearTrainingVault();
      await loadData();
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    if (confirm(`Delete all training samples captured from ${domain}?`)) {
      await deleteSamplesByDomain(domain);
      await loadData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 font-sans max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 shadow-lg shadow-emerald-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              SEO Studio Extension Settings & Training Guardrails
            </h1>
            <p className="text-xs text-slate-400">
              Configure safe training data collection, domain allowlists/blocklists, and API synchronization
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-950 transition-all shadow-md shadow-emerald-500/20"
        >
          <Save className="h-4 w-4" />
          <span>Save Changes</span>
        </button>
      </header>

      {saveSuccess && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      <main className="space-y-6">
        {/* Section 1: Consent & Capture Mode */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-400" />
            1. Safe Training Data Collection Consent
          </h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            SEO Studio can extract clean, anonymized webpage structures (H1-H6, JSON-LD, metadata, and Core Web Vitals) to build high-quality fine-tuning datasets for hotel search optimization. Personal identifiable information, credit cards, JWTs, and passwords are strictly excluded.
          </p>

          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={options.consent}
              onChange={(e) => setOptions({ ...options, consent: e.target.checked })}
              className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-200">
                Enable Training Data Collection (Consent)
              </span>
              <p className="text-xs text-slate-400">
                Off by default. When enabled, allows manual or auto-capture on authorized domains.
              </p>
            </div>
          </label>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div
              onClick={() => setOptions({ ...options, captureMode: "manual" })}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                options.captureMode === "manual"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 font-medium text-sm text-white mb-1">
                <input
                  type="radio"
                  name="captureMode"
                  checked={options.captureMode === "manual"}
                  onChange={() => setOptions({ ...options, captureMode: "manual" })}
                  className="text-emerald-500"
                />
                Manual Capture Only (Recommended)
              </div>
              <p className="text-xs text-slate-400 pl-5">
                Capture samples only when you click "Extract Sample" in the extension popup or side panel.
              </p>
            </div>

            <div
              onClick={() => setOptions({ ...options, captureMode: "auto" })}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                options.captureMode === "auto"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 font-medium text-sm text-white mb-1">
                <input
                  type="radio"
                  name="captureMode"
                  checked={options.captureMode === "auto"}
                  onChange={() => setOptions({ ...options, captureMode: "auto" })}
                  className="text-emerald-500"
                />
                Auto-Capture on Allowlisted Domains
              </div>
              <p className="text-xs text-slate-400 pl-5">
                Automatically extracts and versions samples on navigation when on allowlisted hotel domains. Shows "REC" badge.
              </p>
            </div>
          </div>
        </article>

        {/* Section 2: Allowlist & Blocklist */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield className="h-4 w-4 text-sky-400" />
            2. Domain Guardrails (Allowlist & Blocklist)
          </h2>

          {/* Allowlist */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Auto-Capture Allowlist Domains
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="e.g. marriott.com or hilton.com"
                value={newAllowlist}
                onChange={(e) => setNewAllowlist(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAllowlist()}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddAllowlist}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {options.allowlistDomains.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300"
                >
                  {d}
                  <button
                    onClick={() => handleRemoveAllowlist(d)}
                    className="hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Blocklist */}
          <div className="border-t border-slate-800/80 pt-4">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Security Blocklist (Capture Strictly Forbidden)
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Includes banking, personal email, social media, checkout, login, and any page containing a password field.
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="e.g. bank.com"
                value={newBlocklist}
                onChange={(e) => setNewBlocklist(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddBlocklist()}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddBlocklist}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {options.blocklistDomains.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-300"
                >
                  {d}
                  <button
                    onClick={() => handleRemoveBlocklist(d)}
                    className="hover:text-red-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Section 3: API Sync Configuration */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-emerald-400" />
            3. Web App API Synchronization
          </h2>
          <p className="text-xs text-slate-400">
            Configure the endpoint to push curated training records to the SEO Studio Web App API with Bearer token authentication.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                API Endpoint URL
              </label>
              <input
                type="text"
                value={options.apiUrl}
                onChange={(e) => setOptions({ ...options, apiUrl: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bearer Auth Token
              </label>
              <input
                type="password"
                placeholder="Optional Bearer Token"
                value={options.apiToken}
                onChange={(e) => setOptions({ ...options, apiToken: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </article>

        {/* Section 4: Vault Storage & Domain Deletion */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-400" />
              4. Local Vault Management & Privacy
            </h2>
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete All Vault Data
            </button>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                <span className="text-xl font-bold text-white tabular-nums">{stats.total}</span>
                <span className="block text-[11px] text-slate-400">Total Samples</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                <span className="text-xl font-bold text-emerald-400 tabular-nums">{stats.approved}</span>
                <span className="block text-[11px] text-slate-400">Approved</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                <span className="text-xl font-bold text-amber-400 tabular-nums">{stats.pending}</span>
                <span className="block text-[11px] text-slate-400">Pending Review</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                <span className="text-xl font-bold text-sky-400 tabular-nums">{stats.avgQualityScore}%</span>
                <span className="block text-[11px] text-slate-400">Avg Quality</span>
              </div>
            </div>
          )}

          {domainsInVault.length > 0 ? (
            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-2">
                Stored Samples by Domain:
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {domainsInVault.map((item) => (
                  <div
                    key={item.domain}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-200">{item.domain}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 tabular-nums">{item.count} samples</span>
                      <button
                        onClick={() => handleDeleteDomain(item.domain)}
                        className="text-red-400 hover:text-red-300 font-medium"
                      >
                        Delete Domain
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No samples currently stored in vault.</p>
          )}
        </article>
      </main>
    </div>
  );
}
