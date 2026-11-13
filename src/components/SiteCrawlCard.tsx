"use client";

import { useState } from "react";
import { Button, Card, Stat } from "./ui";

interface SiteCrawlSummaryData {
  robotsTxtPresent?: boolean;
  brokenLinks?: Array<{ url: string; statusCode: number; foundOn: string[] }>;
  redirectChains?: Array<{ url: string; finalUrl: string }>;
  orphanPages?: string[];
  missingFromSitemap?: string[];
  jsRenderedPages?: string[];
  issueCounts?: Record<string, number>;
}

interface SiteCrawlRunState {
  crawlRunId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: { crawled: number; discovered: number };
  siteSummary: SiteCrawlSummaryData;
}

export function SiteCrawlCard({ onCompleted }: { onCompleted?: () => void }) {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(150);
  const [crawlDepth, setCrawlDepth] = useState(4);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runState, setRunState] = useState<SiteCrawlRunState | null>(null);

  async function startCrawl() {
    if (!url.trim()) {
      setError("Enter a property URL to crawl.");
      return;
    }
    setError(null);
    setRunning(true);

    try {
      const res = await fetch("/api/tasks/site-crawl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          maxPages,
          crawlDepth,
          batchSize: 10,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Site crawl failed to start.");
      }

      let current: SiteCrawlRunState = json.data;
      setRunState(current);

      while (current.status === "running") {
        const stepRes = await fetch("/api/tasks/site-crawl/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crawlRunId: current.crawlRunId,
            batchSize: 10,
          }),
        });
        const stepJson = await stepRes.json();
        if (!stepRes.ok) {
          throw new Error(stepJson.error || "Site crawl batch failed.");
        }
        current = stepJson.data;
        setRunState(current);
      }

      onCompleted?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const pct =
    runState && runState.progress.discovered > 0
      ? Math.min(100, Math.round((runState.progress.crawled / runState.progress.discovered) * 100))
      : 0;

  return (
    <Card
      title="Site Crawl (Shared Infrastructure)"
      subtitle="Respects robots.txt and sitemap.xml, rate-limited at 2 req/s, and stores per-page facts for downstream tasks."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Property URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example-hotel.com/"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Max Pages</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value) || 150)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Max Depth</label>
            <input
              type="number"
              min={0}
              max={10}
              value={crawlDepth}
              onChange={(e) => setCrawlDepth(Number(e.target.value) || 4)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button variant="primary" disabled={running} onClick={startCrawl}>
            {running ? "Crawling..." : "Run Site Crawl"}
          </Button>
          {runState && (
            <span className="text-xs font-medium text-slate-600">
              {runState.progress.crawled} / {runState.progress.discovered} pages ({pct}%)
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        {runState && (
          <div className="space-y-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-slate-900 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            {runState.status === "completed" && (
              <div className="grid gap-3 sm:grid-cols-5">
                <Stat label="Pages Crawled" value={runState.progress.crawled} />
                <Stat
                  label="Broken Links"
                  value={runState.siteSummary.brokenLinks?.length ?? 0}
                  tone={(runState.siteSummary.brokenLinks?.length ?? 0) > 0 ? "warn" : "good"}
                />
                <Stat
                  label="Redirects"
                  value={runState.siteSummary.redirectChains?.length ?? 0}
                />
                <Stat
                  label="Orphan Pages"
                  value={runState.siteSummary.orphanPages?.length ?? 0}
                  tone={(runState.siteSummary.orphanPages?.length ?? 0) > 0 ? "warn" : "good"}
                />
                <Stat
                  label="JS-Only Pages"
                  value={runState.siteSummary.jsRenderedPages?.length ?? 0}
                  tone={(runState.siteSummary.jsRenderedPages?.length ?? 0) > 0 ? "warn" : "good"}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
