"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string;
  helperText?: string;
}

/**
 * Accessible Radix toggle switch with brand checked state.
 */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, helperText, id, ...props }, ref) => {
  const reactId = React.useId();
  const switchId = id || reactId;

  const control = (
    <SwitchPrimitive.Root
      ref={ref}
      id={switchId}
      className={cn(
        "tap-compact peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-2 transition-colors duration-fast ease-telemetry data-[state=checked]:border-brand data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-surface transition-transform duration-fast ease-telemetry data-[state=checked]:translate-x-4 data-[state=checked]:bg-brand-fg" />
    </SwitchPrimitive.Root>
  );

  if (!label && !helperText) return control;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        {label && (
          <label htmlFor={switchId} className="cursor-pointer text-body font-medium text-text select-none">
            {label}
          </label>
        )}
        {helperText && <p className="text-caption text-text-muted">{helperText}</p>}
      </div>
      {control}
    </div>
  );
});
Switch.displayName = SwitchPrimitive.Root.displayName;
