"use client";

import * as React from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/index";
import { cn } from "@/lib/utils";

export interface VitalMetric {
  label: "LCP" | "INP" | "CLS" | string;
  goodPct: number;
  needsWorkPct: number;
  poorPct: number;
  measuredValue?: string;
}

export interface VitalsBarProps {
  desktop?: VitalMetric[];
  mobile?: VitalMetric[];
  className?: string;
}

/**
 * 100% stacked horizontal Core Web Vitals bar with Desktop/Mobile toggle and semantic legend.
 * Shows an honest unmeasured state when no CrUX/field data has been recorded.
 */
export function VitalsBar({ desktop, mobile, className }: VitalsBarProps) {
  const [mode, setMode] = React.useState<"desktop" | "mobile">("desktop");
  const metrics = mode === "desktop" ? desktop : mobile;
  const hasData = Boolean(metrics && metrics.length > 0);

  return (
    <Card className={cn("flex flex-col justify-between", className)}>
      <CardHeader>
        <div>
          <CardTitle>Core Web Vitals</CardTitle>
          <CardDescription>LCP, INP, and CLS share distribution</CardDescription>
        </div>
        <div className="inline-flex rounded-sm border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setMode("desktop")}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-sm px-2 text-caption font-medium transition-colors",
              mode === "desktop" ? "bg-surface text-text shadow-specular" : "text-text-muted hover:text-text"
            )}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-sm px-2 text-caption font-medium transition-colors",
              mode === "mobile" ? "bg-surface text-text shadow-specular" : "text-text-muted hover:text-text"
            )}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            Mobile
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasData ? (
          <div className="space-y-3 py-4">
            {["LCP", "INP", "CLS"].map((label) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-caption">
                  <span className="font-medium text-text">{label}</span>
                  <span className="text-text-subtle">Not measured</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3.5">
            {metrics!.map((m) => {
              const total = Math.max(1, m.goodPct + m.needsWorkPct + m.poorPct);
              const g = (m.goodPct / total) * 100;
              const n = (m.needsWorkPct / total) * 100;
              const p = (m.poorPct / total) * 100;
              return (
                <div key={m.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-text">{m.label}</span>
                    <span className="nums text-text-muted">
                      {m.measuredValue ? m.measuredValue : `${Math.round(g)}% good`}
                    </span>
                  </div>
                  <svg
                    role="img"
                    aria-label={`${m.label}: ${Math.round(g)}% good, ${Math.round(n)}% needs improvement, ${Math.round(p)}% poor`}
                    viewBox="0 0 100 6"
                    preserveAspectRatio="none"
                    className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
                  >
                    <rect x="0" y="0" width={g} height="6" fill="rgb(var(--success))" />
                    <rect x={g} y="0" width={n} height="6" fill="rgb(var(--warning))" />
                    <rect x={g + n} y="0" width={p} height="6" fill="rgb(var(--error))" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-caption text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" /> Good
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" /> Needs improvement
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-error" aria-hidden="true" /> Poor
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
