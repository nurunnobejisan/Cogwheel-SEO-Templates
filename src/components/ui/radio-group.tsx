"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2.5", className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label?: string;
  helperText?: string;
}

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, label, helperText, id, ...props }, ref) => {
  const reactId = React.useId();
  const radioId = id || reactId;

  const radio = (
    <RadioGroupPrimitive.Item
      ref={ref}
      id={radioId}
      className={cn(
        "tap-compact aspect-square h-4 w-4 rounded-full border border-border-strong bg-surface text-brand transition-colors duration-fast ease-telemetry data-[state=checked]:border-brand disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="h-2 w-2 rounded-full bg-brand" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );

  if (!label && !helperText) return radio;

  return (
    <div className="flex items-start gap-2.5">
      <div className="pt-0.5">{radio}</div>
      <div className="space-y-0.5">
        {label && (
          <label htmlFor={radioId} className="cursor-pointer text-body text-text select-none">
            {label}
          </label>
        )}
        {helperText && <p className="text-caption text-text-muted">{helperText}</p>}
      </div>
    </div>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
