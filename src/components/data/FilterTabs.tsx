"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FilterTabOption {
  id: string;
  label: string;
  count?: number;
  href?: string;
}

export interface FilterTabsProps {
  options: FilterTabOption[];
  value: string;
  onChange?: (id: string) => void;
  layoutId?: string;
  className?: string;
}

/**
 * Segmented filter bar with tabular counts and shared layout pill motion.
 */
export function FilterTabs({
  options,
  value,
  onChange,
  layoutId = "filter-tabs-pill",
  className,
}: FilterTabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-sm border border-border bg-surface-2 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        const inner = (
          <>
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                className="absolute inset-0 rounded-sm bg-surface shadow-specular"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <span>{opt.label}</span>
              {typeof opt.count === "number" && (
                <span className={cn("nums text-caption", active ? "text-text" : "text-text-subtle")}>
                  {opt.count.toLocaleString()}
                </span>
              )}
            </span>
          </>
        );

        const baseCls = cn(
          "relative inline-flex h-8 items-center rounded-sm px-2.5 text-caption font-medium transition-colors duration-fast ease-telemetry",
          active ? "text-text" : "text-text-muted hover:text-text"
        );

        if (opt.href) {
          return (
            <Link
              key={opt.id}
              href={opt.href}
              role="tab"
              aria-selected={active}
              className={baseCls}
            >
              {inner}
            </Link>
          );
        }

        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(opt.id)}
            className={baseCls}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
