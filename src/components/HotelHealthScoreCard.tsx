"use client";

import { useMemo } from "react";
import { Button } from "./ui";

interface Props {
  activeProperty: {
    name: string;
    brand: string;
    city: string;
    state: string;
    url: string;
  };
  latestRuns: Record<string, {
    id: string;
    taskId: string;
    status: string;
    flags: Array<{ code: string; message: string; severity: string }>;
  }>;
  onRunAudit: () => void;
}

export function HotelHealthScoreCard({ activeProperty, latestRuns, onRunAudit }: Props) {
  const crawlRun = latestRuns["site-crawl"];
  const techRun = latestRuns["technical-audit"];
  const titleRun = latestRuns["title-meta"];
  const schemaRun = latestRuns["schema-markup"];
  const dupRun = latestRuns["duplicate-content-audit"];
  const imgRun = latestRuns["image-optimization"];

  const hasAnyRun = Boolean(crawlRun || techRun || titleRun || schemaRun || dupRun || imgRun);

  const { score, statusLabel, statusColor, strokeColor, deductions, checks } = useMemo(() => {
    if (!hasAnyRun) {
      return {
        score: null,
        statusLabel: "Audit Pending",
        statusColor: "text-slate-500",
        strokeColor: "#94a3b8",
        deductions: [],
        checks: [
          { name: "Site Crawl", passed: false },
          { name: "Technical SEO", passed: false },
          { name: "Schema JSON-LD", passed: false },
          { name: "Title & Meta", passed: false },
        ],
      };
    }

    let calculated = 100;
    const foundDeductions: string[] = [];

    const allRuns = [crawlRun, techRun, titleRun, schemaRun, dupRun, imgRun].filter(Boolean);
    const totalFlags = allRuns.reduce((sum, r) => sum + (r?.flags.length ?? 0), 0);

    if (totalFlags > 0) {
      const deductionAmount = Math.min(30, totalFlags * 5);
      calculated -= deductionAmount;
      foundDeductions.push(`${totalFlags} flag(s) identified across audit modules (-${deductionAmount} pts)`);
    }

    if (!schemaRun) {
      calculated -= 8;
      foundDeductions.push("Schema JSON-LD not generated yet (-8 pts)");
    } else if (schemaRun.status === "Flagged") {
      calculated -= 6;
      foundDeductions.push("Schema markup has validation warnings (-6 pts)");
    }

    if (!titleRun) {
      calculated -= 8;
      foundDeductions.push("Title & Meta tags not optimized yet (-8 pts)");
    }

    if (techRun && techRun.status === "Flagged") {
      calculated -= 10;
      foundDeductions.push("Technical audit issues flagged (-10 pts)");
    }

    const finalScore = Math.max(35, Math.min(98, calculated));

    let label = "Optimal Health";
    let color = "text-emerald-600";
    let stroke = "#10b981";

    if (finalScore < 70) {
      label = "Needs Attention";
      color = "text-rose-600";
      stroke = "#f43f5e";
    } else if (finalScore < 85) {
      label = "Good (Optimizations Available)";
      color = "text-amber-600";
      stroke = "#f59e0b";
    }

    return {
      score: finalScore,
      statusLabel: label,
      statusColor: color,
      strokeColor: stroke,
      deductions: foundDeductions,
      checks: [
        { name: "Site Crawl", passed: Boolean(crawlRun) },
        { name: "Technical SEO", passed: Boolean(techRun && techRun.status !== "Flagged") },
        { name: "Schema.org", passed: Boolean(schemaRun && schemaRun.status !== "Flagged") },
        { name: "Title & Meta", passed: Boolean(titleRun && titleRun.status !== "Flagged") },
      ],
    };
  }, [hasAnyRun, crawlRun, techRun, titleRun, schemaRun, dupRun, imgRun]);

  const circumference = 2 * Math.PI * 38;
  const strokeDashoffset = score !== null
    ? circumference - (score / 100) * circumference
    : circumference * 0.75;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="38"
                className="stroke-slate-100"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r="38"
                stroke={strokeColor}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              {score !== null ? (
                <>
                  <span className="font-display text-2xl font-black text-slate-900 leading-none">
                    {score}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                </>
              ) : (
                <span className="text-xs font-bold text-slate-400">READY</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Hotel SEO Health Score
              </span>
              <span className={`text-xs font-bold ${statusColor}`}>
                • {statusLabel}
              </span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">
              {activeProperty.name ? activeProperty.name : "Select or Detect Property"}
            </h3>
            <p className="text-xs text-slate-500">
              {score !== null
                ? `${checks.filter((c) => c.passed).length} of 4 core SEO verification checks passed.`
                : "Run an auto-audit to calculate broken links, schema coverage, meta quality, and crawl health."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {checks.map((check) => (
              <div
                key={check.name}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  check.passed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    check.passed ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                {check.name}
              </div>
            ))}
          </div>

          <Button variant="primary" onClick={onRunAudit}>
            {hasAnyRun ? "Re-Run Full Audit" : "Run SEO Health Audit"}
          </Button>
        </div>
      </div>

      {deductions.length > 0 && (
        <div className="mt-3.5 border-t border-slate-100 pt-3">
          <div className="text-[11px] font-semibold text-slate-600">
            Audit Recommendations ({deductions.length}):
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {deductions.map((d, i) => (
              <span
                key={i}
                className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-1 text-amber-900"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
