import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200/80 bg-slate-50/80 py-10 text-slate-600 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-caption font-bold text-brand-light dark:bg-brand dark:text-slate-950">
                RM
              </span>
              <span className="font-display text-body font-bold text-slate-900 dark:text-white">
                Razib Marketing — SEO &amp; GEO Studio
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-micro font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                v3.0.0
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-micro font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Updated: November 24, 2026
              </span>
            </div>
            <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
              Razib Marketing's hospitality search, pixel budgeting &amp; generative engine optimization suite.
            </p>
          </div>

          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center gap-4 text-caption font-semibold">
            <Link href="/" className="transition hover:text-slate-900 dark:hover:text-white">
              Studio
            </Link>
            <Link href="/templates" className="transition hover:text-slate-900 dark:hover:text-white">
              Templates
            </Link>
            <Link href="/strategy-matrix" className="transition hover:text-slate-900 dark:hover:text-white">
              Strategy Matrix
            </Link>
            <Link href="/architecture" className="transition hover:text-slate-900 dark:hover:text-white">
              Architecture
            </Link>
            <a
              href="https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              GitHub &rarr;
            </a>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-slate-200/60 pt-6 text-tiny text-slate-500 dark:border-slate-800/60 dark:text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Razib Marketing &amp;{" "}
            <a
              href="https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/graphs/contributors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Contributors
            </a>
            . Architected by{" "}
            <a
              href="https://github.com/jisan-razibmarketing"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-700 underline decoration-slate-400 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Shah Jisan (SJ)
            </a>
            . Distributed under the MIT License.
          </p>
          <p className="flex items-center gap-2">
            <span>Marriott &bull; Hilton &bull; IHG &bull; Hyatt &bull; Independent Luxury</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
