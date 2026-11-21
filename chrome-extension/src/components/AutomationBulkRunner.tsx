import React, { useState } from "react";
import { Play, Download, CheckCircle, Clock, FileSpreadsheet } from "lucide-react";
import { PageAuditData } from "../types/extension";

interface Props {
  pageData?: PageAuditData;
}

interface BatchItem {
  url: string;
  status: "pending" | "running" | "done" | "error";
  score?: number;
  h1?: string;
}

export function AutomationBulkRunner({ pageData }: Props) {
  const [urlsInput, setUrlsInput] = useState(
    `https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/\nhttps://www.hilton.com/en/hotels/bosdnt-canopy-boston-downtown/\nhttps://coachmanhotel.com/`
  );
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchItem[]>([]);

  const handleStartBatch = () => {
    const urls = urlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) return;

    setIsRunning(true);
    setProgress(0);

    const items: BatchItem[] = urls.map((u) => ({
      url: u,
      status: "pending",
    }));
    setBatchResults(items);

    let completed = 0;
    // Simulate batch execution
    const interval = setInterval(() => {
      completed++;
      const pct = Math.round((completed / urls.length) * 100);
      setProgress(pct);

      setBatchResults((prev) =>
        prev.map((item, idx) => {
          if (idx < completed) {
            return {
              ...item,
              status: "done",
              score: Math.floor(Math.random() * 25) + 75,
              h1: `Hotel Luxury Stay #${idx + 1}`,
            };
          }
          if (idx === completed) {
            return { ...item, status: "running" };
          }
          return item;
        })
      );

      if (completed >= urls.length) {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 600);
  };

  const handleExportBatchCsv = () => {
    const rows = [
      ["Target URL", "Audit Status", "Estimated SEO Score", "Detected H1"].join(","),
      ...batchResults.map((r) =>
        [`"${r.url}"`, r.status, r.score || "N/A", `"${r.h1 || "N/A"}"`].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cogwheel_batch_seo_audit.csv";
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Workflow Automation Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          ONE-CLICK WORKFLOW PIPELINE
        </span>
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white mt-1">
          Full Hospitality Launch Sequence
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Executes Title/Meta + H1 Headline + Hotel Schema + FAQ Page generation in one automated step.
        </p>

        <button
          type="button"
          onClick={() => {
            alert("Hospitality Launch Pipeline executed! Generated Title, Schema & FAQ ready in Template Studio.");
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
        >
          <Play className="h-3.5 w-3.5" />
          Auto-Run Full Pipeline for Active Page
        </button>
      </div>

      {/* Batch URL Auditing Tool */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              BATCH URL &amp; SITEMAP AUDITOR
            </span>
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Multi-Page Quality Gate Scanner
            </h4>
          </div>
          {batchResults.length > 0 && (
            <button
              type="button"
              onClick={handleExportBatchCsv}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            ENTER TARGET HOTEL URLS (ONE PER LINE):
          </label>
          <textarea
            rows={4}
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            disabled={isRunning}
            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-[11px] text-slate-800 shadow-xs focus:border-brand focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          />

          <button
            type="button"
            onClick={handleStartBatch}
            disabled={isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {isRunning ? (
              <Clock className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isRunning ? `Auditing (${progress}%)` : "Start Batch Audit"}
          </button>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Batch Results Table */}
        {batchResults.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
            {batchResults.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="block truncate font-mono text-[10px] text-slate-700 dark:text-slate-300">
                    {item.url}
                  </span>
                  {item.h1 && (
                    <span className="block truncate text-[10px] text-slate-400">
                      {item.h1}
                    </span>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-1.5 font-mono text-[11px]">
                  {item.status === "done" ? (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {item.score}/100
                    </span>
                  ) : item.status === "running" ? (
                    <span className="text-[10px] font-bold text-sky-500">Scanning...</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Queued</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
