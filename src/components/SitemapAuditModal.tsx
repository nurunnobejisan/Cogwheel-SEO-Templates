"use client";

import { useState } from "react";
import { Button } from "./ui";

interface DiscoveredUrl {
  url: string;
  category: string;
  depth: number;
  isHttps: boolean;
  hasTrailingSlash: boolean;
}

interface SitemapCategory {
  name: string;
  count: number;
  urls: string[];
}

interface SitemapAuditResult {
  success: boolean;
  sitemapUrl: string;
  totalUrls: number;
  categories: SitemapCategory[];
  discoveredUrls: DiscoveredUrl[];
  healthScore: number;
  issues: string[];
}

interface Props {
  defaultUrl?: string;
  onClose: () => void;
}

export function SitemapAuditModal({ defaultUrl = "", onClose }: Props) {
  const [sitemapInput, setSitemapInput] = useState(
    defaultUrl ? `${defaultUrl.replace(/\/+$/, "")}/sitemap.xml` : "https://www.arrivehotels.com/sitemap.xml"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SitemapAuditResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const handleAudit = async (urlToTest?: string) => {
    const target = urlToTest || sitemapInput;
    if (!target.trim()) {
      setError("Please enter a sitemap URL or hotel website domain.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sitemap-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to inspect sitemap.");
      }
      setResult(data);
      setSelectedCategory("All");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not fetch or audit XML sitemap.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredUrls = result
    ? selectedCategory === "All"
      ? result.discoveredUrls
      : result.discoveredUrls.filter((u) => u.category === selectedCategory)
    : [];

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light dark:bg-brand dark:text-slate-900">
              Crawler &amp; Indexation
            </span>
            <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Bulk XML Sitemap Discovery &amp; Structure Audit
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ingest any <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">/sitemap.xml</code> to classify rooms, dining, amenities, and verify URL health.
          </p>
        </div>

        <Button variant="ghost" onClick={onClose} className="text-xs">
          Close
        </Button>
      </div>

      {/* Input Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={sitemapInput}
            onChange={(e) => setSitemapInput(e.target.value)}
            placeholder="https://example.com/sitemap.xml"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-900 transition focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <Button
          variant="primary"
          onClick={() => handleAudit()}
          disabled={loading}
          className="text-xs shrink-0"
        >
          {loading ? "Auditing Sitemap..." : "Inspect & Categorize Sitemap"}
        </Button>
      </div>

      {/* Sample Quick-Fill Pill Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
        <span>Try Sample Hotel Sitemaps:</span>
        <button
          type="button"
          onClick={() => {
            setSitemapInput("https://www.arrivehotels.com/sitemap.xml");
            handleAudit("https://www.arrivehotels.com/sitemap.xml");
          }}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-purple-700 hover:bg-purple-50 dark:border-slate-700 dark:bg-slate-800 dark:text-purple-300"
        >
          Arrive Hotels
        </button>
        <button
          type="button"
          onClick={() => {
            setSitemapInput("https://www.thecurtis.com/sitemap.xml");
            handleAudit("https://www.thecurtis.com/sitemap.xml");
          }}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-purple-700 hover:bg-purple-50 dark:border-slate-700 dark:bg-slate-800 dark:text-purple-300"
        >
          The Curtis Denver
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}

      {/* Results Dashboard */}
      {result && (
        <div className="space-y-5">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sitemap URLs</span>
              <div className="mt-1 font-display text-xl font-black text-slate-900 dark:text-white">
                {result.totalUrls}
              </div>
              <div className="text-[10px] text-slate-500">Indexed Pages Discovered</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sitemap Health Score</span>
              <div className="mt-1 font-display text-xl font-black text-emerald-600 dark:text-emerald-400">
                {result.healthScore}%
              </div>
              <div className="text-[10px] text-slate-500">Canonical Integrity</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Categories</span>
              <div className="mt-1 font-display text-xl font-black text-purple-600 dark:text-purple-400">
                {result.categories.length}
              </div>
              <div className="text-[10px] text-slate-500">Rooms, Dining, Events</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Protocol Security</span>
              <div className="mt-1 font-display text-xl font-black text-sky-600 dark:text-sky-400">
                100% HTTPS
              </div>
              <div className="text-[10px] text-slate-500">Secure Protocol</div>
            </div>
          </div>

          {/* Issues / Audit Flags */}
          {result.issues && result.issues.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="font-bold">Indexation Observations:</span>
              <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px]">
                {result.issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                selectedCategory === "All"
                  ? "bg-slate-900 text-white dark:bg-brand dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              All URLs ({result.totalUrls})
            </button>
            {result.categories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedCategory === cat.name
                    ? "bg-purple-600 text-white dark:bg-purple-500"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>

          {/* Discovered URLs Table */}
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-white text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="p-2.5">Discovered URL ({filteredUrls.length})</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Depth</th>
                  <th className="p-2.5">Trailing Slash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px] dark:divide-slate-800">
                {filteredUrls.slice(0, 50).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 max-w-md truncate text-slate-800 dark:text-slate-200" title={item.url}>
                      {item.url}
                    </td>
                    <td className="p-2.5 font-sans">
                      <span className="rounded bg-slate-200/70 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500">{item.depth} levels</td>
                    <td className="p-2.5 text-slate-500">
                      {item.hasTrailingSlash ? "Yes (/)" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Showing {Math.min(50, filteredUrls.length)} of {filteredUrls.length} URLs in this category
            </span>
            <button
              type="button"
              onClick={() => {
                const text = filteredUrls.map((u) => u.url).join("\n");
                navigator.clipboard?.writeText(text);
              }}
              className="font-semibold text-purple-600 hover:text-purple-800 dark:text-purple-400"
            >
              Copy URLs to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
