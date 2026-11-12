"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { KeywordFlag } from "@/lib/types";

export function Card({ title, subtitle, actions, children, className = "" }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: "bg-hilton text-white hover:bg-hilton-dark disabled:bg-slate-300",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
    danger: "text-red-600 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Stat({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "good" | "warn" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

const FLAG_STYLES: Record<KeywordFlag, { label: string; cls: string; title: string }> = {
  "kd-na": { label: "KD N/A", cls: "bg-slate-100 text-slate-600", title: "KD was N/A in the source export" },
  "low-sv-exception": { label: "Low-SV exception", cls: "bg-sky-100 text-sky-700", title: "SV < 10 kept: KD < 20 local venue demand generator" },
  "kd-unknown": { label: "KD unknown", cls: "bg-amber-100 text-amber-800", title: "Primary has no KD — verify before approving" },
  "kd-exception": { label: "KD ≥ 45", cls: "bg-red-100 text-red-700", title: "No KD < 45 candidate — high-difficulty exception requires approval" },
  "high-sv-exception-available": { label: "High-SV exception", cls: "bg-violet-100 text-violet-700", title: "A KD ≥ 45 keyword with much higher volume is available" },
  "no-candidates": { label: "No candidates", cls: "bg-red-100 text-red-700", title: "No keywords in this page's buckets" },
  "manual-override": { label: "Edited", cls: "bg-hilton-light text-hilton", title: "Manually changed at checkpoint" },
};

export function FlagBadge({ flag }: { flag: KeywordFlag }) {
  const s = FLAG_STYLES[flag];
  return (
    <span title={s.title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function KdPill({ kd, max = 45 }: { kd: number | null; max?: number }) {
  if (kd === null) return <span className="text-xs text-slate-400">N/A</span>;
  const cls = kd < 30 ? "text-emerald-700" : kd < max ? "text-amber-700" : "text-red-700 font-semibold";
  return <span className={`tabular-nums ${cls}`}>{kd}</span>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

