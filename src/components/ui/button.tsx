"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors duration-fast ease-telemetry focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg hover:bg-brand/90 active:bg-brand/80",
        secondary: "border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2",
        ghost: "text-text-muted hover:bg-surface-2 hover:text-text",
        destructive: "border border-error/30 bg-error-soft text-error-fg hover:bg-error/20",
        link: "h-auto p-0 text-link underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-caption",
        md: "h-9 px-3.5 text-body",
        lg: "h-10 px-4 text-body",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

/**
 * Primary action & control button with non-jumping loading spinner state.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, icon, children, disabled, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    const hasIcon = Boolean(icon);

    return (
      <Comp
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn("relative", buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          hasIcon || size === "icon" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
              {size !== "icon" && children}
            </>
          ) : (
            <>
              <span className="invisible inline-flex items-center gap-2">{children}</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              </span>
            </>
          )
        ) : (
          <>
            {icon && <span className="inline-flex shrink-0 items-center">{icon}</span>}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
