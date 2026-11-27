import type { Metadata } from "next";
import Link from "next/link";
import { DailySessionDashboard } from "@/components/DailySessionDashboard";

export const metadata: Metadata = {
  title: "Daily Session — SEO Studio",
  description:
    "Start one focused daily session: 15 minutes learning, 40 minutes building, 5 minutes contributing to open source.",
};

export default function DailySessionPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-caption font-bold text-brand-light dark:bg-brand dark:text-slate-950"
            >
              SJ
            </Link>
            <div>
              <h1 className="font-display text-base font-extrabold text-slate-900 dark:text-white">Daily Session</h1>
              <p className="text-tiny text-slate-500 dark:text-slate-400">Learn · Build · Community</p>
            </div>
          </div>

          <nav aria-label="Header Navigation" className="flex items-center gap-2 text-caption font-semibold">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              ← Back to Studio
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <DailySessionDashboard />
      </main>
    </div>
  );
}
