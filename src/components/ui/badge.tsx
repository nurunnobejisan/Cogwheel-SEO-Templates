import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-caption font-medium transition-colors",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-text-muted border border-border",
        error: "bg-error-soft text-error-fg border border-error/20",
        warning: "bg-warning-soft text-warning-fg border border-warning/25",
        notice: "bg-notice-soft text-notice-fg border border-notice/20",
        success: "bg-success-soft text-success-fg border border-success/20",
        brand: "bg-brand-soft text-text border border-brand/35",
        outline: "border border-border-strong bg-transparent text-text-muted",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

/**
 * Compact 20px status and metadata pill using semantic `-soft` tokens.
 */
export function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { badgeVariants };
