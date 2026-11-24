import Image from "next/image";

export function ArchitectureContent() {
  return (
    <div className="space-y-8">
      {/* Badge + Title */}
      <header className="space-y-2">
        <span className="inline-block rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase tracking-wider dark:bg-purple-950/60 dark:text-purple-300">
          Enterprise Multi-Tier Topology &bull; Manifest V3 &bull; React 18 &bull; Python 3.11+
        </span>
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
          System Architecture &amp; Technical Specifications
        </h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Engineering specifications detailing client-side inspection boundaries, physical pixel calculation
          tables, AI training data harvesting, hybrid inference routing, and Python fine-tuning pipelines.
        </p>
      </header>

      {/* Vector SVG Architecture Diagram */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-black p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[11px] font-semibold text-emerald-400">
            Multi-Tier Architecture Vector Topology
          </span>
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
            alt="Cogwheel SEO Studio System Architecture Diagram"
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Subsystem 1
          </span>
          <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
            Deterministic SERP Pixel Engine
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Variable-width Arial glyph tables evaluate titles against the 580px desktop ceiling and meta
            descriptions against the 920px snippet threshold with physical precision.
          </p>
          <div className="mt-3 font-mono text-[11px] text-slate-500">
            <code>src/engine/pixelCalculator.ts</code>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Subsystem 2
          </span>
          <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
            Brand Standards &amp; Suffix Guardrails
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Lexical scanner enforcing franchise title caps and prohibiting discount terminology across Marriott,
            Hilton, IHG, Hyatt, and Independent portfolios.
          </p>
          <div className="mt-3 font-mono text-[11px] text-slate-500">
            <code>src/engine/brandGuardrails.ts</code>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Subsystem 3
          </span>
          <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
            AI Training Data Vault &amp; PII Redactor
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Read-only DOM extractor that strips emails, telephone numbers, and URL auth query tokens into
            SHA-256 deduplicated IndexedDB records with 0-100 quality scoring.
          </p>
          <div className="mt-3 font-mono text-[11px] text-slate-500">
            <code>src/content/training-capture.ts &bull; src/storage/training-vault.ts</code>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
            Subsystem 4
          </span>
          <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
            Custom Model Client &amp; Fallback Router
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Multi-provider client dispatching to Google Vertex AI / tuned Gemini, custom REST vLLM endpoints,
            or Ollama, with automated zero-latency fallback to local rules.
          </p>
          <div className="mt-3 font-mono text-[11px] text-slate-500">
            <code>src/engine/custom-model-client.ts</code>
          </div>
        </article>
      </div>
    </div>
  );
}
