import * as React from "react";
import { Button } from "@/components/ui/index";
import { cn } from "@/lib/utils";
import { StatusIcon, type StatusKind } from "./StatusIcon";

export interface InlineAlertProps {
  variant?: StatusKind;
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<StatusKind, string> = {
  error: "border-error/25 bg-error-soft text-error-fg",
  warning: "border-warning/30 bg-warning-soft text-warning-fg",
  notice: "border-notice/25 bg-notice-soft text-notice-fg",
  success: "border-success/25 bg-success-soft text-success-fg",
};

/**
 * Inline semantic alert banner supporting retry actions and 72ch prose limit.
 */
export function InlineAlert({
  variant = "notice",
  title,
  description,
  onRetry,
  retryLabel = "Retry",
  action,
  className,
}: InlineAlertProps) {
  return (
    <aside
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded border p-3.5 sm:flex-row sm:items-start sm:justify-between",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">
          <StatusIcon status={variant} />
        </div>
        <div className="space-y-0.5">
          <p className="text-body font-medium">{title}</p>
          {description && <p className="max-w-[72ch] text-caption opacity-90">{description}</p>}
        </div>
      </div>
      {(onRetry || action) && (
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
