import * as React from "react";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "./DeltaBadge";

export interface MetricRowProps {
  label: string;
  value: string | number | null | undefined;
  delta?: number | null;
  goodWhen?: "down" | "up";
  className?: string;
}

/**
 * Dotted-leader metric line matching SE Ranking Domain Metrics tables.
 */
export function MetricRow({ label, value, delta, goodWhen = "up", className }: MetricRowProps) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
      ? value.toLocaleString()
      : value;

  return (
    <div className={cn("flex items-baseline gap-2.5 py-1.5 text-body", className)}>
      <span className="shrink-0 text-text-muted">{label}</span>
      <span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-border-strong" />
      <span className="nums shrink-0 font-medium text-text">{display}</span>
      {delta !== undefined && delta !== null && <DeltaBadge value={delta} goodWhen={goodWhen} />}
    </div>
  );
}
