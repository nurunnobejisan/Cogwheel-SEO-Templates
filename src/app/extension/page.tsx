import type { Metadata } from "next";
import Link from "next/link";
import { APP_VERSION } from "@/config/app-meta";

export const metadata: Metadata = {
  title: "Extension — SEO & GEO Studio",
  description:
    "Technical, On-Page, Off-Page, Local & AI-search (GEO) workflows in one free-first workspace.",
  alternates: { canonical: "/extension" },
};

export default function ExtensionPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-micro font-bold text-emerald-700 uppercase tracking-wider dark:bg-emerald-950/60 dark:text-emerald-300">
            Manifest V3 &bull; v{APP_VERSION}
          </span>
          <h1 className="font-display text-h2 font-extrabold text-slate-900 dark:text-white">Extension</h1>
          <p className="text-body text-slate-600 dark:text-slate-400">
            The extension is currently installed unpacked — there is no Chrome Web Store listing yet.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <a
            href="/seo-studio.zip"
            download="seo-studio.zip"
            className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-caption font-bold text-white shadow-xs transition hover:bg-brand-dark dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
            title="Download Chrome Extension (100-Point Live Inspector)"
          >
            Extension
          </a>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <ol className="list-decimal space-y-2 pl-5 text-body text-slate-700 dark:text-slate-300">
            <li>Open <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">chrome://extensions</code></li>
            <li>Enable <strong>Developer mode</strong></li>
            <li>Choose <strong>Load unpacked</strong> and select <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">chrome-extension/dist</code></li>
          </ol>
          <p className="mt-4 text-caption text-slate-500 dark:text-slate-400">
            There is no Chrome Web Store listing; use <strong>Load unpacked</strong> as shown above.
          </p>
          <p className="mt-2 text-caption text-slate-500 dark:text-slate-400">
            <Link href="/updates.xml" className="underline decoration-slate-400 hover:text-slate-900 dark:hover:text-white">
              updates.xml
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
