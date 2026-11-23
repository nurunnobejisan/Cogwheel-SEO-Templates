import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hospitality SEO & GEO Templates — Cogwheel SEO Studio",
  description:
    "Production-ready on-page, lodging schema, GEO AI visibility, and GBP UNAP audit templates tailored for Marriott, Hilton, IHG, Hyatt, and luxury hotels.",
};

interface TemplateItem {
  id: string;
  filename: string;
  title: string;
  category: "On-Page & Copy" | "AI & GEO" | "Local & UNAP" | "Schema & Technical" | "Direct Bookings";
  brandScope: string;
  description: string;
  keyFeatures: string[];
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "onpage",
    filename: "brand-compliant-hotel-onpage.md",
    title: "Brand-Compliant Hotel On-Page Architecture",
    category: "On-Page & Copy",
    brandScope: "Marriott, Hilton, IHG, Hyatt, Independent",
    description:
      "Strict physical pixel-budgeted on-page copy architecture enforcing franchise prohibited terminology and mandatory brand suffixes.",
    keyFeatures: [
      "580px Google SERP Arial 20px title formula",
      "920px meta description snippet ceiling",
      "Strict single H1 headline hierarchy",
      "Prohibited superlative and discount claim scans",
    ],
  },
  {
    id: "geo",
    filename: "hotel-geo-ai-visibility.md",
    title: "Hotel GEO & Generative AI Visibility Guide",
    category: "AI & GEO",
    brandScope: "Global Portfolios & Luxury Independents",
    description:
      "Engineered to maximize AI citation frequency and knowledge graph presence across Google Gemini, ChatGPT Search, and Perplexity Pro.",
    keyFeatures: [
      "Conversational traveler intent prompt testing",
      "High-density hospitality entity anchoring",
      "Machine-readable structured Q&A entity blocks",
      "Direct citation trigger phrasing",
    ],
  },
  {
    id: "gbp",
    filename: "hotel-gbp-unap-audit.md",
    title: "Hotel GBP & Universal NAP Citation Audit",
    category: "Local & UNAP",
    brandScope: "Multi-Property Regional Clusters",
    description:
      "Cross-platform Name, Address, and Phone citation auditing across Google Business Profile, Apple Maps, Bing Places, and OTAs.",
    keyFeatures: [
      "Exact pin-drop coordinate verification",
      "30-day Google Business Profile post calendar",
      "Positive and negative guest review response matrix",
      "Local directory NAP discrepancy scoring",
    ],
  },
  {
    id: "schema",
    filename: "hotel-lodging-schema.md",
    title: "Hotel Lodging & FAQ JSON-LD Structured Data",
    category: "Schema & Technical",
    brandScope: "Universal Schema.org Compliance",
    description:
      "Copy-pasteable JSON-LD @graph package unifying Hotel, PostalAddress, GeoCoordinates, amenityFeature, and FAQPage structured entities.",
    keyFeatures: [
      "Unified Schema.org @graph entity structure",
      "Zero placeholder tokens or syntax errors",
      "Verified Google Rich Results test compliance",
      "Social sameAs entity link graph",
    ],
  },
  {
    id: "direct-booking",
    filename: "direct-booking-ota-displacement.md",
    title: "Direct Booking & OTA Displacement Playbook",
    category: "Direct Bookings",
    brandScope: "Independent & Branded Hotel Operators",
    description:
      "Commercial conversion copy strategy designed to shift price-sensitive guests from high-commission OTAs to direct brand channels.",
    keyFeatures: [
      "Pre-booking window direct incentive messaging",
      "Transparent mandatory fee and amenity schedules",
      "Loyalty points valuation comparison modules",
      "Direct booking rate guarantee CTAs",
    ],
  },
];

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Section Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-brand-light dark:bg-brand dark:text-slate-950"
            >
              CW
            </Link>
            <div>
              <h1 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                Cogwheel SEO &amp; GEO Studio
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Master Hospitality Templates Catalog</p>
            </div>
          </div>

          <nav aria-label="Header Navigation" className="flex items-center gap-2 text-xs font-semibold">
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
        <nav aria-label="Breadcrumb Navigation" className="mb-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-white">Templates Catalog</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Template Articles List */}
          <div className="space-y-6 lg:col-span-2">
            <header className="space-y-1">
              <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider dark:bg-emerald-950/60 dark:text-emerald-300">
                Production-Ready Blueprints
              </span>
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Hospitality Search &amp; GEO Templates
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Standardized, peer-reviewed Markdown frameworks engineered with YAML frontmatter, deterministic pixel formulas, and Schema.org graphs.
              </p>
            </header>

            <div className="space-y-4">
              {TEMPLATES.map((tmpl) => (
                <article
                  key={tmpl.id}
                  id={tmpl.id}
                  className="card-hover rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card transition hover:border-brand dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {tmpl.category}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {tmpl.filename}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">
                    {tmpl.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {tmpl.description}
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-950/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Brand Scope: <span className="text-slate-800 dark:text-slate-200">{tmpl.brandScope}</span>
                    </div>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {tmpl.keyFeatures.map((feat, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-2">
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-dark hover:underline dark:text-brand"
                    >
                      Audit with Template in Studio &rarr;
                    </Link>
                    <a
                      href={`https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/blob/main/templates/${tmpl.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      View Source Markdown &rarr;
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Right Column: Semantic Aside with Guardrails & Quick Jump */}
          <aside aria-label="Template Resources" className="space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Brand Guardrail Enforcement
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Templates automatically enforce franchise guidelines across five portfolio tiers:
              </p>
              <ul className="mt-3 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                  <span className="font-semibold">Marriott Bonvoy</span>
                  <span className="font-mono text-[10px] text-slate-400">60 chars / Suffix</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                  <span className="font-semibold">Hilton Honors</span>
                  <span className="font-mono text-[10px] text-slate-400">60 chars / Suffix</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                  <span className="font-semibold">IHG One Rewards</span>
                  <span className="font-mono text-[10px] text-slate-400">60 chars / Suffix</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                  <span className="font-semibold">World of Hyatt</span>
                  <span className="font-mono text-[10px] text-slate-400">60 chars / Suffix</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-semibold">Independent Luxury</span>
                  <span className="font-mono text-[10px] text-slate-400">65 chars / Suffix</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-card dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <h3 className="font-display text-sm font-bold text-emerald-900 dark:text-emerald-300">
                Chrome Extension Integration
              </h3>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-400">
                Audit any live hotel landing page against these templates in real time with our Manifest V3 Side Panel.
              </p>
              <div className="mt-4">
                <a
                  href="/cogwheel-chrome-extension.zip"
                  download="cogwheel-chrome-extension.zip"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                >
                  Download Chrome Extension
                </a>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
