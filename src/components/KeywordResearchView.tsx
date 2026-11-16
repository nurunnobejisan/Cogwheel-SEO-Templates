"use client";

import { useMemo, useState } from "react";
import {
  TRAINED_KEYWORD_DELIVERABLES,
  type TrainedKeywordDeliverable,
  type TrainedKeywordRow,
} from "@/data/trained-keyword-matrices";
import type { Property } from "@/lib/types";

interface Props {
  activeProperty?: Partial<Property>;
  onOpenCopyStudio?: () => void;
  onSelectProperty?: (prop: Partial<Property>) => void;
}

export function KeywordResearchView({
  activeProperty,
  onOpenCopyStudio,
  onSelectProperty,
}: Props) {
  // Select initial deliverable matching activeProperty or default to SpringHill Panama City Beach
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (activeProperty?.name) {
      const propName = activeProperty.name.toLowerCase();
      const match = TRAINED_KEYWORD_DELIVERABLES.find((d) =>
        propName.includes(d.propertyName.toLowerCase().slice(0, 10))
      );
      if (match) return match.id;
    }
    return TRAINED_KEYWORD_DELIVERABLES[0].id;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBucket, setSelectedBucket] = useState<string>("all");
  const [kdFilter, setKdFilter] = useState<"all" | "low" | "moderate" | "competitive">("all");
  const [sortBy, setSortBy] = useState<"volume-desc" | "volume-asc" | "kd-asc" | "page">("volume-desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const currentDeliverable = useMemo<TrainedKeywordDeliverable>(() => {
    return (
      TRAINED_KEYWORD_DELIVERABLES.find((d) => d.id === selectedId) ??
      TRAINED_KEYWORD_DELIVERABLES[0]
    );
  }, [selectedId]);

  // Unique buckets present in this deliverable
  const availableBuckets = useMemo(() => {
    const set = new Set<string>();
    currentDeliverable.matrix.forEach((r) => set.add(r.bucket));
    return Array.from(set).sort();
  }, [currentDeliverable]);

  // Filter and sort matrix rows
  const filteredRows = useMemo(() => {
    let rows = [...currentDeliverable.matrix];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.keyword.toLowerCase().includes(q) ||
          r.pageName.toLowerCase().includes(q) ||
          r.path.toLowerCase().includes(q) ||
          r.bucket.toLowerCase().includes(q) ||
          r.rationale.toLowerCase().includes(q)
      );
    }

    if (selectedBucket !== "all") {
      rows = rows.filter((r) => r.bucket === selectedBucket);
    }

    if (kdFilter === "low") {
      rows = rows.filter((r) => r.kd < 35);
    } else if (kdFilter === "moderate") {
      rows = rows.filter((r) => r.kd >= 35 && r.kd <= 45);
    } else if (kdFilter === "competitive") {
      rows = rows.filter((r) => r.kd > 45);
    }

    if (sortBy === "volume-desc") {
      rows.sort((a, b) => b.volume - a.volume);
    } else if (sortBy === "volume-asc") {
      rows.sort((a, b) => a.volume - b.volume);
    } else if (sortBy === "kd-asc") {
      rows.sort((a, b) => a.kd - b.kd);
    } else if (sortBy === "page") {
      rows.sort((a, b) => a.pageName.localeCompare(b.pageName));
    }

    return rows;
  }, [currentDeliverable, searchQuery, selectedBucket, kdFilter, sortBy]);

  const maxVolume = useMemo(() => {
    return Math.max(...currentDeliverable.matrix.map((r) => r.volume), 1);
  }, [currentDeliverable]);

  const totalFilteredVolume = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.volume, 0);
  }, [filteredRows]);

  const avgFilteredKd = useMemo(() => {
    if (filteredRows.length === 0) return 0;
    return Math.round(filteredRows.reduce((sum, r) => sum + r.kd, 0) / filteredRows.length);
  }, [filteredRows]);

  const lowKdRatio = useMemo(() => {
    if (currentDeliverable.matrix.length === 0) return 0;
    const lowCount = currentDeliverable.matrix.filter((r) => r.kd <= 45).length;
    return Math.round((lowCount / currentDeliverable.matrix.length) * 100);
  }, [currentDeliverable]);

  const handleCopyMatrix = () => {
    const tsv = [
      ["Page", "Path", "Target Keyword", "Monthly SV", "KD", "Bucket", "Current Rank", "Placement Guidance"].join("\t"),
      ...currentDeliverable.matrix.map((r) =>
        [r.pageName, r.path, r.keyword, r.volume, r.kd, r.bucket, r.currentRank, r.placement].join("\t")
      ),
    ].join("\n");

    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedNotice("Matrix copied to clipboard (TSV format ready for Sheets/Excel)");
      setTimeout(() => setCopiedNotice(null), 3000);
    });
  };

  const handleDownloadCsv = () => {
    const csvRows = [
      ["Page", "Path", "Target Keyword", "Monthly Search Volume", "Keyword Difficulty", "Bucket", "Current Google Rank", "Strategic Rationale", "On-Page Placement"],
      ...currentDeliverable.matrix.map((r) => [
        `"${r.pageName}"`,
        `"${r.path}"`,
        `"${r.keyword}"`,
        r.volume,
        r.kd,
        `"${r.bucket}"`,
        `"${r.currentRank}"`,
        `"${r.rationale.replace(/"/g, '""')}"`,
        `"${r.placement.replace(/"/g, '""')}"`,
      ]),
    ];

    const blob = new Blob([csvRows.map((e) => e.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${currentDeliverable.propertyName.replace(/\s+/g, "_")}_Keyword_Strategy.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark dark:bg-brand-950/60 dark:text-brand-light">
                SEO Module 2
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Hospitality Keyword Strategy &amp; Mapping
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                16 AI Rules Enforced
              </span>
            </div>
            <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Keyword Research Matrix &amp; Strategy Hub
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Empirically trained across real hospitality client deliverables. Pairs high-intent Semrush search demand with low-KD secondary opportunities, local geo-anchoring, and Cogwheel 3-step rationales.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMatrix}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Matrix (TSV)
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            {onOpenCopyStudio && (
              <button
                type="button"
                onClick={onOpenCopyStudio}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
              >
                Proceed to Copy Studio &rarr;
              </button>
            )}
          </div>
        </div>

        {copiedNotice && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {copiedNotice}
          </div>
        )}

        {/* Client Deliverables Benchmark Selector */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Trained Client Deliverables ({TRAINED_KEYWORD_DELIVERABLES.length})
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Select any client property to inspect its complete grounded strategy:
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {TRAINED_KEYWORD_DELIVERABLES.map((deliv) => {
              const isSelected = deliv.id === selectedId;
              return (
                <button
                  key={deliv.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(deliv.id);
                    onSelectProperty?.({
                      name: deliv.propertyName,
                      brand: deliv.brand,
                      city: deliv.city,
                      state: deliv.state,
                      url: deliv.url,
                    });
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs dark:bg-brand dark:text-slate-950"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{deliv.propertyName}</span>
                  <span className={`ml-1.5 text-[10px] ${isSelected ? "opacity-80" : "text-slate-400"}`}>
                    ({deliv.city}, {deliv.state})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly Demand
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalFilteredVolume.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">searches / mo</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Across {filteredRows.length} targeted landing pages
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg Keyword Difficulty
            </span>
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              Semrush KD
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {avgFilteredKd}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/ 100</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  avgFilteredKd <= 35
                    ? "bg-emerald-500"
                    : avgFilteredKd <= 45
                      ? "bg-sky-500"
                      : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, (avgFilteredKd / 80) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {avgFilteredKd <= 35 ? "Easy Velocity" : avgFilteredKd <= 45 ? "Moderate Velocity" : "Competitive"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Low-KD Ratio (&lt; 45)
            </span>
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Fast Rank
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {lowKdRatio}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">of keywords</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Adheres to &lt; 45 KD secondary page rule
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Property Context
            </span>
            <span className="font-mono text-[10px] text-slate-400 uppercase">
              {currentDeliverable.propertyType}
            </span>
          </div>
          <div className="mt-2 font-display text-sm font-bold text-slate-900 dark:text-white truncate">
            {currentDeliverable.brand}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {currentDeliverable.managementGroup} · {currentDeliverable.city}, {currentDeliverable.state}
          </p>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keyword, page, or bucket..."
              aria-label="Filter keywords"
              className="h-8.5 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Bucket Filter */}
          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            aria-label="Filter by bucket"
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">All Buckets ({availableBuckets.length})</option>
            {availableBuckets.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* KD Tier Filter */}
          <select
            value={kdFilter}
            onChange={(e) => setKdFilter(e.target.value as any)}
            aria-label="Filter by difficulty"
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">All KD Difficulties</option>
            <option value="low">Low KD (&lt; 35)</option>
            <option value="moderate">Moderate KD (35–45)</option>
            <option value="competitive">Competitive KD (&gt; 45)</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort matrix"
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="volume-desc">Search Volume (High to Low)</option>
            <option value="volume-asc">Search Volume (Low to High)</option>
            <option value="kd-asc">Difficulty (Easiest to Hardest)</option>
            <option value="page">Page Name (A to Z)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-900 dark:text-white">{filteredRows.length}</strong> of {currentDeliverable.matrix.length}
          </span>
        </div>
      </div>

      {/* Main Interactive Keyword Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-5 pr-3">Target Page</th>
                <th className="py-3.5 px-3">Primary Target Keyword</th>
                <th className="py-3.5 px-3 w-44">Monthly Volume</th>
                <th className="py-3.5 px-3 w-28">Difficulty</th>
                <th className="py-3.5 px-3">Bucket</th>
                <th className="py-3.5 px-3">Rank Status</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    No keywords match the active filter criteria. Try clearing search or resetting bucket filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isExpanded = expandedRow === row.pageId;
                  const volumePct = Math.min(100, Math.max(12, (row.volume / maxVolume) * 100));

                  return (
                    <tr
                      key={row.pageId}
                      className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      {/* Page */}
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="font-bold text-slate-900 dark:text-white">{row.pageName}</div>
                        <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{row.path}</div>
                      </td>

                      {/* Primary Keyword */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white">{row.keyword}</span>
                      </td>

                      {/* Monthly Volume */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                            <span>{row.volume.toLocaleString()}</span>
                            <span className="text-[10px] font-normal text-slate-400">SV</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-slate-900 dark:bg-brand"
                              style={{ width: `${volumePct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Difficulty (KD) */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                            row.kd <= 35
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : row.kd <= 45
                                ? "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              row.kd <= 35 ? "bg-emerald-500" : row.kd <= 45 ? "bg-sky-500" : "bg-amber-500"
                            }`}
                          />
                          KD {row.kd}
                        </span>
                      </td>

                      {/* Bucket */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {row.bucket}
                        </span>
                      </td>

                      {/* Rank Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            row.currentRank.includes("Position 1")
                              ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300"
                              : row.currentRank.includes("Position")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {row.currentRank}
                        </span>
                      </td>

                      {/* Rationale Toggle */}
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedRow(isExpanded ? null : row.pageId)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          {isExpanded ? "Hide Details" : "View Rationale"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded Row Detail Drawer if selected */}
        {expandedRow && (
          <div className="border-t border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40">
            {(() => {
              const row = currentDeliverable.matrix.find((r) => r.pageId === expandedRow);
              if (!row) return null;

              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        {row.pageName} ({row.path})
                      </span>
                      <span className="font-mono text-xs font-semibold text-brand-dark dark:text-brand">
                        &ldquo;{row.keyword}&rdquo;
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedRow(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Close &times;
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Cogwheel Strategic Rationale
                      </span>
                      <p className="mt-1.5 text-xs text-slate-700 leading-relaxed dark:text-slate-300">
                        {row.rationale}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        On-Page Implementation Guidance
                      </span>
                      <p className="mt-1.5 text-xs text-slate-700 leading-relaxed dark:text-slate-300">
                        {row.placement}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Methodology & Training Alignment Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Cogwheel 3-Step Methodology &amp; AI Answer Engine Alignment
          </h3>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Model Rules Active
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase dark:text-slate-400">RULE 1 · DEMAND GROUNDING</span>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Cites exact Semrush 12-month search averages and keyword difficulty. Never fabricates metrics or traffic numbers.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase dark:text-slate-400">RULE 2 · &lt; 45 KD THRESHOLD</span>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Secondary landing pages target KD &lt; 45 to establish fast ranking velocity and prompt citation authority in AI Search (ChatGPT, Gemini, Perplexity).
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase dark:text-slate-400">RULE 3 · CITY GEO-ANCHORING</span>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Eliminates generic state-wide keywords. Anchors on local city, neighborhood (e.g. North End), and demand generator landmarks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
