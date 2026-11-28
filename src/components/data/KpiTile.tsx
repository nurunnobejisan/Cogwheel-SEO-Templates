import * as React from "react";
import { Card } from "@/components/ui/index";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "./DeltaBadge";
import { Sparkline } from "./charts";

export interface KpiTileProps {
  label: string;
  value: number | string | null | undefined;
  suffix?: string;
  delta?: number | null;
  goodWhen?: "down" | "up";
  deltaSuffix?: string;
  sparkline?: number[];
  caption?: string;
  className?: string;
}

/**
 * Dense KPI tile with tabular numerals, semantic delta, optional sparkline,
 * and honest "Not measured" empty display rather than fake zeros.
 */
export function KpiTile({
  label,
  value,
  suffix = "",
  delta,
  goodWhen = "up",
  deltaSuffix = "",
  sparkline,
  caption,
  className,
}: KpiTileProps) {
  const isUnmeasured = value === null || value === undefined || value === "";
  const formatted =
    typeof value === "number" ? `${value.toLocaleString()}${suffix}` : `${value ?? ""}${suffix}`;

  return (
    <Card className={cn("flex flex-col justify-between p-4 md:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-overline uppercase text-text-muted">{label}</span>
        {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
      </div>

      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className={cn("nums text-display", isUnmeasured ? "text-text-subtle" : "text-text")}>
          {isUnmeasured ? "—" : formatted}
        </span>
        {!isUnmeasured && delta !== undefined && delta !== null && (
          <DeltaBadge value={delta} goodWhen={goodWhen} suffix={deltaSuffix} />
        )}
      </div>

      <p className="mt-1.5 text-caption text-text-muted">
        {isUnmeasured ? caption || "Not measured" : caption ?? "\u00A0"}
      </p>
    </Card>
  );
}
