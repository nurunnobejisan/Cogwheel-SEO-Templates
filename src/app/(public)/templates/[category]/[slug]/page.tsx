import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRelatedTemplates,
  getTemplateBySlug,
  TEMPLATES_DATA,
} from "@/packs/hotel/templates";
import { TemplateCustomizerView } from "@/components/TemplateCustomizerView";
import { InlineAlert } from "@/components/data/index";
import { Badge } from "@/components/ui/index";

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

  const difficultyVariant =
    template.difficulty === "Beginner"
      ? "success"
      : template.difficulty === "Intermediate"
      ? "warning"
      : "notice";

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

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_200px] xl:items-start">
        <article className="min-w-0 space-y-6">
          <header className="space-y-3 border-b border-border pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="notice">{template.category}</Badge>
              <Badge variant={difficultyVariant}>{template.difficulty}</Badge>
              <Badge variant="neutral">Est. {template.estimatedTime}</Badge>
              <Badge variant="neutral" className="font-mono">
                Schema: {template.schemaType}
              </Badge>
            </div>

            <h1 className="max-w-[72ch] text-display text-text">{template.title}</h1>
            <p className="max-w-[72ch] text-body text-text-muted">{template.metaDescription}</p>
          </header>

          <div id="direct-answer" aria-label="Direct Answer & Key Takeaways for Generative Search">
            <InlineAlert
              variant="notice"
              title="Direct answer & key takeaway"
              description={template.directAnswer}
            />
          </div>

          <TemplateCustomizerView template={template} relatedTemplates={relatedTemplates} />
        </article>

        <aside
          aria-label="On this page"
          className="print:hidden hidden xl:sticky xl:top-20 xl:block"
        >
          <div className="space-y-2 border-l border-border pl-4 text-caption">
            <div className="text-overline uppercase text-text-muted">On this page</div>
            <nav className="flex flex-col gap-1.5 text-text-muted">
              <a href="#direct-answer" className="hover:text-text">Direct answer</a>
              <a href="#export-bar" className="hover:text-text">Export &amp; checklist</a>
              <a href="#variable-customizer" className="hover:text-text">Variable inputs</a>
              <a href="#template-workbench" className="hover:text-text">Blueprint workbench</a>
              <a href="#related-templates" className="hover:text-text">Related templates</a>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
