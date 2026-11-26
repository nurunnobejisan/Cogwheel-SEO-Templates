import Link from "next/link";

/** Global 404 page. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-display text-5xl font-extrabold gradient-text-brand">404</span>
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="text-body text-slate-600 dark:text-slate-400">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-brand px-4 py-2 text-body font-bold text-slate-900 shadow-glow transition hover:bg-brand-light"
      >
        Back to overview
      </Link>
    </main>
  );
}
