"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/index";
import { cn } from "@/lib/utils";

export interface DistributionPoint {
  category: string;
  errors: number;
  warnings: number;
  notices: number;
}

interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-border bg-surface p-2.5 text-caption text-text shadow-pop">
      {label && <p className="mb-1.5 font-medium text-text">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="nums font-medium text-text">
              {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Stacked issue distribution bar chart per audit dimension using status CSS variables.
 */
export function DistributionChart({
  data,
  title = "Issue Distribution by Category",
  description = "Errors, warnings, and notices across site audit dimensions",
  className,
}: {
  data: DistributionPoint[];
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-caption text-text-muted">
            Run a full audit to populate category issue counts.
          </div>
        ) : (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
                  axisLine={{ stroke: "rgb(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="errors" name="Errors" stackId="a" fill="rgb(var(--error))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="warnings" name="Warnings" stackId="a" fill="rgb(var(--warning))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="notices" name="Notices" stackId="a" fill="rgb(var(--notice))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface TrendPoint {
  date: string;
  score: number;
  issues?: number;
}

/**
 * Line chart tracking overall health score and issue totals across crawls.
 */
export function TrendChart({
  data,
  title = "Health & Issue Trend",
  description = "Score progression across recorded crawls",
  className,
}: {
  data: TrendPoint[];
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-caption text-text-muted">
            No historical crawls recorded yet.
          </div>
        ) : (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
                  axisLine={{ stroke: "rgb(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Health score"
                  stroke="rgb(var(--brand))"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: "rgb(var(--brand))" }}
                />
                {data.some((d) => typeof d.issues === "number") && (
                  <Line
                    type="monotone"
                    dataKey="issues"
                    name="Issues"
                    stroke="rgb(var(--error))"
                    strokeWidth={1.8}
                    dot={{ r: 2.5, fill: "rgb(var(--error))" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 80x24 inline sparkline without axes for dense KPI tiles.
 */
export function Sparkline({
  data,
  tone = "brand",
  className,
}: {
  data: number[];
  tone?: "brand" | "success" | "error" | "muted";
  className?: string;
}) {
  if (data.length < 2) return null;
  const width = 80;
  const height = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - 3 - ((val - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const strokeClass = {
    brand: "stroke-brand",
    success: "stroke-success",
    error: "stroke-error",
    muted: "stroke-text-muted",
  }[tone];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={strokeClass}
      />
    </svg>
  );
}
