"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useId } from "react";
import { X, Loader2 } from "lucide-react";
import type { KeywordFlag } from "@/lib/types";
import {
  Badge as TokenBadge,
  Button as TokenButton,
  Card as TokenCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input as TokenInput,
  type BadgeProps as TokenBadgeProps,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   Thin compatibility wrapper around `src/components/ui/*` (removed in Phase 4)
   ───────────────────────────────────────────────────────────────────────────── */

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "article" | "div";
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "p-4 md:p-5",
  as: Component = "section",
}: CardProps) {
  return (
    <TokenCard className={className}>
      <Component>
        {(title || actions) && (
          <CardHeader>
            <div className="min-w-0">
              {title && <CardTitle>{title}</CardTitle>}
              {subtitle && <CardDescription>{subtitle}</CardDescription>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </CardHeader>
        )}
        <CardContent className={bodyClassName}>{children}</CardContent>
      </Component>
    </TokenCard>
  );
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const LEGACY_BUTTON_VARIANT: Record<ButtonVariant, "primary" | "secondary" | "ghost" | "destructive"> = {
  primary: "primary",
  secondary: "secondary",
  outline: "secondary",
  subtle: "secondary",
  ghost: "ghost",
  danger: "destructive",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  loading,
  children,
  ...props
}: ButtonProps) {
  return (
    <TokenButton
      variant={LEGACY_BUTTON_VARIANT[variant]}
      size={size}
      disabled={disabled}
      loading={loading}
      className={className}
      {...props}
    >
      {children}
    </TokenButton>
  );
}

export type StatTone = "default" | "good" | "warn" | "danger" | "brand";

export interface StatTrend {
  value: number | string;
  label?: string;
  isGood?: boolean;
}

export interface StatProps {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  trend?: StatTrend;
  subtext?: string;
  icon?: ReactNode;
  progress?: number;
}

const STAT_TONES: Record<StatTone, string> = {
  default: "text-text",
  good: "text-success-fg",
  warn: "text-warning-fg",
  danger: "text-error-fg",
  brand: "text-text",
};

export function Stat({ label, value, tone = "default", trend, subtext, icon, progress }: StatProps) {
  return (
    <div className="surface-card flex flex-col justify-between p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-overline uppercase text-text-muted">{label}</span>
        {icon && <span className="text-text-subtle">{icon}</span>}
      </div>
      <div className={cn("nums mt-2 text-display", STAT_TONES[tone])}>{value}</div>
      {typeof progress === "number" && (
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-brand transition-all duration-panel ease-telemetry"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {(trend || subtext) && (
        <div className="mt-2 flex items-center gap-1.5 text-caption">
          {trend && (
            <span
              className={cn(
                "nums inline-flex items-center font-medium",
                trend.isGood === true
                  ? "text-success-fg"
                  : trend.isGood === false
                  ? "text-error-fg"
                  : "text-text-muted"
              )}
            >
              {trend.value}
            </span>
          )}
          {subtext && <span className="text-text-muted">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

export type BadgeVariant = "brand" | "success" | "warning" | "danger" | "info" | "neutral";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  title?: string;
  className?: string;
  dot?: boolean;
}

const LEGACY_BADGE_VARIANT: Record<BadgeVariant, NonNullable<TokenBadgeProps["variant"]>> = {
  brand: "brand",
  success: "success",
  warning: "warning",
  danger: "error",
  info: "notice",
  neutral: "neutral",
};

export function Badge({ children, variant = "neutral", title, className = "", dot }: BadgeProps) {
  return (
    <TokenBadge variant={LEGACY_BADGE_VARIANT[variant]} title={title} className={className} dot={dot}>
      {children}
    </TokenBadge>
  );
}

const FLAG_STYLES: Record<KeywordFlag, { label: string; variant: NonNullable<TokenBadgeProps["variant"]>; title: string }> = {
  "kd-na": { label: "KD N/A", variant: "neutral", title: "KD was N/A in the source export" },
  "low-sv-exception": {
    label: "Low-SV exception",
    variant: "notice",
    title: "SV < 10 kept: KD < 20 local venue demand generator",
  },
  "kd-unknown": {
    label: "KD unknown",
    variant: "warning",
    title: "Primary has no KD — verify before approving",
  },
  "kd-exception": {
    label: "KD ≥ 45",
    variant: "error",
    title: "No KD < 45 candidate — high-difficulty exception requires approval",
  },
  "high-sv-exception-available": {
    label: "High-SV exception",
    variant: "notice",
    title: "A KD ≥ 45 keyword with much higher volume is available",
  },
  "no-candidates": { label: "No candidates", variant: "error", title: "No keywords in this page's buckets" },
  "manual-override": { label: "Edited", variant: "brand", title: "Manually changed at checkpoint" },
};

export function FlagBadge({ flag }: { flag: KeywordFlag }) {
  const s = FLAG_STYLES[flag];
  if (!s) return null;
  return (
    <TokenBadge variant={s.variant} title={s.title}>
      {s.label}
    </TokenBadge>
  );
}

export function KdPill({ kd, max = 45 }: { kd: number | null; max?: number }) {
  if (kd === null) return <span className="text-caption text-text-subtle">N/A</span>;
  const cls = kd < 30 ? "text-success-fg" : kd < max ? "text-warning-fg" : "text-error-fg";
  return <span className={cn("nums font-medium", cls)}>{kd}</span>;
}

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="telemetry-grid flex flex-col items-center justify-center gap-3 rounded border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
      {icon && <div className="rounded border border-border bg-surface p-2.5 text-text-muted">{icon}</div>}
      <h3 className="text-heading text-text">{title}</h3>
      <p className="max-w-[72ch] text-caption text-text-muted">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationBannerProps {
  title: string;
  description?: string;
  type?: NotificationType;
  onClose?: () => void;
}

const NOTIFICATION_STYLES: Record<NotificationType, string> = {
  info: "border-notice/30 bg-notice-soft text-notice-fg",
  success: "border-success/30 bg-success-soft text-success-fg",
  warning: "border-warning/30 bg-warning-soft text-warning-fg",
  error: "border-error/30 bg-error-soft text-error-fg",
};

export function NotificationBanner({ title, description, type = "info", onClose }: NotificationBannerProps) {
  return (
    <aside
      aria-label="Notification"
      className={cn("flex items-start justify-between gap-3 rounded border p-4 text-caption", NOTIFICATION_STYLES[type])}
    >
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-0.5 max-w-[72ch] opacity-90">{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="tap-compact rounded-sm p-1 text-current opacity-70 transition-opacity hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
}

const MODAL_SIZES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[95vw] h-[90vh]",
};

export function Modal({ isOpen, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={MODAL_SIZES[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className = "", id, ...props }: InputProps) {
  return <TokenInput label={label} error={error} helperText={helperText} className={className} id={id} {...props} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, children, className = "", id, ...props }: SelectProps) {
  const reactId = useId();
  const selectId = id || reactId;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-caption font-medium text-text-muted">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "flex h-9 w-full rounded-sm border bg-surface px-3 text-body text-text transition-colors focus:outline-none",
          error ? "border-error focus:border-error" : "border-border-strong focus:border-brand",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-caption text-error-fg">{error}</p>}
    </div>
  );
}

export type SpinnerSize = "sm" | "md" | "lg";

const SPINNER_SIZES: Record<SpinnerSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function Spinner({ size = "md" }: { size?: SpinnerSize }) {
  return <Loader2 className={cn("animate-spin text-text-muted", SPINNER_SIZES[size])} aria-label="Loading" />;
}
