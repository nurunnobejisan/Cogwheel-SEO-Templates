import React from "react";

interface Props {
  score: number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
}

export function ScoreGauge({
  score,
  label,
  sublabel = "/ 100",
  color,
  size,
}: Props) {
  const safeScore = Math.min(100, Math.max(0, Math.round(score)));

  let statusText = "OPTIMAL";
  let statusBadgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let dotColor = "bg-emerald-400";
  let barColor = "bg-emerald-500";

  if (safeScore < 70) {
    statusText = "CRITICAL";
    statusBadgeStyle = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    dotColor = "bg-rose-400";
    barColor = "bg-rose-500";
  } else if (safeScore < 90) {
    statusText = "NEEDS REVIEW";
    statusBadgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    dotColor = "bg-amber-400";
    barColor = "bg-amber-500";
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-[#27272A] bg-[#111113] p-3 text-[#FAFAFA] transition hover:border-[#3F3F46]">
      {/* Top row: Label + Status Pill */}
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[11px] font-medium text-[#A1A1AA]">
          {label}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${statusBadgeStyle}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
          <span>{statusText}</span>
        </span>
      </div>

      {/* Middle row: Numerical Score with tabular-nums */}
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight text-[#FAFAFA] tabular-nums font-mono">
          {safeScore}
        </span>
        <span className="text-xs font-normal text-[#71717A] tabular-nums">
          {sublabel}
        </span>
      </div>

      {/* Bottom row: Precision Micro-Progress Bar */}
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-[#1F1F23]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}
