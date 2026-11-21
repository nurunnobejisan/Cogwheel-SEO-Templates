import React from "react";
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { QuickWinItem } from "../types/extension";

interface Props {
  quickWins: QuickWinItem[];
  onFixWithTemplate: (templateId: string) => void;
}

export function QuickWinsList({ quickWins, onFixWithTemplate }: Props) {
  if (quickWins.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-center dark:border-emerald-800/80 dark:bg-emerald-950/30">
        <div className="font-display text-sm font-bold text-emerald-800 dark:text-emerald-200">
          All 10 Core Quality Gates Passed
        </div>
        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
          Zero critical SEO or GEO blocking issues detected on this live page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          DETECTED ISSUES &amp; QUICK WINS ({quickWins.length})
        </span>
      </div>

      <div className="space-y-2">
        {quickWins.map((win) => {
          const isHigh = win.severity === "high";
          const isMed = win.severity === "medium";

          return (
            <div
              key={win.id}
              className={`rounded-xl border p-3 transition shadow-xs ${
                isHigh
                  ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30"
                  : isMed
                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30"
                    : "border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {isHigh ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  ) : isMed ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {win.title}
                    </h4>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {win.impact}
                    </p>
                  </div>
                </div>

                {win.templateIdToFix && (
                  <button
                    type="button"
                    onClick={() => onFixWithTemplate(win.templateIdToFix!)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
                  >
                    <span>Fix</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
