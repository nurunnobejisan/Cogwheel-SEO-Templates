export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        aria-hidden
        className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand"
      />
      <p className="text-body text-text-muted">Loading workspace...</p>
    </main>
  );
}
