"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Global toast provider backed by Sonner and styled with semantic design tokens.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "rounded border border-border bg-surface text-text shadow-pop font-sans text-body",
          title: "font-medium text-text",
          description: "text-caption text-text-muted",
          actionButton: "bg-brand text-brand-fg font-medium rounded-sm px-2.5 py-1 text-caption",
          cancelButton: "bg-surface-2 text-text-muted rounded-sm px-2.5 py-1 text-caption",
          error: "border-error/30 bg-error-soft text-error-fg",
          success: "border-success/30 bg-success-soft text-success-fg",
          warning: "border-warning/30 bg-warning-soft text-warning-fg",
          info: "border-notice/30 bg-notice-soft text-notice-fg",
        },
      }}
    />
  );
}

export { toast };
