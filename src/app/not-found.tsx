import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-display font-mono text-text-muted">404</span>
      <h1 className="text-title text-text">Page not found</h1>
      <p className="text-body text-text-muted">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link
        href="/"
        className="inline-flex h-9 items-center justify-center rounded-sm bg-brand px-4 text-body font-medium text-brand-fg transition-colors hover:bg-brand/90"
      >
        Back to overview
      </Link>
    </main>
  );
}
