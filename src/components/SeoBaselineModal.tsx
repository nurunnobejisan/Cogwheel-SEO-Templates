"use client";

import { useEffect, useState } from "react";
import { GenerationProgressModal } from "./GenerationProgressModal";
import { Button, Card } from "./ui";

interface SlidePreview {
  slideNumber: number;
  title: string;
  content: Record<string, string | number | string[]>;
}

interface BaselineOutput {
  propertyName: string;
  presentationUrl: string | null;
  usedTemplateCopy: boolean;
  slides: SlidePreview[];
}

interface BaselineResult {
  outputUrl: string | null;
  flags: Array<{ code: string; message: string; severity: string }>;
  data?: BaselineOutput;
  output?: BaselineOutput;
}

interface Props {
  defaultProperty?: { name?: string; url?: string };
  onClose: () => void;
  onCompleted: () => void;
}

const DEFAULT_TEMPLATE_URL =
  "https://docs.google.com/presentation/d/1EfhGAw3vIcJroTvhi8LBz3E6MzSSQbG2cC0BZOBrjn4/edit?usp=sharing";

export function SeoBaselineModal({ defaultProperty, onClose, onCompleted }: Props) {
  const [name, setName] = useState(defaultProperty?.name ?? "");
  const [url, setUrl] = useState(defaultProperty?.url ?? "");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_URL);
  const [organicTraffic, setOrganicTraffic] = useState("");
  const [nonBrandKeywords, setNonBrandKeywords] = useState("");
  const [brandKeywords, setBrandKeywords] = useState("");
  const [referringDomains, setReferringDomains] = useState("");
  const [backlinks, setBacklinks] = useState("");
  const [indexedPages, setIndexedPages] = useState("");
  const [crawlPrefilled, setCrawlPrefilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadLatestCrawlCount() {
      try {
        const res = await fetch("/api/tasks/site-crawl/runs", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          runs?: Array<{
            status: string;
            output?: { progress?: { crawled?: number }; pagesCrawled?: number };
          }>;
        };
        const latest = json.runs?.find((r) => r.status === "Done" || r.status === "Flagged");
        const count = latest?.output?.progress?.crawled ?? latest?.output?.pagesCrawled;
        if (!cancelled && typeof count === "number" && count > 0) {
          setIndexedPages((prev) => {
            if (prev) return prev;
            setCrawlPrefilled(true);
            return String(count);
          });
        }
      } catch {
        // ignore
      }
    }
    void loadLatestCrawlCount();
    return () => {
      cancelled = true;
    };
  }, []);
  const [keywordReportUrl, setKeywordReportUrl] = useState("");
  const [compSetNotes, setCompSetNotes] = useState("");
  const [visibilityScore, setVisibilityScore] = useState("");
  const [brandSentiment, setBrandSentiment] = useState("");
  const [brandMentions, setBrandMentions] = useState("");
  const [pagesCited, setPagesCited] = useState("");
  const [shareOfVoice, setShareOfVoice] = useState("");
  const [topCitedDomains, setTopCitedDomains] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BaselineResult | null>(null);

  const numOrUndef = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  async function handleRun() {
    if (!name.trim() || !url.trim()) {
      setError("Property Name and Property URL are required.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const nb = numOrUndef(nonBrandKeywords);
      const br = numOrUndef(brandKeywords);
      const total = nb !== undefined && br !== undefined ? nb + br : undefined;

      const res = await fetch("/api/tasks/seo-baseline-ai-visibility/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: { name: name.trim(), url: url.trim() },
          templateId: templateId.trim() || undefined,
          semrushSummary: {
            organicTraffic: numOrUndef(organicTraffic),
            totalRankingKeywords: total,
            nonBrandKeywords: nb,
            brandKeywords: br,
            referringDomains: numOrUndef(referringDomains),
            backlinks: numOrUndef(backlinks),
            indexedPages: numOrUndef(indexedPages),
            keywordReportUrl: keywordReportUrl.trim() || "",
          },
          compSetNotes: compSetNotes.trim() || undefined,
          aiVisibility: {
            visibilityScore: numOrUndef(visibilityScore),
            brandSentiment: numOrUndef(brandSentiment),
            brandMentions: numOrUndef(brandMentions),
            pagesCited: numOrUndef(pagesCited),
            shareOfVoice: numOrUndef(shareOfVoice),
            topCitedDomains: topCitedDomains
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate baseline deck.");
      setResult(json as BaselineResult);
      onCompleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate baseline deck.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="SEO Baseline & AI Visibility"
      subtitle="Populates the 10-slide Google Slides Baseline & AI Visibility template with Semrush, Crawl, Comp Set, and AI Visibility metrics."
      actions={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-slate-700">
            <span>Property / Website Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Nines Portland"
              className="input"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-700">
            <span>Client Property URL *</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://thenines.com/"
              className="input"
            />
          </label>
        </div>

        <label className="block space-y-1 text-xs font-medium text-slate-700">
          <span>Google Slides Template URL or ID</span>
          <input
            type="text"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="input text-xs"
          />
        </label>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Semrush &amp; Site Baseline (Slides 3–4)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="number"
              placeholder="Organic Traffic"
              value={organicTraffic}
              onChange={(e) => setOrganicTraffic(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Non-Brand Keywords"
              value={nonBrandKeywords}
              onChange={(e) => setNonBrandKeywords(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Brand Keywords"
              value={brandKeywords}
              onChange={(e) => setBrandKeywords(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Referring Domains"
              value={referringDomains}
              onChange={(e) => setReferringDomains(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Backlinks"
              value={backlinks}
              onChange={(e) => setBacklinks(e.target.value)}
              className="input"
            />
            <div className="relative">
              <input
                type="number"
                placeholder="Indexed Pages"
                value={indexedPages}
                onChange={(e) => {
                  setIndexedPages(e.target.value);
                  setCrawlPrefilled(false);
                }}
                className="input w-full"
              />
              {crawlPrefilled && (
                <span className="mt-1 block text-[10px] font-medium text-emerald-700">
                  Prefilled from latest Site Crawl
                </span>
              )}
            </div>
          </div>
          <input
            type="url"
            placeholder="Full Keyword Ranking Report Link (optional)"
            value={keywordReportUrl}
            onChange={(e) => setKeywordReportUrl(e.target.value)}
            className="input mt-3"
          />
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Comp Set &amp; AI Visibility (Slides 7–10)
          </div>
          <textarea
            rows={2}
            placeholder="Comp set notes (Claude summarizes into max 2 strategic sentences)..."
            value={compSetNotes}
            onChange={(e) => setCompSetNotes(e.target.value)}
            className="input mb-3"
          />
          <div className="grid gap-3 sm:grid-cols-5">
            <input
              type="number"
              placeholder="Visibility % (>30)"
              value={visibilityScore}
              onChange={(e) => setVisibilityScore(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Sentiment (0-100)"
              value={brandSentiment}
              onChange={(e) => setBrandSentiment(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Brand Mentions"
              value={brandMentions}
              onChange={(e) => setBrandMentions(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Pages Cited"
              value={pagesCited}
              onChange={(e) => setPagesCited(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Share of Voice %"
              value={shareOfVoice}
              onChange={(e) => setShareOfVoice(e.target.value)}
              className="input"
            />
          </div>
          <input
            type="text"
            placeholder="Top Cited Domains (comma-separated, e.g. tripadvisor.com, reddit.com)"
            value={topCitedDomains}
            onChange={(e) => setTopCitedDomains(e.target.value)}
            className="input mt-3"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-950 p-4 text-white">
          <Button onClick={() => void handleRun()} disabled={busy}>
            {busy ? "Generating Baseline Deck..." : "Generate SEO Baseline & AI Visibility"}
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${name.trim() && url.trim() ? "bg-brand" : "bg-slate-500"}`} />
              Property Required
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${organicTraffic ? "bg-brand" : "bg-slate-500"}`} />
              Semrush Optional
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${visibilityScore ? "bg-brand" : "bg-slate-500"}`} />
              AI Visibility Optional
            </span>
          </div>
        </div>

        {result && (() => {
          const baseline = result.data ?? result.output;
          if (!baseline) return null;
          return (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-emerald-900">
                Baseline Generated for {baseline.propertyName}
              </span>
              {baseline.presentationUrl && (
                <a
                  href={baseline.presentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-hilton underline underline-offset-2"
                >
                  Open Cloned Google Slides Deck
                </a>
              )}
            </div>
            {(result.flags ?? []).length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                Flag Summary: {result.flags.map((f) => f.message).join(" | ")}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {(baseline.slides ?? []).map((s) => (
                <div key={s.slideNumber} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="font-bold text-slate-900">
                    Slide {s.slideNumber}: {s.title}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-600">
                    {JSON.stringify(s.content, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
          );
        })()}
      </div>

      <GenerationProgressModal
        isOpen={busy}
        title="Generating SEO Baseline & AI Visibility Deck"
        subtitle="Extracting search performance, baseline rankings & AI summary..."
        targetName={name || url}
        estimatedSeconds={8}
      />
    </Card>
  );
}

