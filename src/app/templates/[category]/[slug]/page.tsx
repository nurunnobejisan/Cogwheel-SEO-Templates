import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TEMPLATES_DATA,
  getTemplateBySlug,
  getRelatedTemplates,
} from "@/data/templates";
import { TemplateCustomizerView } from "@/components/TemplateCustomizerView";
import { APP_YEAR } from "@/config/app-meta";

interface PageProps {
  params: {
    category: string;
    slug: string;
  };
}

export function generateStaticParams() {
  return TEMPLATES_DATA.map((t) => ({
    category: t.categorySlug,
    slug: t.slug,
  }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const template = getTemplateBySlug(params.category, params.slug);
  if (!template) {
    return {
      title: "Template Not Found — SEO Studio",
      description: "The requested SEO and GEO template could not be located in the SEO templates repository catalog.",
    };
  }

  const canonicalUrl = `https://seo-studio.vercel.app/templates/${template.categorySlug}/${template.slug}`;

  return {
    title: template.metaTitle,
    description: template.metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: template.metaTitle,
      description: template.metaDescription,
      url: canonicalUrl,
      siteName: "SEO & GEO Studio",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: template.metaTitle,
      description: template.metaDescription,
    },
  };
}

export default function TemplateDetailPage({ params }: PageProps) {
  const template = getTemplateBySlug(params.category, params.slug);

  if (!template) {
    notFound();
  }

  const relatedTemplates = getRelatedTemplates(template);

  // Dynamic JSON-LD structured data for BreadcrumbList + Article/HowTo schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://seo-studio.vercel.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Templates",
        item: "https://seo-studio.vercel.app/templates",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: template.category,
        item: `https://seo-studio.vercel.app/templates#${template.categorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: template.title,
        item: `https://seo-studio.vercel.app/templates/${template.categorySlug}/${template.slug}`,
      },
    ],
  };

  const primarySchema = {
    "@context": "https://schema.org",
    "@type": template.schemaType === "FAQPage" ? "FAQPage" : "TechArticle",
    headline: template.title,
    description: template.metaDescription,
    author: {
      "@type": "Organization",
      name: "SEO & GEO Studio",
      url: "https://seo-studio.vercel.app",
    },
    publisher: {
      "@type": "Organization",
      name: "SEO Studio",
      url: "https://example.com",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://seo-studio.vercel.app/templates/${template.categorySlug}/${template.slug}`,
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Dynamic JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(primarySchema) }}
      />

      {/* Top Section Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-caption font-bold text-brand-light dark:bg-brand dark:text-slate-950"
            >
              CW
            </Link>
            <div>
              <Link
                href="/templates"
                className="font-display text-base font-extrabold text-slate-900 hover:text-brand dark:text-white dark:hover:text-brand"
              >
                SEO &amp; GEO Studio
              </Link>
              <p className="text-tiny text-slate-500 dark:text-slate-400">
                Hospitality Production Template Hub
              </p>
            </div>
          </div>

          <nav
            aria-label="Header Navigation"
            className="flex items-center gap-2 text-caption font-semibold"
          >
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Studio
            </Link>
            <Link
              href="/templates"
              className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-3 text-white shadow-xs dark:bg-brand dark:text-slate-950"
            >
              Templates
            </Link>
            <Link
              href="/strategy-matrix"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Strategy Matrix
            </Link>
            <Link
              href="/architecture"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Architecture
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Landmark */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Semantic Breadcrumbs Navigation */}
        <nav
          aria-label="Breadcrumb Navigation"
          className="mb-6 flex flex-wrap items-center gap-2 text-caption text-slate-500 dark:text-slate-400"
        >
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/templates" className="hover:underline">
            Templates
          </Link>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300">
            {template.category}
          </span>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {template.title}
          </span>
        </nav>

        {/* Primary Article Container */}
        <article className="space-y-6">
          {/* Header Block */}
          <header className="space-y-3 border-b border-slate-200 pb-6 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-caption font-semibold text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                {template.category}
              </span>
              <span
                className={`rounded-md px-2.5 py-0.5 text-caption font-semibold ${
                  template.difficulty === "Beginner"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                    : template.difficulty === "Intermediate"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                    : "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300"
                }`}
              >
                {template.difficulty}
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-caption font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                ⏱ Est. {template.estimatedTime}
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-caption font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Schema: {template.schemaType}
              </span>
            </div>

            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {template.title}
            </h1>
          </header>

          {/* AI Search & Generative Engine Optimization Direct Answer Block */}
          <aside
            aria-label="Direct Answer & Key Takeaways for Generative Search"
            className="rounded-xl border border-brand/30 bg-brand/5 p-4 sm:p-5 dark:border-brand/40 dark:bg-brand/10"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-micro font-bold text-slate-950">
                AI
              </span>
              <h2 className="text-caption font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Direct Answer &amp; Key Takeaway (GEO Citation Anchor)
              </h2>
            </div>
            <p className="text-body leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
              {template.directAnswer}
            </p>
          </aside>

          {/* Interactive Customizer & SERP Preview & Export Engine */}
          <TemplateCustomizerView
            template={template}
            relatedTemplates={relatedTemplates}
          />
        </article>
      </main>

      {/* Semantic Footer Landmark */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center text-caption text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {APP_YEAR} SEO &amp; GEO Studio. Hospitality Search Engine Suite.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:underline">Studio</Link>
            <Link href="/templates" className="hover:underline">Templates</Link>
            <Link href="/strategy-matrix" className="hover:underline">Strategy Matrix</Link>
            <Link href="/architecture" className="hover:underline">Architecture</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
