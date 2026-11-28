import * as React from "react";
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
