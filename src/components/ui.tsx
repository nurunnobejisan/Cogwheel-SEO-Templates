"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useEffect, useId, useRef } from "react";
import type { KeywordFlag } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────────
   Card
   ───────────────────────────────────────────────────────────────────────────── */

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Applied to the inner content wrapper (defaults to `p-6`). */
  bodyClassName?: string;
  as?: "section" | "article" | "div";
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "p-6",
  as: Component = "section",
}: CardProps) {
  return (
    <Component
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-soft transition-colors dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0">
            {title && (
              <h2 className="section-title">{title}</h2>
            )}
            {subtitle && <p className="section-subtitle text-pretty">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Component>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Button
   ───────────────────────────────────────────────────────────────────────────── */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-slate-900 font-display font-bold hover:bg-brand-light shadow-glow hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 dark:disabled:bg-slate-800 dark:disabled:text-slate-600",
  secondary:
    "border border-slate-200 bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  outline:
    "border border-slate-300 bg-transparent text-slate-700 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
  subtle:
    "bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  ghost:
    "text-slate-600 font-medium hover:bg-slate-100 disabled:text-slate-300 dark:text-slate-400 dark:hover:bg-slate-800 dark:disabled:text-slate-600",
  danger:
    "bg-rose-50 border border-rose-200 text-rose-700 font-semibold hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-caption rounded-lg gap-1.5",
  md: "px-4 py-2 text-body rounded-xl gap-2",
  lg: "px-5 py-2.5 text-h3 rounded-xl gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-all duration-200 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Stat / KPI
   ───────────────────────────────────────────────────────────────────────────── */

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
  /** 0–100. Renders a slim progress bar beneath the value. */
  progress?: number;
}

const STAT_TONES: Record<StatTone, string> = {
  default: "text-slate-900 dark:text-white",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
  brand: "text-brand-dark dark:text-brand",
};

export function Stat({ label, value, tone = "default", trend, subtext, icon, progress }: StatProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className={`mt-2 nums font-display text-2xl font-extrabold tracking-tight ${STAT_TONES[tone]}`}>
        {value}
      </div>
      {typeof progress === "number" && (
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-brand transition-all duration-500 ease-out-expo"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {(trend || subtext) && (
        <div className="mt-2 flex items-center gap-1.5 text-caption">
          {trend && (
            <span
              className={`inline-flex items-center font-bold nums ${
                trend.isGood === true
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trend.isGood === false
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-500"
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtext && <span className="text-slate-400 dark:text-slate-500">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Badge
   ───────────────────────────────────────────────────────────────────────────── */

export type BadgeVariant = "brand" | "success" | "warning" | "danger" | "info" | "neutral";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  title?: string;
  className?: string;
  /** Renders a status dot before the label. */
  dot?: boolean;
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  brand: "bg-brand/15 text-slate-900 border border-brand/30 dark:bg-brand/20 dark:text-brand-light",
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
  warning:
    "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
  danger:
    "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
  info: "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40",
  neutral:
    "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const BADGE_SIZES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-eyebrow",
  md: "px-2.5 py-1 text-caption",
};

export function Badge({ children, variant = "neutral", size = "md", title, className = "", dot }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full font-semibold transition-colors ${BADGE_SIZES[size]} ${BADGE_VARIANTS[variant]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Keyword flag badge & KD pill (preserved behavior)
   ───────────────────────────────────────────────────────────────────────────── */

const FLAG_STYLES: Record<KeywordFlag, { label: string; cls: string; title: string }> = {
  "kd-na": { label: "KD N/A", cls: "bg-slate-100 text-slate-600", title: "KD was N/A in the source export" },
  "low-sv-exception": {
    label: "Low-SV exception",
    cls: "bg-sky-100 text-sky-700",
    title: "SV < 10 kept: KD < 20 local venue demand generator",
  },
  "kd-unknown": {
    label: "KD unknown",
    cls: "bg-amber-100 text-amber-800",
    title: "Primary has no KD — verify before approving",
  },
  "kd-exception": {
    label: "KD ≥ 45",
    cls: "bg-rose-100 text-rose-700",
    title: "No KD < 45 candidate — high-difficulty exception requires approval",
  },
  "high-sv-exception-available": {
    label: "High-SV exception",
    cls: "bg-violet-100 text-violet-700",
    title: "A KD ≥ 45 keyword with much higher volume is available",
  },
  "no-candidates": { label: "No candidates", cls: "bg-rose-100 text-rose-700", title: "No keywords in this page's buckets" },
  "manual-override": { label: "Edited", cls: "bg-brand-100 text-slate-900", title: "Manually changed at checkpoint" },
};

export function FlagBadge({ flag }: { flag: KeywordFlag }) {
  const s = FLAG_STYLES[flag];
  if (!s) return null;
  return (
    <span title={s.title} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-eyebrow font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function KdPill({ kd, max = 45 }: { kd: number | null; max?: number }) {
  if (kd === null) return <span className="text-caption text-slate-400">N/A</span>;
  const cls =
    kd < 30 ? "text-emerald-700 font-medium" : kd < max ? "text-amber-700 font-medium" : "text-rose-700 font-semibold";
  return <span className={`nums ${cls}`}>{kd}</span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Empty state
   ───────────────────────────────────────────────────────────────────────────── */

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
      {icon && <div className="rounded-2xl bg-white p-3 shadow-soft dark:bg-slate-800">{icon}</div>}
      <h3 className="font-display text-h3 font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="max-w-md text-caption text-slate-500 text-pretty dark:text-slate-400">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Notification banner
   ───────────────────────────────────────────────────────────────────────────── */

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationBannerProps {
  title: string;
  description?: string;
  type?: NotificationType;
  onClose?: () => void;
}

const NOTIFICATION_STYLES: Record<NotificationType, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200",
  error: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200",
};

export function NotificationBanner({ title, description, type = "info", onClose }: NotificationBannerProps) {
  return (
    <aside
      aria-label="Notification"
      className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-caption ${NOTIFICATION_STYLES[type]}`}
    >
      <div>
        <p className="font-bold">{title}</p>
        {description && <p className="mt-0.5 opacity-90 text-pretty">{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      )}
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Modal dialog
   ───────────────────────────────────────────────────────────────────────────── */

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
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className={`relative flex w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-floating transition-all dark:border-slate-800 dark:bg-slate-900 ${MODAL_SIZES[size]}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-h2 font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {description && <p className="mt-1 text-caption text-slate-500 text-pretty dark:text-slate-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Form controls
   ───────────────────────────────────────────────────────────────────────────── */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className = "", id, ...props }: InputProps) {
  const reactId = useId().replace(/:/g, "");
  const inputId = id || (label ? `${label.toLowerCase().replace(/\s+/g, "-")}-${reactId}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`mt-1.5 block w-full rounded-xl border bg-white px-3.5 py-2 text-body text-slate-900 shadow-soft transition placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:border-slate-800 dark:bg-slate-900 dark:text-white ${
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
            : "border-slate-200 focus:border-brand focus:ring-brand/25 dark:focus:border-brand"
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-caption text-rose-600 dark:text-rose-400">{error}</p>}
      {!error && helperText && <p className="mt-1 text-caption text-slate-400">{helperText}</p>}
    </div>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, children, className = "", id, ...props }: SelectProps) {
  const reactId = useId().replace(/:/g, "");
  const selectId = id || (label ? `${label.toLowerCase().replace(/\s+/g, "-")}-${reactId}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`mt-1.5 block w-full rounded-xl border bg-white px-3.5 py-2 text-body text-slate-900 shadow-soft transition focus:outline-none focus:ring-2 dark:border-slate-800 dark:bg-slate-900 dark:text-white ${
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
            : "border-slate-200 focus:border-brand focus:ring-brand/25 dark:focus:border-brand"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-caption text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Spinner
   ───────────────────────────────────────────────────────────────────────────── */

export type SpinnerSize = "sm" | "md" | "lg";

const SPINNER_SIZES: Record<SpinnerSize, string> = {
  sm: "h-3.5 w-3.5 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export function Spinner({ size = "md" }: { size?: SpinnerSize }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-slate-900/20 border-t-slate-900 dark:border-white/20 dark:border-t-white ${SPINNER_SIZES[size]}`}
      aria-label="Loading"
    />
  );
}
