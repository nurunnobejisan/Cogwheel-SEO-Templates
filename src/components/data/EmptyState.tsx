import * as React from "react";
import { TelemetryGrid } from "@/components/motion";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Compact empty state with subtle telemetry dot-grid, icon, single sentence, and one clear action.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <TelemetryGrid className={cn("border-dashed px-6 py-10 text-center", className)}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-surface-2 text-text-muted">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <h3 className="text-heading text-text">{title}</h3>
          <p className="max-w-[72ch] text-caption text-text-muted">{description}</p>
        </div>
        {action && <div className="pt-1">{action}</div>}
      </div>
    </TelemetryGrid>
  );
}
