import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "System Architecture & Technical Specs — SEO Studio Suite",
  description:
    "Complete technical architecture for Manifest V3 extension, AI training data vault, hybrid model inference routing, and Python fine-tuning pipelines.",
};

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
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
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                  SEO &amp; GEO Studio
                </h1>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-micro font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  v3.0.0
                </span>
              </div>
              <p className="text-tiny text-slate-500 dark:text-slate-400">System Architecture Specifications</p>
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
              className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-white shadow-xs dark:bg-brand dark:text-slate-950"
            >
              Architecture
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <nav aria-label="Breadcrumb Navigation" className="mb-6 flex items-center gap-2 text-caption text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-white">System Architecture</span>
        </nav>

        <header className="mb-8 space-y-2">
          <span className="inline-block rounded-md bg-purple-50 px-2 py-0.5 text-micro font-bold text-purple-700 uppercase tracking-wider dark:bg-purple-950/60 dark:text-purple-300">
            Enterprise Multi-Tier Topology &bull; Manifest V3 &bull; React 18 &bull; Python 3.11+
          </span>
          <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            System Architecture &amp; Technical Specifications
          </h2>
          <p className="max-w-3xl text-body text-slate-600 dark:text-slate-400">
            Engineering specifications detailing client-side inspection boundaries, physical pixel calculation tables, AI training data harvesting, hybrid inference routing, and Python fine-tuning pipelines.
          </p>
        </header>

        {/* Vector SVG Architecture Diagram */}
        <section className="mb-10 rounded-2xl border border-slate-200/80 bg-black p-4 shadow-card overflow-hidden">
          <div className="mb-2 flex items-center justify-between text-caption text-slate-400">
            <span className="font-mono text-tiny font-semibold text-emerald-400">Multi-Tier Architecture Vector Topology</span>
            <a
              href="/system-architecture.svg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white"
            >
              Open Full Resolution SVG &rarr;
            </a>
          </div>
          <div className="w-full overflow-x-auto">
            <Image
              src="/system-architecture.svg"
              alt="SEO Studio System Architecture Diagram"
              width={1200}
              height={780}
              className="w-full min-w-[700px] rounded-lg"
              priority
            />
          </div>
        </section>

        {/* Core Pillars Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <span className="text-micro font-bold text-emerald-600 uppercase tracking-wider dark:text-emerald-400">
              Subsystem 1
            </span>
            <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
              Deterministic SERP Pixel Engine
            </h3>
            <p className="mt-2 text-caption text-slate-600 dark:text-slate-400">
              Variable-width Arial glyph tables evaluate titles against the 580px desktop ceiling and meta descriptions against the 920px snippet threshold with physical precision.
            </p>
            <div className="mt-3 font-mono text-tiny text-slate-500">
              <code>src/engine/pixelCalculator.ts</code>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <span className="text-micro font-bold text-blue-600 uppercase tracking-wider dark:text-blue-400">
              Subsystem 2
            </span>
            <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
              Brand Standards &amp; Suffix Guardrails
            </h3>
            <p className="mt-2 text-caption text-slate-600 dark:text-slate-400">
              Lexical scanner enforcing franchise title caps and prohibiting discount terminology across Marriott, Hilton, IHG, Hyatt, and Independent portfolios.
            </p>
            <div className="mt-3 font-mono text-tiny text-slate-500">
              <code>src/engine/brandGuardrails.ts</code>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <span className="text-micro font-bold text-purple-600 uppercase tracking-wider dark:text-purple-400">
              Subsystem 3
            </span>
            <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
              AI Training Data Vault &amp; PII Redactor
            </h3>
            <p className="mt-2 text-caption text-slate-600 dark:text-slate-400">
              Read-only DOM extractor that strips emails, telephone numbers, and URL auth query tokens into SHA-256 deduplicated IndexedDB records with 0-100 quality scoring.
            </p>
            <div className="mt-3 font-mono text-tiny text-slate-500">
              <code>shared/ts/training-capture.ts &bull; shared/ts/training-vault.ts</code>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <span className="text-micro font-bold text-pink-600 uppercase tracking-wider dark:text-pink-400">
              Subsystem 4
            </span>
            <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
              Custom Model Client &amp; Fallback Router
            </h3>
            <p className="mt-2 text-caption text-slate-600 dark:text-slate-400">
              Multi-provider client dispatching to Google Vertex AI / tuned Gemini, custom REST vLLM endpoints, or Ollama, with automated zero-latency fallback to local rules.
            </p>
            <div className="mt-3 font-mono text-tiny text-slate-500">
              <code>chrome-extension/src/engine/custom-model-client.ts</code>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
