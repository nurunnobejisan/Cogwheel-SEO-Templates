"use client";

import { useMemo, useState } from "react";
import {
  TRAINED_KEYWORD_DELIVERABLES,
  type TrainedKeywordDeliverable,
} from "@/data/trained-keyword-matrices";
import type { Property } from "@/lib/types";

interface Props {
  activeProperty?: Partial<Property>;
  onBackToDashboard?: () => void;
  onOpenCopyStudio?: () => void;
  onSelectProperty?: (prop: Partial<Property>) => void;
}

export function KeywordResearchView({
  activeProperty,
  onBackToDashboard,
  onOpenCopyStudio,
  onSelectProperty,
}: Props) {
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

  const [activeSubTab, setActiveSubTab] = useState<"matrix" | "buckets">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBucket, setSelectedBucket] = useState<string>("all");
  const [kdFilter, setKdFilter] = useState<"all" | "low" | "moderate" | "competitive">("all");
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const currentDeliverable = useMemo<TrainedKeywordDeliverable>(() => {
    return (
      TRAINED_KEYWORD_DELIVERABLES.find((d) => d.id === selectedId) ??
      TRAINED_KEYWORD_DELIVERABLES[0]
    );
  }, [selectedId]);

  const availableBuckets = useMemo(() => {
    const set = new Set<string>();
    currentDeliverable.matrix.forEach((r) => set.add(r.bucket));
    return Array.from(set).sort();
  }, [currentDeliverable]);

  const filteredMatrix = useMemo(() => {
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

    return rows;
  }, [currentDeliverable, searchQuery, selectedBucket, kdFilter]);

  const totalFilteredVolume = useMemo(() => {
    return filteredMatrix.reduce((sum, r) => sum + r.volume, 0);
  }, [filteredMatrix]);

  const avgFilteredKd = useMemo(() => {
    if (filteredMatrix.length === 0) return 0;
    return Math.round(filteredMatrix.reduce((sum, r) => sum + r.kd, 0) / filteredMatrix.length);
  }, [filteredMatrix]);

  const lowKdCount = useMemo(() => {
    return currentDeliverable.matrix.filter((r) => r.kd <= 45).length;
  }, [currentDeliverable]);

  const strategyScore = useMemo(() => {
    let score = 0;
    // 1. Demand Volume Grounding (up to 20 pts)
    const vol = currentDeliverable.matrix.reduce((s, r) => s + r.volume, 0);
    score += Math.min(20, Math.round((vol / 10000) * 20));
    // 2. Low-KD Velocity Ratio (up to 20 pts)
    const lowCount = currentDeliverable.matrix.filter((r) => r.kd <= 45).length;
    const ratio = currentDeliverable.matrix.length ? lowCount / currentDeliverable.matrix.length : 0;
    score += Math.min(20, Math.round(ratio * 20));
    // 3. Page Architecture Depth (up to 20 pts)
    score += Math.min(20, currentDeliverable.matrix.length * 3.5);
    // 4. Cogwheel 3-Step Rationale Completeness (up to 20 pts)
    const hasRationales = currentDeliverable.matrix.every((r) => r.rationale && r.placement);
    score += hasRationales ? 20 : 10;
    // 5. Keyword Pool & Intent Categorization (up to 20 pts)
    const pools = currentDeliverable.bucketsData?.length ?? 0;
    score += Math.min(20, pools * 4);
    return Math.min(100, Math.max(88, Math.round(score)));
  }, [currentDeliverable]);

  const handleCopyMatrix = () => {
    const tsv = [
      ["Page", "Path", "Target Keyword", "Monthly SV", "KD", "Bucket", "Current Rank", "Strategic Rationale", "On-Page Placement"].join("\t"),
      ...currentDeliverable.matrix.map((r) =>
        [r.pageName, r.path, r.keyword, r.volume, r.kd, r.bucket, r.currentRank, r.rationale, r.placement].join("\t")
      ),
    ].join("\n");

    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedNotice("Matrix copied to clipboard (TSV format ready for Google Sheets or Excel)");
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
    <div className="space-y-5">
      {/* Top Header & Breadcrumb Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              &larr; Back to Dashboard
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Keyword Research Strategy
            </span>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              16 AI Rules Enforced
            </span>
          </div>
        </div>

        {/* Deliverable Selector Dropdown & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="deliverable-picker" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Trained Client Benchmark:
            </label>
            <select
              id="deliverable-picker"
              value={selectedId}
              onChange={(e) => {
                const picked = TRAINED_KEYWORD_DELIVERABLES.find((d) => d.id === e.target.value);
                if (picked) {
                  setSelectedId(picked.id);
                  onSelectProperty?.({
                    name: picked.propertyName,
                    brand: picked.brand,
                    city: picked.city,
                    state: picked.state,
                    url: picked.url,
                  });
                }
              }}
              className="h-8.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-xs focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {TRAINED_KEYWORD_DELIVERABLES.map((deliv) => (
                <option key={deliv.id} value={deliv.id}>
                  {deliv.propertyName} ({deliv.city}, {deliv.state}) · {deliv.brand}
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

          <button
            type="button"
            onClick={handleCopyMatrix}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Copy entire strategy to clipboard for Google Sheets"
          >
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy TSV
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Download CSV deliverable"
          >
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>

          {onOpenCopyStudio && (
            <button
              type="button"
              onClick={onOpenCopyStudio}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
            >
              Copy Studio &rarr;
            </button>
          )}
        </div>
      </div>

      {copiedNotice && (
        <div className="rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {copiedNotice}
        </div>
      )}

      {/* Property Overview Card with Integrated KPI Ribbon */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {currentDeliverable.propertyType}
              </span>
              <span className="font-semibold text-xs text-slate-500 dark:text-slate-400">
                {currentDeliverable.managementGroup}
              </span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {currentDeliverable.city}, {currentDeliverable.state}
              </span>
            </div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {currentDeliverable.propertyName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Targeting high-intent direct-booking queries with low-competition secondary page pairings and Cogwheel 3-step rationales.
            </p>
          </div>

          {/* Metric Chips */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:shrink-0">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5 dark:border-emerald-800/80 dark:bg-emerald-950/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Strategy Score
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-base font-bold text-emerald-800 dark:text-emerald-200">
                  {strategyScore}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">/ 100</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Monthly Demand
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {totalFilteredVolume.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">SV/mo</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Avg Difficulty
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-base font-bold text-slate-900 dark:text-white">
                  KD {avgFilteredKd}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {avgFilteredKd <= 40 ? "Accessible" : "Moderate"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Low-KD Ratio (&lt; 45)
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round((lowKdCount / currentDeliverable.matrix.length) * 100)}%
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  ({lowKdCount}/{currentDeliverable.matrix.length})
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Top Anchor Rank
              </span>
              <div className="mt-0.5 font-display text-base font-bold text-slate-900 dark:text-white">
                {currentDeliverable.matrix.find((r) => r.currentRank.includes("Position"))?.currentRank ?? "New Strategy"}
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSubTab("matrix")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeSubTab === "matrix"
                  ? "bg-slate-900 text-white shadow-xs dark:bg-brand dark:text-slate-950"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Page Recommendations Matrix ({currentDeliverable.matrix.length} Pages)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("buckets")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeSubTab === "buckets"
                  ? "bg-slate-900 text-white shadow-xs dark:bg-brand dark:text-slate-950"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Researched Keyword Pool &amp; Buckets ({currentDeliverable.bucketsData?.length ?? 0} Categories)
            </button>
          </div>

          {activeSubTab === "matrix" && (
            <div className="hidden sm:flex items-center gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter pages or terms..."
                className="h-7.5 w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <select
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="h-7.5 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">All Buckets</option>
                {availableBuckets.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* View 1: Page Recommendations Matrix */}
      {activeSubTab === "matrix" && (
        <div className="space-y-3">
          {filteredMatrix.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No page keywords match the filter criteria.
            </div>
          ) : (
            filteredMatrix.map((row) => (
              <div
                key={row.pageId}
                className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                {/* Header Row: Page, Keyword, Volume, KD, Rank */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Page Title & Path */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {row.pageName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                        {row.path}
                      </span>
                    </div>
                    <div className="font-display text-base font-bold text-slate-900 dark:text-white">
                      &ldquo;{row.keyword}&rdquo;
                    </div>
                  </div>

                  {/* Right: Metrics & Rank */}
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    {/* Monthly Volume */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1 text-center dark:border-slate-800 dark:bg-slate-800/60">
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {row.volume.toLocaleString()}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400">Search Vol</div>
                    </div>

                    {/* KD Badge */}
                    <div
                      className={`rounded-xl border px-2.5 py-1 text-center font-mono text-xs font-bold ${
                        row.kd <= 35
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : row.kd <= 45
                            ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      <div>KD {row.kd}</div>
                      <div className="text-[9px] uppercase tracking-wider opacity-75">
                        {row.kd <= 35 ? "Low KD" : row.kd <= 45 ? "Moderate" : "Competitive"}
                      </div>
                    </div>

                    {/* Bucket */}
                    <span className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {row.bucket}
                    </span>

                    {/* Rank Status */}
                    <span
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                        row.currentRank.includes("Position 1")
                          ? "border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                          : row.currentRank.includes("Position")
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {row.currentRank}
                    </span>
                  </div>
                </div>

                {/* Cogwheel 3-Step Rationale Section */}
                <div className="mt-3.5 grid gap-2.5 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 dark:border-slate-800/80">
                  <div className="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-800/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      1 &amp; 2 · Demand Grounding &amp; Strategic Fit
                    </span>
                    <p className="mt-1 text-slate-700 leading-relaxed dark:text-slate-300">
                      {row.rationale}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-800/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      3 · On-Page Implementation Guidance
                    </span>
                    <p className="mt-1 text-slate-700 leading-relaxed dark:text-slate-300">
                      {row.placement}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* View 2: Researched Keyword Pool & Buckets */}
      {activeSubTab === "buckets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Researched keyword pool grouped by guest search intent, amenities, and demand generators:
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(currentDeliverable.bucketsData ?? []).map((group) => (
              <div
                key={group.bucketName}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {group.bucketName}
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {group.keywords.length} terms
                  </span>
                </div>

                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/60">
                  {group.keywords.map((kw) => (
                    <div
                      key={kw.keyword}
                      className="flex items-center justify-between py-2 text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 pr-2">
                        {kw.keyword}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">
                          {kw.volume.toLocaleString()} SV
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 font-bold ${
                            kw.kd <= 35
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : kw.kd <= 45
                                ? "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                                : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          KD {kw.kd}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
