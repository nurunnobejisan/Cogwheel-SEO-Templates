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
  /** null = not measured/entered yet (never invented). */
  searchVolume: number | null;
  yourRank: number | null;
  compRanks: Record<string, number | null>; // compId -> rank
}

/**
 * Local comp-set ranking matrix.
 *
 * Integrity note (see docs/REPOSITORY_AUDIT.md, C2/H1): ranks and volumes are
 * NOT fetched or estimated — no rank-tracking provider is connected — so the
 * matrix starts empty and every value is entered by the operator. Values that
 * have not been entered display as "—" rather than a plausible-looking number.
 */
const COMP_COLORS = ["#8b5cf6", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#6366f1"];

export function CompsetRankingMatrix({ property, onExportMemo }: CompsetProps) {
  const propertyName = property?.name?.trim() || "";
  const propertyCity = property?.city?.trim() || "";
  const propertyState = property?.state?.trim() || "";
  const displayName = propertyName || "Target property";
  const marketLabel = [propertyCity, propertyState].filter(Boolean).join(", ") || "the local market";

  // Competitors are operator-entered. No competitor name, distance or domain is
  // guessed from the property location.
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

  // No fabricated seed rows — the operator supplies the benchmark data.
  const [keywords, setKeywords] = useState<KeywordBattle[]>([]);

  const [newKeyword, setNewKeyword] = useState("");
  const [newSv, setNewSv] = useState<string>("");
  const [newRank, setNewRank] = useState<string>("");
  const [newCompName, setNewCompName] = useState("");
  const [newCompShort, setNewCompShort] = useState("");
  const [newCompDistance, setNewCompDistance] = useState("");

  // Share of Voice counts only keywords whose rank has actually been entered.
  const ranked = keywords.filter((k) => typeof k.yourRank === "number");
  const yourTop3 = ranked.filter((k) => (k.yourRank as number) <= 3).length;
  const yourShareOfVoice = ranked.length > 0 ? Math.round((yourTop3 / ranked.length) * 100) : null;

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const sv = newSv.trim() === "" ? null : Number(newSv);
    const rank = newRank.trim() === "" ? null : Number(newRank);
    setKeywords((prev) => [
      ...prev,
      {
        keyword: newKeyword.trim().toLowerCase(),
        searchVolume: sv !== null && Number.isFinite(sv) ? sv : null,
        yourRank: rank !== null && Number.isFinite(rank) ? rank : null,
        compRanks: Object.fromEntries(competitors.map((c) => [c.id, null])),
      },
    ]);
    setNewKeyword("");
    setNewSv("");
    setNewRank("");
  };

  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) return;
    const id = `c${Date.now().toString(36)}`;
    const name = newCompName.trim();
    const competitor: Competitor = {
      id,
      name,
      shortName: newCompShort.trim() || name.split(" ").slice(0, 2).join(" "),
      distance: newCompDistance.trim(),
      color: COMP_COLORS[competitors.length % COMP_COLORS.length],
    };
    setCompetitors((prev) => [...prev, competitor]);
    setKeywords((prev) =>
      prev.map((kw) => ({ ...kw, compRanks: { ...kw.compRanks, [id]: null } }))
    );
    setNewCompName("");
    setNewCompShort("");
    setNewCompDistance("");
  };

  const handleRemoveCompetitor = (id: string) => {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    setKeywords((prev) =>
      prev.map((kw) => {
        const compRanks = { ...kw.compRanks };
        delete compRanks[id];
        return { ...kw, compRanks };
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-50 px-3 py-1 text-caption font-semibold text-slate-800 dark:bg-brand-950/40 dark:text-brand-light">
            Local Competitive Intelligence
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
            Local Comp-Set Ranking Matrix
          </h2>
          <p className="mt-1 text-caption text-slate-500 dark:text-slate-400 sm:text-body">
            Benchmark <span className="font-semibold text-slate-800 dark:text-white">{displayName}</span> against
            properties you select in {marketLabel}. Ranks are operator-entered — no rank-tracking
            provider is connected.
          </p>
        </div>

        {/* Share of Voice KPI Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <div>
            <div className="text-micro font-bold uppercase tracking-wider text-slate-400">
              Share of Voice (Top 3)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                {yourShareOfVoice === null ? "—" : `${yourShareOfVoice}%`}
              </span>
            </div>
            <p className="text-tiny text-slate-500 dark:text-slate-400">
              {ranked.length > 0 ? `${yourTop3} of ${ranked.length} ranked terms in top 3` : "Add a ranked keyword to calculate"}
            </p>
          </div>
          {onExportMemo && (
            <Button variant="primary" onClick={onExportMemo} className="text-caption">
              Send to 1-Page Memo
            </Button>
          )}
        </div>
      </div>

      {/* Competitor Legend & Distance */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border-2 border-brand bg-brand-50/40 p-3.5 shadow-sm dark:border-brand/60 dark:bg-brand-950/20">
          <div className="flex items-center justify-between">
            <span className="text-tiny font-bold uppercase tracking-wider text-slate-800 dark:text-white">
              Target Property
            </span>
            <span className="rounded-md bg-brand px-2 py-0.5 text-micro font-bold text-slate-900">
              Active
            </span>
          </div>
          <div className="mt-1.5 font-bold text-body text-slate-900 dark:text-white truncate">
            {displayName}
          </div>
          <div className="text-caption text-slate-500 dark:text-slate-400">Primary Domain</div>
        </div>

        {competitors.map((comp, index) => (
          <div
            key={comp.id}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny font-bold uppercase tracking-wider text-slate-400">
                Comp {index + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-tiny font-semibold text-slate-500">
                  {comp.distance || "Distance not set"}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCompetitor(comp.id)}
                  className="text-tiny font-bold text-slate-400 hover:text-rose-600"
                  aria-label={`Remove ${comp.name}`}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="mt-1.5 font-bold text-body text-slate-900 dark:text-white truncate">
              {comp.name}
            </div>
            <div className="text-caption text-slate-500 dark:text-slate-400">Operator-entered comp</div>
          </div>
        ))}
      </div>

      {/* Add competitor */}
      <form
        onSubmit={handleAddCompetitor}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
      >
        <span className="text-caption font-bold text-slate-600 dark:text-slate-400">+ Add competitor:</span>
        <input
          type="text"
          value={newCompName}
          onChange={(e) => setNewCompName(e.target.value)}
          placeholder="Competitor name"
          className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <input
          type="text"
          value={newCompShort}
          onChange={(e) => setNewCompShort(e.target.value)}
          placeholder="Short name (optional)"
          className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <input
          type="text"
          value={newCompDistance}
          onChange={(e) => setNewCompDistance(e.target.value)}
          placeholder="Distance (optional)"
          className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <Button type="submit" variant="secondary" className="text-caption py-1.5">
          Add Competitor
        </Button>
      </form>

      {/* Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <h3 className="font-display text-body font-bold text-slate-900 dark:text-white">
            Keyword Battleground
          </h3>
          <p className="text-caption text-slate-500 dark:text-slate-400">
            Organic search position comparison on primary booking-intent terms. Enter positions you have verified;
            blank positions are shown as unmeasured.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-tiny font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
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
            <tbody className="divide-y divide-slate-100 text-caption dark:divide-slate-800">
              {keywords.length === 0 && (
                <tr>
                  <td colSpan={competitors.length + 4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No keywords benchmarked yet. Add a keyword and its verified rank below to build the matrix.
                    {competitors.length === 0 && " Add at least one competitor to compare positions."}
                  </td>
                </tr>
              )}
              {keywords.map((kw, i) => {
                const numericRanks = Object.values(kw.compRanks).filter((r): r is number => typeof r === "number" && !isNaN(r));
                const bestCompRank = numericRanks.length > 0 ? Math.min(...numericRanks) : null;
                const hasRank = typeof kw.yourRank === "number";
                const isWinning = hasRank && bestCompRank !== null ? (kw.yourRank as number) < bestCompRank : false;
                const isTied = hasRank && bestCompRank !== null ? kw.yourRank === bestCompRank : false;
                const gap = hasRank && bestCompRank !== null ? Math.abs(bestCompRank - (kw.yourRank as number)) : 0;

                return (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {kw.keyword}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {kw.searchVolume === null ? "—" : kw.searchVolume.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-center bg-brand-50/40 dark:bg-brand-950/20 font-bold">
                      {hasRank ? (
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-caption ${
                            kw.yourRank === 1
                              ? "bg-brand text-slate-900 font-extrabold shadow-sm"
                              : (kw.yourRank as number) <= 3
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          #{kw.yourRank}
                        </span>
                      ) : (
                        <span className="font-mono text-slate-400">—</span>
                      )}
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
                      {!hasRank || bestCompRank === null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-tiny font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Unmeasured
                        </span>
                      ) : isWinning ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-tiny font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          Leading {bestCompRank !== null ? `(+${gap})` : ""}
                        </span>
                      ) : isTied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-tiny font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Tied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-tiny font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
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
          <span className="text-caption font-bold text-slate-600 dark:text-slate-400">
            + Benchmark Keyword:
          </span>
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="e.g. riverfront suites"
            className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="number"
            value={newSv}
            onChange={(e) => setNewSv(e.target.value)}
            placeholder="SV (optional)"
            className="w-28 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="number"
            value={newRank}
            onChange={(e) => setNewRank(e.target.value)}
            placeholder="Your rank"
            className="w-24 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-caption text-slate-900 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <Button type="submit" variant="secondary" className="text-caption py-1.5">
            Add to Matrix
          </Button>
        </form>
      </div>
    </div>
  );
}
