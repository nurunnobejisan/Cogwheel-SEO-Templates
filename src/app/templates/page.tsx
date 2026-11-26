import type { Metadata } from "next";
import Link from "next/link";
import { TemplatesHubClient } from "./TemplatesHubClient";

export const metadata: Metadata = {
  title: "Hospitality SEO & GEO Templates — SEO Studio Platform",
  description:
    "Production-ready on-page, lodging schema, GEO AI visibility, and GBP UNAP audit templates tailored for Marriott, Hilton, IHG, Hyatt, and luxury hotels.",
};

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Section Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-caption font-bold text-brand-light dark:bg-brand dark:text-slate-950"
            >
              SJ
            </Link>
            <div>
              <h1 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                SEO &amp; GEO Studio
              </h1>
              <p className="text-tiny text-slate-500 dark:text-slate-400">Master Hospitality Templates Catalog</p>
            </div>
          </div>

          <nav aria-label="Header Navigation" className="flex items-center gap-2 text-caption font-semibold">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Studio
            </Link>
            <Link
              href="/templates"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-white shadow-xs dark:bg-brand dark:text-slate-950"
            >
              Templates
            </Link>
            <Link
              href="/strategy-matrix"
              className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Strategy Matrix
            </Link>
            <Link
              href="/architecture"
              className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Architecture
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <nav aria-label="Breadcrumb Navigation" className="mb-6 flex items-center gap-2 text-caption text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-white">Templates Catalog</span>
        </nav>

        <header className="mb-8 space-y-1">
          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-micro font-bold text-emerald-700 uppercase tracking-wider dark:bg-emerald-950/60 dark:text-emerald-300">
            Battle-Tested SEO &amp; GEO Blueprints
          </span>
          <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            Hospitality SEO &amp; GEO Templates Hub
          </h2>
          <p className="max-w-3xl text-body text-slate-600 dark:text-slate-400">
            12 complete, production-ready SEO templates across 6 core categories. Filter by category, test queries in real time, customize variables, and preview SERP snippet pixels.
          </p>
        </header>

        {/* Client-Interactive Search, Filter, and Card Grid */}
        <TemplatesHubClient />
      </main>
    </div>
  );
}
