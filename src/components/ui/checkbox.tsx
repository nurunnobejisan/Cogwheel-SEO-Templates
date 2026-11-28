"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  helperText?: string;
}

/**
 * Accessible Radix checkbox with optional label and helper caption.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, helperText, id, ...props }, ref) => {
  const reactId = React.useId();
  const checkboxId = id || reactId;

  const box = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={checkboxId}
      className={cn(
        "tap-compact peer flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface transition-colors duration-fast ease-telemetry data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-fg disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label && !helperText) return box;

  return (
    <div className="flex items-start gap-2.5">
      <div className="pt-0.5">{box}</div>
      <div className="space-y-0.5">
        {label && (
          <label htmlFor={checkboxId} className="cursor-pointer text-body text-text select-none">
            {label}
          </label>
        )}
        {helperText && <p className="text-caption text-text-muted">{helperText}</p>}
      </div>
    </div>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
