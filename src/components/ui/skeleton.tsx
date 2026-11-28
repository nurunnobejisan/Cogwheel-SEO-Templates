import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 1.2s shimmer loading placeholder using surface tokens.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-sm bg-surface-2", className)}
      {...props}
    />
  );
}

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return <Loader2 className={cn("animate-spin text-text-muted", cls)} aria-label="Loading" />;
}

