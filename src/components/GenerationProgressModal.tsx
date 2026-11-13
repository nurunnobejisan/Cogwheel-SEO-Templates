"use client";

import { useEffect, useState } from "react";

interface GenerationStep {
  label: string;
  sublabel: string;
}

interface GenerationProgressModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  targetName?: string;
  estimatedSeconds?: number;
  steps?: GenerationStep[];
  onCancel?: () => void;
}

const DEFAULT_STEPS: GenerationStep[] = [
  { label: "Validating Files", sublabel: "Verifying PowerPoint template & Excel workbook" },
  { label: "Parsing Rankings", sublabel: "Extracting tracked & ancillary keyword metrics" },
  { label: "Generating Slides", sublabel: "Populating executive summaries, tables & charts" },
  { label: "Sanitizing Deck", sublabel: "Permanently stripping all template comments & pins" },
  { label: "Packaging Deliverable", sublabel: "Compressing presentation and finalizing download" },
];

export function GenerationProgressModal({
  isOpen,
  title = "Generating SEO Visibility Deck",
  subtitle = "Building presentation from Semrush audit & keyword workbook...",
  targetName,
  estimatedSeconds = 10,
  steps = DEFAULT_STEPS,
}: GenerationProgressModalProps) {
  const [elapsed, setElapsed] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setElapsed(0);
      setCurrentStepIndex(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(seconds);

      // Distribute steps across estimated duration
      const stepInterval = Math.max(1, Math.floor(estimatedSeconds / steps.length));
      const nextStep = Math.min(steps.length - 1, Math.floor(seconds / stepInterval));
      setCurrentStepIndex(nextStep);
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, estimatedSeconds, steps.length]);

  if (!isOpen) return null;

  const remainingSeconds = Math.max(0, estimatedSeconds - elapsed);
  const progressPercent = Math.min(
    95,
    Math.round(((elapsed + 0.5) / (estimatedSeconds + 1)) * 100)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl transition-all duration-300">
        {/* Glow ambient backgrounds */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl" />

        {/* Top Header */}
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand animate-ping" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                AI Deck Builder In Progress
              </span>
            </div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-slate-900">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>

          {/* Countdown Clock Badge */}
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-sm">
              <span className="font-display text-lg font-black tabular-nums text-slate-900">
                {remainingSeconds > 0 ? `${remainingSeconds}s` : "Wrapping up..."}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {remainingSeconds > 0 ? "left" : ""}
              </span>
            </div>
            <span className="mt-1 text-[10px] font-medium text-slate-400">
              Elapsed: {elapsed}s
            </span>
          </div>
        </div>

        {targetName && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>Target Property: {targetName}</span>
          </div>
        )}

        {/* Circular Progress & Visual Center */}
        <div className="relative my-6 flex flex-col items-center justify-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="7"
                fill="transparent"
                className="text-slate-100"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray={264}
                strokeDashoffset={264 - (264 * progressPercent) / 100}
                strokeLinecap="round"
                className="text-brand transition-all duration-300 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-black text-slate-900 tabular-nums">
                {progressPercent}%
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Processed
              </span>
            </div>
          </div>

          {/* Active Step Highlight */}
          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-slate-900 ring-1 ring-brand/30">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
              {steps[currentStepIndex]?.label}
            </span>
            <p className="mt-1 text-xs text-slate-500">
              {steps[currentStepIndex]?.sublabel}
            </p>
          </div>
        </div>

        {/* Step Progression Timeline */}
        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.label}
                className={`flex items-center justify-between text-xs transition-colors duration-200 ${
                  isCurrent
                    ? "font-bold text-slate-900"
                    : isCompleted
                    ? "text-slate-500"
                    : "text-slate-400 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCompleted
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-brand text-slate-950 shadow-glow"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span>{step.label}</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  {isCompleted ? "Completed" : isCurrent ? "Processing..." : "Queued"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner Note */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Auto-sanitizes all comments & pins
          </span>
          <span className="font-semibold text-slate-500">
            Auto-downloads when ready
          </span>
        </div>
      </div>
    </div>
  );
}
