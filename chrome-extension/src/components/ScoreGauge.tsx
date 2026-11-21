import React from "react";

interface Props {
  score: number;
  label: string;
  size?: number;
  color?: string;
  sublabel?: string;
}

export function ScoreGauge({
  score,
  label,
  size = 80,
  color,
  sublabel,
}: Props) {
  const radius = size * 0.38;
  const strokeWidth = size * 0.08;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const strokeColor =
    color ||
    (score >= 90
      ? "#10b981"
      : score >= 75
        ? "#0284c7"
        : score >= 55
          ? "#f59e0b"
          : "#ef4444");

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="-rotate-90 transform" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-800"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-black tracking-tight text-slate-900 dark:text-white">
            {score}
          </span>
          {sublabel && (
            <span className="text-[9px] font-bold text-slate-400">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span className="mt-1 text-[11px] font-bold tracking-tight text-slate-700 dark:text-slate-300">
        {label}
      </span>
    </div>
  );
}
