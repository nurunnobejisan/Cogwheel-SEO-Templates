/** Route-level loading skeleton shown while a segment streams in. */
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand dark:border-slate-700 dark:border-t-brand"
      />
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
    </main>
  );
}
