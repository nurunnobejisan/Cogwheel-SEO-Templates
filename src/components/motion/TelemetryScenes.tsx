"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SignalPulse, TelemetryGrid } from "./index";

/**
 * Animated radar/scanline telemetry scene for crawl progress & empty states.
 */
export function CrawlPulseScene({
  active = true,
  label = "Telemetry engine standby",
  sublabel = "Crawl pages, robots.txt, JSON-LD, and pixel widths",
  className,
}: {
  active?: boolean;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  return (
    <TelemetryGrid className={cn("p-4", className)}>
      <div className="flex items-center gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2">
          <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
            <circle cx="24" cy="24" r="18" fill="none" stroke="rgb(var(--border))" strokeWidth="1" />
            <circle cx="24" cy="24" r="10" fill="none" stroke="rgb(var(--border-strong))" strokeWidth="1" />
            {active && (
              <g style={{ transformOrigin: "24px 24px", animation: "radarSweep 2.4s linear infinite" }}>
                <line
                  x1="24"
                  y1="24"
                  x2="24"
                  y2="6"
                  stroke="rgb(var(--brand))"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            )}
            <circle cx="24" cy="24" r="3" fill="rgb(var(--brand))" />
          </svg>
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <SignalPulse tone="brand" active={active} />
            <span className="truncate text-body font-medium text-text">{label}</span>
          </div>
          <p className="truncate text-caption text-text-muted">{sublabel}</p>
        </div>
      </div>
    </TelemetryGrid>
  );
}

/**
 * Animated GEO Radar SVG showing AI engine citation nodes around the property hub.
 */
export function GeoRadarSweep({
  score,
  engines,
  className,
}: {
  score: number | null;
  engines: Array<{ name: string; value: number | null; connected: boolean }>;
  className?: string;
}) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const ringRadii = [34, 62, 92];

  return (
    <TelemetryGrid className={cn("flex flex-col items-center justify-center p-5", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {ringRadii.map((r) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgb(var(--border))"
            strokeDasharray={r === 62 ? "3 3" : undefined}
            strokeWidth={1}
          />
        ))}
        <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "radarSweep 7s linear infinite" }}>
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - 92}
            stroke="rgb(var(--brand) / 0.55)"
            strokeWidth={1.5}
          />
        </g>

        {engines.map((engine, idx) => {
          const angle = (idx / Math.max(1, engines.length)) * Math.PI * 2 - Math.PI / 2;
          const dist = engine.value !== null ? 44 + (engine.value / 100) * 48 : 82;
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          return (
            <g key={engine.name}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="rgb(var(--border-strong))"
                strokeWidth={1}
              />
              <circle
                cx={x}
                cy={y}
                r={5}
                fill={engine.connected ? "rgb(var(--brand))" : "rgb(var(--text-subtle))"}
              />
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                fill="rgb(var(--text-muted))"
                fontSize="10"
                fontWeight="500"
              >
                {engine.name}
              </text>
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r={20} fill="rgb(var(--surface))" stroke="rgb(var(--brand))" strokeWidth={2} />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill="rgb(var(--text))"
          fontSize="12"
          fontWeight="600"
        >
          {score !== null ? `${score}%` : "—"}
        </text>
      </svg>
    </TelemetryGrid>
  );
}

/**
 * Animated SERP pixel-width meter comparing measured title/meta width against Google truncation limits.
 */
export function SerpPixelMeter({
  label,
  pixels,
  limitPx,
  className,
}: {
  label: string;
  pixels: number;
  limitPx: number;
  className?: string;
}) {
  const ratio = Math.min(1.15, Math.max(0, pixels / Math.max(1, limitPx)));
  const pct = Math.min(100, Math.round((ratio / 1.15) * 100));
  const over = pixels > limitPx;
  const near = !over && pixels >= limitPx * 0.88;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-caption">
        <span className="font-medium text-text">{label}</span>
        <span className={cn("nums font-mono", over ? "text-error-fg" : near ? "text-warning-fg" : "text-success-fg")}>
          {pixels} / {limitPx} px
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            "h-full rounded-full",
            over ? "bg-error" : near ? "bg-warning" : "bg-brand"
          )}
        />
      </div>
    </div>
  );
}
