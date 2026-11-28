import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "./DeltaBadge";

export interface CategoryCardProps {
  href: string;
  name: string;
  icon: React.ReactNode;
  errorCount: number;
  warningCount: number;
  errorDelta?: number | null;
  warningDelta?: number | null;
  selected?: boolean;
  className?: string;
}

/**
 * Audit dimension navigation card with error/warning counters and selected sidebar-active state.
 */
export function CategoryCard({
  href,
  name,
  icon,
  errorCount,
  warningCount,
  errorDelta,
  warningDelta,
  selected = false,
  className,
}: CategoryCardProps) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "relative flex items-center justify-between gap-3 rounded border p-3.5 transition-colors duration-fast ease-telemetry",
        selected
          ? "border-sidebar-active bg-sidebar-active text-sidebar-text"
          : "border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2",
        className
      )}
    >
      {selected && (
        <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-brand" />
      )}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("shrink-0", selected ? "text-brand" : "text-text-muted")}>{icon}</span>
        <span className="truncate text-body font-medium">{name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-caption">
        <span
          className={cn(
            "nums inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium",
            selected ? "bg-error/20 text-sidebar-text" : errorCount > 0 ? "bg-error-soft text-error-fg" : "bg-surface-2 text-text-muted"
          )}
          title="Errors"
        >
          {errorCount}
          {errorDelta !== undefined && errorDelta !== null && errorDelta !== 0 && (
            <DeltaBadge value={errorDelta} goodWhen="down" />
          )}
        </span>
        <span
          className={cn(
            "nums inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium",
            selected ? "bg-warning/20 text-sidebar-text" : warningCount > 0 ? "bg-warning-soft text-warning-fg" : "bg-surface-2 text-text-muted"
          )}
          title="Warnings"
        >
          {warningCount}
          {warningDelta !== undefined && warningDelta !== null && warningDelta !== 0 && (
            <DeltaBadge value={warningDelta} goodWhen="down" />
          )}
        </span>
      </div>
    </Link>
  );
}
