"use client";

import * as React from "react";
import { MotionConfig, motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Global Framer Motion wrapper respecting OS reduced-motion preferences.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/**
 * Smooth count-up / numeric display with tabular figures.
 */
export function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return;
    const duration = 360;
    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={cn("nums", className)}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

/**
 * Crisp 8px + opacity reveal for view/panel transitions.
 */
export function FadeSlide({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Architectural telemetry dot-grid backdrop used selectively in empty states,
 * live crawl headers, and public showcase headers.
 */
export function TelemetryGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded border border-border bg-surface", className)}>
      <div aria-hidden="true" className="telemetry-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Animated signal dot indicating live telemetry or active crawl streams.
 */
export function SignalPulse({
  tone = "brand",
  active = true,
  className,
}: {
  tone?: "brand" | "success" | "warning" | "error" | "notice";
  active?: boolean;
  className?: string;
}) {
  const toneClass = {
    brand: "bg-brand",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
    notice: "bg-notice",
  }[tone];

  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0 items-center justify-center", className)}>
      {active && (
        <span
          aria-hidden="true"
          className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", toneClass)}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", toneClass)} />
    </span>
  );
}

export { motion, AnimatePresence };
