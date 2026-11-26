"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Next.js renders this instead of the generic
 * error screen when a route segment throws during render or data fetching.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for local debugging / log drain.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-caption font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
        Something went wrong
      </span>
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
        This view failed to render
      </h1>
      <p className="text-body text-slate-600 dark:text-slate-400">
        An unexpected error interrupted the dashboard. Your data is unaffected — retry, or
        return to the overview.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-brand px-4 py-2 text-body font-bold text-slate-900 shadow-glow transition hover:bg-brand-light"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-xl border border-slate-200 px-4 py-2 text-body font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Back to overview
        </a>
      </div>
      {error.digest ? (
        <p className="text-caption text-slate-400 dark:text-slate-500">Reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
