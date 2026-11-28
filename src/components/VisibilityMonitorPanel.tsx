"use client";

/**
 * Operator UI for measured AI/GEO visibility runs.
 *
 * Every displayed number comes from /api/visibility responses. Grounded web
 * citations and model-memory mentions are counted separately, and engines with
 * no key (or no official API) stay visibly unavailable.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui";
import type { PromptResult, ProviderId } from "@/core/visibility/types.ts";

interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  requires: string[];
  reason?: string;
  estimatedCostUsd: number;
}

interface ProviderScope {
  id: ProviderId;
  label: string;
  evidence: "web_grounded" | "model_memory" | "unavailable";
}

const SCOPES: Record<string, ProviderScope["evidence"]> = {
  gemini_grounded: "web_grounded",
  groq_llama: "model_memory",
  openrouter_free: "model_memory",
  pollinations: "model_memory",
  chatgpt: "web_grounded",
  claude: "web_grounded",
  perplexity: "web_grounded",
  gemini: "web_grounded",
  ai_overviews: "unavailable",
};

function evidenceFor(id: ProviderId): ProviderScope["evidence"] {
  return SCOPES[id] ?? "unavailable";
}

interface VisibilityMonitorPanelProps {
  property?: {
    name?: string;
    brand?: string;
    city?: string;
    state?: string;
    url?: string;
    websiteUrl?: string;
  };
}

export default function VisibilityMonitorPanel({ property }: VisibilityMonitorPanelProps) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [selected, setSelected] = useState<ProviderId[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState(property?.websiteUrl || property?.url || "");
  const [brand, setBrand] = useState(property?.brand || property?.name || "");
  const [city, setCity] = useState(property?.city || "");
  const [category, setCategory] = useState("");
  const [maxPrompts, setMaxPrompts] = useState(4);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [results, setResults] = useState<PromptResult[]>([]);
  const [runErrors, setRunErrors] = useState<string[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const response = await fetch("/api/visibility");
        if (cancelled) return;
        if (response.status === 401) {
          setStatusError("Sign in to run visibility checks. Provider keys stay on the server.");
          return;
        }
        const payload = (await response.json()) as { success?: boolean; error?: string; providers?: ProviderStatus[] };
        if (!response.ok || !payload.success || !payload.providers) {
          setStatusError(payload.error ?? "Could not load provider status");
          return;
        }
        setProviders(payload.providers);
        setSelected(payload.providers.filter((provider) => provider.configured).map((provider) => provider.id));
      } catch (error) {
        if (!cancelled) setStatusError(error instanceof Error ? error.message : "Could not load provider status");
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const configured = useMemo(() => providers.filter((provider) => provider.configured), [providers]);

  const summary = useMemo(() => {
    const measured = results.filter((row) => row.available);
    const mentioned = measured.filter((row) => row.mentioned === true);
    const groundedCitations = measured
      .filter((row) => row.citationType === "web_grounded")
      .reduce((total, row) => total + (row.ownCitations ?? 0), 0);
    const memoryMentions = measured.filter(
      (row) => row.citationType === "model_memory" && row.mentioned === true
    ).length;
    return {
      measured: measured.length,
      unmeasured: results.length - measured.length,
      mentionRate: measured.length > 0 ? Math.round((mentioned.length / measured.length) * 100) : null,
      groundedCitations,
      memoryMentions,
    };
  }, [results]);

  const toggleProvider = (id: ProviderId) => {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const runBatches = async () => {
    const id = ++requestId.current;
    setRunErrors([]);
    setResults([]);
    setHasRun(true);
    setRunning(true);
    const collected: PromptResult[] = [];
    const errors: string[] = [];
    const batches = selected.filter((providerId) => configured.some((provider) => provider.id === providerId));

    for (let index = 0; index < batches.length; index += 1) {
      const providerId = batches[index]!;
      const label = configured.find((provider) => provider.id === providerId)?.label ?? providerId;
      setProgress({ current: index + 1, total: batches.length, label });
      try {
        const response = await fetch("/api/visibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl,
            brand,
            city,
            category,
            mode: "hotel",
            maxPrompts,
            providers: [providerId],
          }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          error?: string;
          details?: string;
          run?: { results: PromptResult[] };
        };
        if (requestId.current !== id) return;
        if (!response.ok || !payload.success || !payload.run) {
          errors.push(`${label}: ${payload.error || payload.details || `HTTP ${response.status}`}`);
          continue;
        }
        collected.push(...payload.run.results);
      } catch (error) {
        if (requestId.current !== id) return;
        errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (requestId.current !== id) return;
    setResults(collected);
    setRunErrors(errors);
    setProgress(null);
    setRunning(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-caption text-slate-500 dark:text-slate-400">
          Brand mentions and citations are measured from live provider answers. Gemini 2.x reports
          web-grounded sources; Groq, OpenRouter free and Pollinations report model-memory answers
          only. No citation rate is shown for an engine that has no configured access.
        </p>
      </div>

      {statusLoading && <p className="text-caption italic text-slate-500">Loading provider status…</p>}

      {statusError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-caption text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Visibility measurement is not available.</strong> {statusError}
        </div>
      )}

      {!statusLoading && !statusError && configured.length === 0 && (
        <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50/40 p-5 dark:border-purple-900/60 dark:bg-purple-950/20">
          <p className="font-semibold text-slate-800 dark:text-slate-200">No free visibility provider is enabled</p>
          <p className="mt-1 text-caption text-slate-600 dark:text-slate-400">
            Opt in on the server with <code className="font-mono">VISIBILITY_FREE_PROVIDERS_ENABLED=true</code> plus
            <code className="font-mono"> GEMINI_API_KEY</code>, <code className="font-mono">GROQ_API_KEY</code> or
            <code className="font-mono"> OPENROUTER_API_KEY</code>. The keyless Pollinations path needs
            <code className="font-mono"> POLLINATIONS_ENABLED=true</code>. Secrets are never sent to the browser.
            Google AI Overviews has no official API and stays unavailable.
          </p>
        </div>
      )}

      {providers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => {
            const evidence = evidenceFor(provider.id);
            return (
              <label
                key={provider.id}
                className={`rounded-xl border p-3 text-caption ${
                  provider.configured
                    ? "cursor-pointer border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(provider.id)}
                      disabled={!provider.configured || running}
                      onChange={() => toggleProvider(provider.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{provider.label}</div>
                      <div className="text-micro text-slate-500 dark:text-slate-400">
                        {evidence === "web_grounded"
                          ? "web-grounded citations"
                          : evidence === "model_memory"
                            ? "model memory — no citations"
                            : "no official API"}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-micro font-bold ${
                      provider.configured
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {provider.configured ? "available" : "not connected"}
                  </span>
                </div>
                {!provider.configured && provider.reason && (
                  <p className="mt-2 text-micro text-slate-500 dark:text-slate-400">{provider.reason}</p>
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="visibility-url">Target URL</label>
          <input
            id="visibility-url"
            className="input font-mono text-caption"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder="https://example.com"
          />
        </div>
        <div>
          <label className="label" htmlFor="visibility-brand">Brand to detect</label>
          <input
            id="visibility-brand"
            className="input text-caption"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder="Property or company name"
          />
        </div>
        <div>
          <label className="label" htmlFor="visibility-city">City (optional)</label>
          <input
            id="visibility-city"
            className="input text-caption"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Denver"
          />
        </div>
        <div>
          <label className="label" htmlFor="visibility-category">Category (optional)</label>
          <input
            id="visibility-category"
            className="input text-caption"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="boutique hotel"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-caption text-slate-600 dark:text-slate-300" htmlFor="visibility-prompts">
          Prompts per engine
        </label>
        <select
          id="visibility-prompts"
          className="input w-auto text-caption"
          value={maxPrompts}
          onChange={(event) => setMaxPrompts(Number(event.target.value))}
          disabled={running}
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
        </select>
        <Button variant="primary" onClick={() => void runBatches()} disabled={running || selected.length === 0 || !targetUrl.trim()}>
          {running ? "Running…" : `Run ${selected.length || ""} selected engine${selected.length === 1 ? "" : "s"}`}
        </Button>
        {progress && (
          <span className="text-caption text-slate-500 dark:text-slate-400" role="status">
            Batch {progress.current} of {progress.total}: {progress.label}
          </span>
        )}
      </div>

      {runErrors.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-caption text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <strong>Some engines could not be queried:</strong>
          <ul className="mt-1 list-disc pl-5">
            {runErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

      {hasRun && !running && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-caption text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No answers were measured. Check the engine status above and the error messages, then run again.
          No mention or citation values are estimated.
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Measured answers", value: String(summary.measured) },
              { label: "Unmeasured", value: String(summary.unmeasured) },
              { label: "Mention rate", value: summary.mentionRate === null ? "—" : `${summary.mentionRate}%` },
              { label: "Grounded own citations", value: String(summary.groundedCitations) },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-micro font-bold uppercase tracking-wider text-slate-500">{metric.label}</div>
                <div className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">{metric.value}</div>
              </div>
            ))}
          </div>
          <p className="text-caption text-slate-600 dark:text-slate-400">
            Separate from grounded citations: <strong>{summary.memoryMentions}</strong> model-memory answer
            {summary.memoryMentions === 1 ? "" : "s"} mentioned the brand without a live source. These are never
            counted as citations.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[720px] text-left text-caption">
              <thead className="bg-slate-50 text-micro uppercase tracking-wider text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2">Engine</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Prompt</th>
                  <th className="px-3 py-2">Mention</th>
                  <th className="px-3 py-2">Evidence</th>
                  <th className="px-3 py-2">Own citations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((row, index) => (
                  <tr key={`${row.provider}-${row.promptId}-${index}`} className="align-top">
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                      {providers.find((provider) => provider.id === row.provider)?.label ?? row.provider}
                    </td>
                    <td className="px-3 py-2 font-mono text-micro text-slate-500 dark:text-slate-400">{row.model ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.prompt}</td>
                    <td className="px-3 py-2">
                      {!row.available ? (
                        <span className="text-slate-400">not measured</span>
                      ) : row.mentioned ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">mentioned</span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-300">absent</span>
                      )}
                      {!row.available && row.reason && (
                        <div className="text-micro text-slate-400">{row.reason}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {row.citationType === "web_grounded"
                        ? "web-grounded"
                        : row.citationType === "model_memory"
                          ? "model memory"
                          : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.available && row.citationType === "web_grounded" ? (row.ownCitations ?? 0) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
