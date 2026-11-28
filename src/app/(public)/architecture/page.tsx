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
    <div className="space-y-8">
      <nav aria-label="Breadcrumb Navigation" className="flex items-center gap-2 text-caption text-text-muted">
        <Link href="/" className="hover:underline">Home</Link>
        <span>/</span>
        <span className="font-medium text-text">System Architecture</span>
      </nav>

      <header className="space-y-2">
        <span className="inline-block rounded-sm bg-notice-soft px-2 py-0.5 text-caption font-medium text-notice-fg">
          Manifest V3 · React 18 · Python 3.11+
        </span>
        <h1 className="text-display text-text">System Architecture &amp; Technical Specifications</h1>
        <p className="max-w-[72ch] text-body text-text-muted">
          Engineering specifications detailing client-side inspection boundaries, physical pixel calculation tables, AI training data harvesting, hybrid inference routing, and Python fine-tuning pipelines.
        </p>
      </header>

      <section className="surface-card overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-caption text-text-muted">
          <span className="font-mono font-medium text-text">Multi-Tier Architecture Vector Topology</span>
          <a
            href="/system-architecture.svg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:underline"
          >
            Open Full Resolution SVG &rarr;
          </a>
        </div>
        <div className="w-full overflow-x-auto rounded-sm bg-sidebar p-3">
          <Image
            src="/system-architecture.svg"
            alt="SEO & GEO Studio System Architecture Diagram"
            width={1200}
            height={780}
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="w-full min-w-[700px] rounded-sm"
            priority
          />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <article className="surface-card p-5">
          <span className="text-overline uppercase text-text-muted">Subsystem 1</span>
          <h2 className="mt-1 text-heading text-text">Deterministic SERP Pixel Engine</h2>
          <p className="mt-2 max-w-[72ch] text-caption text-text-muted">
            Variable-width Arial glyph tables evaluate titles against the 580px desktop ceiling and meta descriptions against the 920px snippet threshold with physical precision.
          </p>
          <div className="mt-3 font-mono text-caption text-text-subtle">
            <code>src/engine/pixelCalculator.ts</code>
          </div>
        </article>

        <article className="surface-card p-5">
          <span className="text-overline uppercase text-text-muted">Subsystem 2</span>
          <h2 className="mt-1 text-heading text-text">Brand Standards &amp; Suffix Guardrails</h2>
          <p className="mt-2 max-w-[72ch] text-caption text-text-muted">
            Lexical scanner enforcing franchise title caps and prohibiting discount terminology across Marriott, Hilton, IHG, Hyatt, and Independent portfolios.
          </p>
          <div className="mt-3 font-mono text-caption text-text-subtle">
            <code>src/engine/brandGuardrails.ts</code>
          </div>
        </article>

        <article className="surface-card p-5">
          <span className="text-overline uppercase text-text-muted">Subsystem 3</span>
          <h2 className="mt-1 text-heading text-text">AI Training Data Vault &amp; PII Redactor</h2>
          <p className="mt-2 max-w-[72ch] text-caption text-text-muted">
            Read-only DOM extractor that strips emails, telephone numbers, and URL auth query tokens into SHA-256 deduplicated IndexedDB records with 0-100 quality scoring.
          </p>
          <div className="mt-3 font-mono text-caption text-text-subtle">
            <code>shared/ts/training-capture.ts · shared/ts/training-vault.ts</code>
          </div>
        </article>

        <article className="surface-card p-5">
          <span className="text-overline uppercase text-text-muted">Subsystem 4</span>
          <h2 className="mt-1 text-heading text-text">Custom Model Client &amp; Fallback Router</h2>
          <p className="mt-2 max-w-[72ch] text-caption text-text-muted">
            Multi-provider client dispatching to Google Vertex AI / tuned Gemini, custom REST vLLM endpoints, or Ollama, with automated zero-latency fallback to local rules.
          </p>
          <div className="mt-3 font-mono text-caption text-text-subtle">
            <code>chrome-extension/src/engine/custom-model-client.ts</code>
          </div>
        </article>
      </div>
    </div>
  );
}
