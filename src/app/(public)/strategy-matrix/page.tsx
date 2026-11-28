import type { Metadata } from "next";
import Link from "next/link";
import { PACK_CATALOG, getPackMeta, type PackMeta } from "@/packs/catalog";
import { getPackMatrix, resolveMatrixPackId } from "@/packs/matrices";
import { StrategyMatrixContent } from "@/components/StrategyMatrixContent";

interface PageProps {
  searchParams?: { pack?: string; view?: string };
}

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
    <div className="space-y-6">
      <nav aria-label="Breadcrumb Navigation" className="flex items-center gap-2 text-caption text-text-muted">
        <Link href="/" className="hover:underline">Home</Link>
        <span>/</span>
        <span className="font-medium text-text">{meta.name} Strategy Matrix</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-display text-text">{meta.name} 78-Keyword Strategy Matrix</h1>
        <p className="max-w-[72ch] text-body text-text-muted">{meta.description}</p>
      </header>

      <nav aria-label="Select vertical pack" className="flex flex-wrap items-center gap-2">
        {PACK_CATALOG.map((pack) => {
          const isActive = pack.id === packId;
          return (
            <Link
              key={pack.id}
              href={`/strategy-matrix?pack=${pack.id}${view === "clusters" ? "&view=clusters" : ""}`}
              aria-current={isActive ? "page" : undefined}
              title={pack.description}
              className={`rounded-sm border px-3 py-1.5 text-caption font-medium transition-colors ${
                isActive
                  ? "border-brand bg-brand-soft text-text"
                  : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
              }`}
            >
              {pack.name}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 text-caption">
        <span className="text-text-muted">View:</span>
        <Link
          href={viewHref("funnel")}
          aria-current={view === "funnel" ? "page" : undefined}
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            view === "funnel" ? "bg-sidebar text-sidebar-text" : "text-text-muted hover:text-text"
          }`}
        >
          Funnel categories
        </Link>
        <Link
          href={viewHref("clusters")}
          aria-current={view === "clusters" ? "page" : undefined}
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            view === "clusters" ? "bg-sidebar text-sidebar-text" : "text-text-muted hover:text-text"
          }`}
        >
          Target-page clusters
        </Link>
      </div>

      <StrategyMatrixContent matrix={matrix} pack={meta} view={view} />
    </div>
  );
}
