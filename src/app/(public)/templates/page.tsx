import type { Metadata } from "next";
import Link from "next/link";
import { TemplatesHubClient } from "@/components/TemplatesHubClient";

export const metadata: Metadata = {
  title: "SEO & GEO Template Catalog — Hotel Pack #1 — SEO Studio",
  description:
    "Catalog of 12 SEO & GEO templates from the Hotel & Hospitality pack, Pack #1 of six verticals, with placeholders resolved by the template engine.",
};

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb Navigation" className="flex items-center gap-2 text-caption text-text-muted">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-text">Templates Catalog</span>
      </nav>

      <header className="space-y-1.5">
        <span className="inline-block rounded-sm bg-success-soft px-2 py-0.5 text-caption font-medium text-success-fg">
          SEO &amp; GEO Blueprints
        </span>
        <h1 className="text-display text-text">Hospitality SEO &amp; GEO Templates Hub</h1>
        <p className="max-w-[72ch] text-body text-text-muted">
          12 complete, production-ready SEO templates across 6 core categories. Filter by category, test queries in real time, customize variables, and preview SERP snippet pixels.
        </p>
      </header>

      <TemplatesHubClient />
    </div>
  );
}
