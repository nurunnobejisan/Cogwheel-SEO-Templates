"use client";

import { useState } from "react";
import { Button } from "./ui";

interface CompsetProps {
  property?: {
    name?: string;
    brand?: string;
    city?: string;
    state?: string;
  };
  onExportMemo?: () => void;
}

interface Competitor {
  id: string;
  name: string;
  shortName: string;
  distance: string;
  color: string;
}

interface KeywordBattle {
  keyword: string;
  searchVolume: number;
  yourRank: number;
  compRanks: Record<string, number>; // compId -> rank
}

export function CompsetRankingMatrix({ property, onExportMemo }: CompsetProps) {
  const propertyName = property?.name || "Renaissance Shoals Resort & Spa";
  const propertyCity = property?.city || "Florence";
  const propertyState = property?.state || "AL";

  const [competitors, setCompetitors] = useState<Competitor[]>([
    {
      id: "c1",
      name: "GunRunner Boutique Hotel",
      shortName: "GunRunner",
      distance: "1.8 miles",
      color: "#8b5cf6",
    },
    {
      id: "c2",
      name: "Courtyard Florence",
      shortName: "Courtyard",
      distance: "2.4 miles",
      color: "#3b82f6",
    },
    {
      id: "c3",
      name: "Hampton Inn Downtown Florence",
      shortName: "Hampton Inn",
      distance: "2.1 miles",
      color: "#f59e0b",
    },
  ]);

  const [keywords, setKeywords] = useState<KeywordBattle[]>([
    {
      keyword: `hotels in ${propertyCity.toLowerCase()} ${propertyState.toLowerCase()}`,
      searchVolume: 1600,
      yourRank: 2,
      compRanks: { c1: 4, c2: 3, c3: 5 },
    },
    {
      keyword: `${propertyCity.toLowerCase()} alabama resort`,
      searchVolume: 880,
      yourRank: 1,
      compRanks: { c1: 8, c2: 12, c3: 15 },
    },
    {
      keyword: "downtown boutique hotel with spa",
      searchVolume: 420,
      yourRank: 3,
      compRanks: { c1: 1, c2: 9, c3: 7 },
    },
    {
      keyword: "tennessee river luxury resort",
      searchVolume: 590,
      yourRank: 1,
      compRanks: { c1: 6, c2: 11, c3: 14 },
    },
    {
      keyword: `${propertyCity.toLowerCase()} wedding event venue hotel`,
      searchVolume: 320,
      yourRank: 2,
      compRanks: { c1: 3, c2: 5, c3: 8 },
    },
  ]);

  const [newKeyword, setNewKeyword] = useState("");
  const [newSv, setNewSv] = useState(200);

  // Calculate Share of Voice (Top 3 rank percentage)
  const yourTop3 = keywords.filter((k) => k.yourRank <= 3).length;
  const yourShareOfVoice = Math.round((yourTop3 / keywords.length) * 100);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setKeywords((prev) => [
      ...prev,
      {
        keyword: newKeyword.trim().toLowerCase(),
        searchVolume: Number(newSv) || 100,
        yourRank: Math.floor(Math.random() * 5) + 1,
        compRanks: {
          c1: Math.floor(Math.random() * 8) + 1,
          c2: Math.floor(Math.random() * 10) + 1,
          c3: Math.floor(Math.random() * 12) + 1,
        },
      },
    ]);
    setNewKeyword("");
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-50 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-brand-950/40 dark:text-brand-light">
            Local Competitive Intelligence
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
            Local Comp-Set Ranking Matrix
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Benchmarking <span className="font-semibold text-slate-800 dark:text-white">{propertyName}</span> against
            the top 3 local properties in the {propertyCity} market.
          </p>
        </div>

        {/* Share of Voice KPI Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Share of Voice (Top 3)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                {yourShareOfVoice}%
              </span>
              <span className="text-xs font-semibold text-emerald-600">Leader</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {yourTop3} of {keywords.length} terms in top 3
            </p>
          </div>
          {onExportMemo && (
            <Button variant="primary" onClick={onExportMemo} className="text-xs">
              Send to 1-Page Memo
            </Button>
          )}
        </div>
      </div>

      {/* Competitor Legend & Distance */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border-2 border-brand bg-brand-50/40 p-3.5 shadow-sm dark:border-brand/60 dark:bg-brand-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-white">
              Target Property
            </span>
            <span className="rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold text-slate-900">
              Active
            </span>
          </div>
          <div className="mt-1.5 font-bold text-sm text-slate-900 dark:text-white truncate">
            {propertyName}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Primary Domain</div>
        </div>

        {competitors.map((comp) => (
          <div
            key={comp.id}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Comp {comp.id.replace("c", "")}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">{comp.distance}</span>
            </div>
            <div className="mt-1.5 font-bold text-sm text-slate-900 dark:text-white truncate">
              {comp.name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Local Comp-Set</div>
          </div>
        ))}
      </div>

      {/* Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            High-Impact Keyword Battleground
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time organic search position comparison on primary booking intent terms.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
                <th className="py-3 px-4">Primary Target Keyword</th>
                <th className="py-3 px-3 text-right">Search Volume</th>
                <th className="py-3 px-3 text-center bg-brand-50/70 text-slate-900 dark:bg-brand-950/40 dark:text-brand-light">
                  Your Rank
                </th>
                {competitors.map((c) => (
                  <th key={c.id} className="py-3 px-3 text-center">
                    {c.shortName}
                  </th>
                ))}
                <th className="py-3 px-4 text-center">Competitive Edge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {keywords.map((kw, i) => {
                const numericRanks = Object.values(kw.compRanks).filter((r): r is number => typeof r === "number" && !isNaN(r));
                const bestCompRank = numericRanks.length > 0 ? Math.min(...numericRanks) : null;
                const isWinning = bestCompRank !== null ? kw.yourRank < bestCompRank : true;
                const isTied = bestCompRank !== null ? kw.yourRank === bestCompRank : false;
                const gap = bestCompRank !== null ? Math.abs(bestCompRank - kw.yourRank) : 0;

                return (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {kw.keyword}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {kw.searchVolume.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-center bg-brand-50/40 dark:bg-brand-950/20 font-bold">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs ${
                          kw.yourRank === 1
                            ? "bg-brand text-slate-900 font-extrabold shadow-sm"
                            : kw.yourRank <= 3
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        #{kw.yourRank}
                      </span>
                    </td>
                    {competitors.map((c) => {
                      const rank = kw.compRanks[c.id];
                      return (
                        <td key={c.id} className="py-3.5 px-3 text-center">
                          <span className="font-mono text-slate-600 dark:text-slate-400">
                            {typeof rank === "number" ? `#${rank}` : "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-3.5 px-4 text-center">
                      {isWinning ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          Leading {bestCompRank !== null ? `(+${gap})` : ""}
                        </span>
                      ) : isTied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Tied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                          Behind (-{gap})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Custom Keyword to Matrix */}
        <form
          onSubmit={handleAddKeyword}
          className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
        >
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            + Benchmark Keyword:
          </span>
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="e.g. florence riverfront suites"
            className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="number"
            value={newSv}
            onChange={(e) => setNewSv(Number(e.target.value))}
            placeholder="SV"
            className="w-20 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <Button type="submit" variant="secondary" className="text-xs py-1.5">
            Add to Radar
          </Button>
        </form>
      </div>
    </div>
  );
}
