import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TEMPLATES_DATA,
  getTemplateBySlug,
  getRelatedTemplates,
} from "@/packs/hotel/templates";
import { TemplateCustomizerView } from "@/components/TemplateCustomizerView";

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
      description: "The requested SEO and GEO template could not be located in the SEO Studio templates repository catalog.",
    };
  }

  const canonicalUrl = `https://seo-studio-one.vercel.app/templates/${template.categorySlug}/${template.slug}`;

  return {
    title: template.metaTitle,
    description: template.metaDescription,
    robots: { index: false, follow: true },
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

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://seo-studio-one.vercel.app" },
      { "@type": "ListItem", position: 2, name: "Templates", item: "https://seo-studio-one.vercel.app/templates" },
      {
        "@type": "ListItem",
        position: 3,
        name: template.category,
        item: `https://seo-studio-one.vercel.app/templates#${template.categorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: template.title,
        item: `https://seo-studio-one.vercel.app/templates/${template.categorySlug}/${template.slug}`,
      },
    ],
  };

  const primarySchema = {
    "@context": "https://schema.org",
    "@type": template.schemaType === "FAQPage" ? "FAQPage" : "TechArticle",
    headline: template.title,
    description: template.metaDescription,
    author: { "@type": "Organization", name: "SEO & GEO Studio", url: "https://seo-studio-one.vercel.app" },
    publisher: { "@type": "Organization", name: "Nurunnobe Jisan", url: "https://github.com/nurunnobejisan" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://seo-studio-one.vercel.app/templates/${template.categorySlug}/${template.slug}`,
    },
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(primarySchema) }} />

      <nav aria-label="Breadcrumb Navigation" className="flex flex-wrap items-center gap-2 text-caption text-text-muted">
        <Link href="/" className="hover:underline">Home</Link>
        <span>/</span>
        <Link href="/templates" className="hover:underline">Templates</Link>
        <span>/</span>
        <span>{template.category}</span>
        <span>/</span>
        <span className="font-medium text-text">{template.title}</span>
      </nav>

      <article className="space-y-6">
        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-notice-soft px-2.5 py-0.5 text-caption font-medium text-notice-fg">
              {template.category}
            </span>
            <span
              className={`rounded-sm px-2.5 py-0.5 text-caption font-medium ${
                template.difficulty === "Beginner"
                  ? "bg-success-soft text-success-fg"
                  : template.difficulty === "Intermediate"
                  ? "bg-warning-soft text-warning-fg"
                  : "bg-notice-soft text-notice-fg"
              }`}
            >
              {template.difficulty}
            </span>
            <span className="rounded-sm bg-surface-2 px-2.5 py-0.5 text-caption text-text-muted">
              Est. {template.estimatedTime}
            </span>
            <span className="rounded-sm bg-surface-2 px-2.5 py-0.5 font-mono text-caption text-text-muted">
              Schema: {template.schemaType}
            </span>
          </div>

          <h1 className="text-display text-text">{template.title}</h1>
        </header>

        <aside
          aria-label="Direct Answer & Key Takeaways for Generative Search"
          className="rounded border border-brand/30 bg-brand-soft p-4 sm:p-5"
        >
          <div className="mb-1.5 text-overline uppercase text-text">
            Direct Answer &amp; Key Takeaway
          </div>
          <p className="max-w-[72ch] text-body font-medium text-text">{template.directAnswer}</p>
        </aside>

        <TemplateCustomizerView template={template} relatedTemplates={relatedTemplates} />
      </article>
    </div>
  );
}
