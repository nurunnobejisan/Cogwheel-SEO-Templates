"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

/**
 * 36px form text input with accessible label, helper text, and error state.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, helperText, error, id, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id || reactId;
    const messageId = `${inputId}-message`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-caption font-medium text-text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={cn(
            "flex h-9 w-full rounded-sm border bg-surface px-3 text-body text-text transition-colors duration-fast ease-telemetry placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-error focus:border-error"
              : "border-border-strong focus:border-brand",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={messageId} className="text-caption text-error-fg">
            {error}
          </p>
        ) : helperText ? (
          <p id={messageId} className="text-caption text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
