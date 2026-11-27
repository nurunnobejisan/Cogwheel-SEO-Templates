import type { Metadata } from "next";
import Link from "next/link";
import {
  PACK_CATALOG,
  getPackMeta,
  type PackMeta,
} from "../../packs/catalog";
import { getPackMatrix, resolveMatrixPackId } from "../../packs/matrices";
import { StrategyMatrixContent } from "../../components/StrategyMatrixContent";

interface PageProps {
  searchParams?: { pack?: string; view?: string };
}

/**
 * Per-pack metadata (docs/TASKS.md Task 4.2). Every title is 50–60 chars and
 * every description 145–155 chars, all unique across the six packs — asserted
 * in tests/route-metadata.test.ts. Copy describes the authored dataset only.
 */
const MATRIX_TITLES: Record<string, string> = {
  hotel: "78-Keyword Hotel Strategy Matrix — SEO Studio Suite",
  ecommerce: "78-Keyword Ecommerce Strategy Matrix — SEO Studio Suite",
  "local-business": "78-Keyword Local Business Strategy Matrix — SEO Studio",
  saas: "78-Keyword SaaS Strategy Matrix — SEO Studio Suite",
  publisher: "78-Keyword Publisher Strategy Matrix — SEO Studio Suite",
  finance: "78-Keyword Finance Strategy Matrix — SEO Studio Suite",
};

const MATRIX_DESCRIPTIONS: Record<string, string> = {
  hotel: "Comprehensive 78-keyword strategy matrix for hotel SEO across Brand, Local, Airport, Meetings, Extended Stay, and Generative AI conversational queries.",
  ecommerce: "78-keyword strategy matrix for ecommerce SEO across Brand & Collections, Product & Category, Shipping & Returns, Reviews and Generative AI prompts.",
  "local-business": "78-keyword strategy matrix for local business SEO across Core Services, Hours & Contact, Emergency & Urgency, Reputation & Reviews and AI prompts.",
  saas: "78-keyword strategy matrix for SaaS SEO across Brand & Alternatives, Pricing & Plans, Features & Use Cases, Integrations and Generative AI prompts.",
  publisher: "78-keyword strategy matrix for publisher SEO across News & Topical, Evergreen & Guides, Authors & E-E-A-T, Subscribe & Newsletter and AI prompts.",
  finance: "A 78-keyword strategy matrix for finance SEO across Products & Rates, Calculators & Tools, Advice & Explainers, Comparisons & Fees and AI prompts.",
};

/**
 * `?pack=` resolves through `resolveMatrixPackId` (src/packs/matrices.ts).
 */
export function generateMetadata({ searchParams }: PageProps): Metadata {
  const packId = resolveMatrixPackId(searchParams?.pack);
  return {
    title: MATRIX_TITLES[packId],
    description: MATRIX_DESCRIPTIONS[packId],
  };
}

export default function StrategyMatrixPage({ searchParams }: PageProps) {
  const packId = resolveMatrixPackId(searchParams?.pack);
  const meta = getPackMeta(packId) as PackMeta;
  const matrix = getPackMatrix(packId);
  const view = searchParams?.view === "clusters" ? "clusters" : "funnel";
  const viewHref = (target: "funnel" | "clusters") =>
    `/strategy-matrix?pack=${packId}${target === "clusters" ? "&view=clusters" : ""}`;

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
              <p className="text-tiny text-slate-500 dark:text-slate-400">78-Keyword Strategy Matrix</p>
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
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-white shadow-xs dark:bg-brand dark:text-slate-950"
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

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <nav aria-label="Breadcrumb Navigation" className="mb-6 flex items-center gap-2 text-caption text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {meta.name} Strategy Matrix
          </span>
        </nav>

        {/* Vertical pack switcher (Task 4.2) */}
        <nav
          aria-label="Select vertical pack"
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          {PACK_CATALOG.map((pack) => {
            const isActive = pack.id === packId;
            return (
              <Link
                key={pack.id}
                href={`/strategy-matrix?pack=${pack.id}${view === "clusters" ? "&view=clusters" : ""}`}
                aria-current={isActive ? "page" : undefined}
                title={pack.description}
                className={`rounded-lg border px-3 py-1.5 text-caption font-semibold transition ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                {pack.name}
              </Link>
            );
          })}
        </nav>

        {/* View toggle: funnel categories vs target-page clusters (Task 4.3) */}
        <div className="mb-6 flex items-center gap-2 text-caption">
          <span className="text-slate-500 dark:text-slate-400">View:</span>
          <Link
            href={viewHref("funnel")}
            aria-current={view === "funnel" ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${
              view === "funnel"
                ? "bg-slate-900 text-white dark:bg-brand dark:text-slate-950"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Funnel categories
          </Link>
          <Link
            href={viewHref("clusters")}
            aria-current={view === "clusters" ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${
              view === "clusters"
                ? "bg-slate-900 text-white dark:bg-brand dark:text-slate-950"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Target-page clusters
          </Link>
        </div>

        <StrategyMatrixContent matrix={matrix} pack={meta} view={view} />
      </main>
    </div>
  );
}
