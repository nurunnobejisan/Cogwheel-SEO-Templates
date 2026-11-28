"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

/**
 * Multi-line form field with label above and helper or error text below.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helperText, error, id, ...props }, ref) => {
    const reactId = React.useId();
    const textareaId = id || reactId;
    const messageId = `${textareaId}-message`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-caption font-medium text-text-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={cn(
            "flex min-h-20 w-full rounded-sm border bg-surface px-3 py-2 text-body text-text transition-colors duration-fast ease-telemetry placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
Textarea.displayName = "Textarea";
