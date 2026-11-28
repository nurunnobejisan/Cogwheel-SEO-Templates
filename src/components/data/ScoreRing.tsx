"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/motion";
import { cn } from "@/lib/utils";

export interface ScoreRingProps {
  score: number | null | undefined;
  label?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Animated 0-100 SVG health score gauge colored by diagnostic threshold.
 */
export function ScoreRing({
  score,
  label = "Health Score",
  size = 112,
  strokeWidth = 9,
  className,
}: ScoreRingProps) {
  const valid = typeof score === "number" && !Number.isNaN(score);
  const clamped = valid ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (clamped / 100) * circumference;

  const strokeToken = !valid
    ? "stroke-border-strong"
    : clamped >= 80
    ? "stroke-success"
    : clamped >= 50
    ? "stroke-warning"
    : "stroke-error";

  const statusLabel = !valid
    ? "Not measured"
    : clamped >= 80
    ? "Healthy"
    : clamped >= 50
    ? "Needs work"
    : "Critical";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-surface-2"
          />
          {valid && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: targetOffset }}
              transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
              className={strokeToken}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="nums text-title font-semibold text-text">
            {valid ? <AnimatedNumber value={clamped} /> : "—"}
          </span>
          <span className="text-caption text-text-muted">/ 100</span>
        </div>
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-overline uppercase text-text-muted">{label}</p>
        <p className="text-heading text-text">{statusLabel}</p>
        <p className="text-caption text-text-muted">
          {valid ? "Calculated across 11 SEO & GEO dimensions" : "Run a full audit to measure"}
        </p>
      </div>
    </div>
  );
}
