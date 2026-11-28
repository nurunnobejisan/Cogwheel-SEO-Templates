"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GscPanelPayload } from "@/core/gsc/panel-types.ts";
import { GSC_RANGE_PRESETS } from "@/core/gsc/presets.ts";

interface GscPerformancePanelProps {
  property?: { name?: string; brand?: string; url?: string; websiteUrl?: string };
  onUseInAudit?: (data: GscPanelPayload) => void;
}

const LOCAL_CACHE_MS = 6 * 60 * 60 * 1000;

function localKey(siteUrl: string, days: number, brandTerms: string[]): string {
  return `seo-studio:gsc:${siteUrl}:${days}:${brandTerms.join(",").toLowerCase()}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function GscPerformancePanel({ property, onUseInAudit }: GscPerformancePanelProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [properties, setProperties] = useState<Array<{ siteUrl: string; permissionLevel: string }>>([]);
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [days, setDays] = useState<number>(28);
  const [brandTerms, setBrandTerms] = useState<string>(property?.brand ?? "");
  const [data, setData] = useState<GscPanelPayload | null>(null);
  const [cacheLabel, setCacheLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copyText, setCopyText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const requestId = useRef(0);

  const terms = useMemo(
    () => brandTerms.split(/[,\n]/).map((term) => term.trim()).filter(Boolean),
    [brandTerms]
  );
  const termsRef = useRef(terms);
  termsRef.current = terms;

  const load = useCallback(async (targetSite: string, targetDays: number, targetTerms: string[]) => {
    if (!targetSite) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    setCopyText(null);
    const key = localKey(targetSite, targetDays, targetTerms);

    try {
      const cachedRaw = window.localStorage.getItem(key);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { storedAt: number; data: GscPanelPayload };
        if (Date.now() - cached.storedAt < LOCAL_CACHE_MS && requestId.current === id) {
          setData(cached.data);
          setCacheLabel("browser cache (6h)");
          setLoading(false);
          return;
        }
        window.localStorage.removeItem(key);
      }

      const response = await fetch("/api/gsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: targetSite, days: targetDays, brandTerms: targetTerms }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        copyText?: string;
        data?: GscPanelPayload;
        cache?: string;
      };
      if (requestId.current !== id) return;
      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error ?? "Could not load Search Console data");
        setCopyText(payload.copyText ?? null);
        setData(null);
        return;
      }
      setData(payload.data);
      setCacheLabel(payload.cache === "miss" ? "fresh API read" : `${payload.cache} cache (6h)`);
      window.localStorage.setItem(key, JSON.stringify({ storedAt: Date.now(), data: payload.data }));
    } catch (caught) {
      if (requestId.current === id) setError(caught instanceof Error ? caught.message : "Could not load Search Console data");
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const response = await fetch("/api/gsc");
        const payload = (await response.json()) as {
          success?: boolean;
          error?: string;
          configured?: boolean;
          properties?: Array<{ siteUrl: string; permissionLevel: string }>;
        };
        if (cancelled) return;
        if (response.status === 401) {
          setConfigured(false);
          setError("Sign in to load Search Console data. Credentials stay on the server.");
          return;
        }
        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Could not check Search Console configuration");
          setConfigured(false);
          return;
        }
        setConfigured(Boolean(payload.configured));
        setProperties(payload.properties ?? []);
        const preferredHost = (property?.websiteUrl || property?.url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase();
        const match = (payload.properties ?? []).find((entry) => entry.siteUrl.toLowerCase().includes(preferredHost ?? "~~~"));
        const initial = match?.siteUrl ?? payload.properties?.[0]?.siteUrl ?? "";
        setSiteUrl(initial);
        if (initial) void load(initial, 28, termsRef.current);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not check Search Console configuration");
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
      requestId.current += 1;
    };
  }, [load, property?.url, property?.websiteUrl]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    setLoading(true);
    const form = new FormData();
    form.set("siteUrl", siteUrl);
    form.set("days", String(days));
    form.set("brandTerms", JSON.stringify(terms));
    form.set("file", file);
    try {
      const response = await fetch("/api/gsc/import", { method: "POST", body: form });
      const payload = (await response.json()) as { success?: boolean; error?: string; data?: GscPanelPayload };
      if (!response.ok || !payload.success || !payload.data) {
        setUploadError(payload.error ?? "Could not read the uploaded export");
        return;
      }
      setData(payload.data);
      setCacheLabel("uploaded file");
      setError(null);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "Could not read the uploaded export");
    } finally {
      setLoading(false);
    }
  };

  const copyServiceAccount = async () => {
    if (!copyText) return;
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
  };

  const comparison = data?.comparison;
  const rows = data?.cannibalization ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            GSC Performance &amp; Cannibalization
          </h2>
          <p className="mt-1 max-w-2xl text-caption text-slate-500 dark:text-slate-400">
            Measured from the official Search Console API or an operator-uploaded export. Values are never simulated.
          </p>
        </div>
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-caption font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {configured === null ? "Checking API…" : configured ? "Official API available" : "API not connected — upload allowed"}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-caption font-semibold text-slate-700 dark:text-slate-300">
            Search Console property
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-body text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={siteUrl}
              onChange={(event) => {
                const next = event.target.value;
                setSiteUrl(next);
                if (next) void load(next, days, terms);
              }}
            >
              {properties.length === 0 && <option value="">{siteUrl || "No properties returned"}</option>}
              {properties.map((entry) => (
                <option key={entry.siteUrl} value={entry.siteUrl}>
                  {entry.siteUrl} ({entry.permissionLevel})
                </option>
              ))}
            </select>
          </label>
          <label className="sm:w-40 text-caption font-semibold text-slate-700 dark:text-slate-300">
            Brand terms to exclude
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-body text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={brandTerms}
              onChange={(event) => setBrandTerms(event.target.value)}
              placeholder="brand, chain name"
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-body font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            disabled={!siteUrl || loading}
            onClick={() => void load(siteUrl, days, terms)}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {GSC_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setDays(preset.days);
                if (siteUrl) void load(siteUrl, preset.days, terms);
              }}
              className={`rounded-full px-3 py-1 text-caption font-semibold ${
                days === preset.days
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              {preset.id}
            </button>
          ))}
          <span className="text-caption text-slate-500 dark:text-slate-400">
            Window: {data?.window.startDate ?? "—"} → {data?.window.endDate ?? "—"} (final data)
          </span>
          {cacheLabel && <span className="text-caption text-slate-500 dark:text-slate-400">· {cacheLabel}</span>}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-body text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <p className="font-semibold">{error}</p>
          {copyText && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded bg-white/70 px-2 py-1 text-caption dark:bg-slate-900">{copyText}</code>
              <button type="button" className="rounded border border-current px-2 py-1 text-caption" onClick={() => void copyServiceAccount()}>
                {copied ? "Copied" : "Copy service-account email"}
              </button>
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-body text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {uploadError}
        </div>
      )}

      {!data && !error && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-body text-slate-600 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
          <p className="font-semibold text-slate-800 dark:text-slate-200">No Search Console rows loaded</p>
          <p className="mt-1 text-caption">
            Set <code>GOOGLE_SERVICE_ACCOUNT_B64</code> (or <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>) and grant the
            service account access to the property, or upload a GSC CSV/ZIP export below. Clicks, impressions, CTR,
            position and cannibalization are left blank until a real source provides them.
          </p>
        </div>
      )}

      {loading && !data && (
        <div className="rounded-xl border border-slate-200 p-6 text-body text-slate-500 dark:border-slate-800">
          Reading Search Console analytics and grouping query×page rows…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Clicks", value: formatNumber(data.overview.totalClicks), delta: comparison?.deltas.clicksPercent },
              { label: "Impressions", value: formatNumber(data.overview.totalImpressions), delta: comparison?.deltas.impressionsPercent },
              { label: "CTR", value: formatPercent(data.overview.averageCtr), delta: comparison ? comparison.deltas.ctrDelta * 100 : null },
              { label: "Avg. position", value: data.overview.averagePosition.toFixed(1), delta: comparison ? -comparison.deltas.positionDelta : null },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-caption text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">{metric.value}</p>
                <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
                  {metric.delta === null || metric.delta === undefined
                    ? "No prior window in this source"
                    : `${metric.delta >= 0 ? "+" : ""}${metric.delta.toFixed(1)} vs prior window`}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">Cannibalization candidates</h3>
              <span className="text-caption text-slate-500 dark:text-slate-400">
                {rows.length} query group{rows.length === 1 ? "" : "s"} · {data.source === "google-api" ? "official API" : "uploaded export"}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="mt-3 text-body text-slate-500 dark:text-slate-400">
                {data.overview.totalImpressions === 0
                  ? "No final rows were returned for this property and window. Nothing is shown rather than estimated."
                  : "No query met the ≥2 URLs / ≥10 impressions / ≤30 position / ≥20% second-URL rule."}
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-caption">
                  <thead className="text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-2">Query</th>
                      <th className="px-2 py-2">Severity</th>
                      <th className="px-2 py-2">URLs</th>
                      <th className="px-2 py-2">Preferred URL</th>
                      <th className="px-2 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {rows.map((row) => (
                      <tr key={row.query} className="border-t border-slate-100 align-top dark:border-slate-800">
                        <td className="px-2 py-2 font-semibold">{row.query}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded px-2 py-0.5 ${row.severity === "high" ? "bg-rose-100 text-rose-700" : row.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {row.severity} · {row.severityScore ?? 0}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {row.competingPages.map((page) => (
                            <div key={page.pageUrl} className="max-w-xs truncate" title={page.pageUrl}>
                              {page.impressions} impr · pos {page.position.toFixed(1)} — {page.pageUrl}
                            </div>
                          ))}
                        </td>
                        <td className="px-2 py-2"><span className="max-w-xs truncate" title={row.preferredUrl}>{row.preferredUrl}</span></td>
                        <td className="px-2 py-2">{row.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-caption text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
            {data.notes.map((note) => <p key={note}>• {note}</p>)}
            {data.limitations.map((note) => <p key={note} className="mt-1 text-amber-700 dark:text-amber-300">• {note}</p>)}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-body font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Upload GSC CSV / ZIP
              <input type="file" accept=".csv,.zip" className="hidden" onChange={(event) => void handleUpload(event)} />
            </label>
            {onUseInAudit && (
              <button
                type="button"
                onClick={() => onUseInAudit(data)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-body font-semibold text-white"
              >
                Use these rows in the 11-D audit
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default GscPerformancePanel;
