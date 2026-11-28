import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard shortcut keycap badge in Geist Mono.
 */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-surface-2 px-1.5 font-mono text-caption text-text-muted",
        className
      )}
      {...props}
    />
  );
}
