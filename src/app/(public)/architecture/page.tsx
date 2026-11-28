import type { Metadata } from "next";
import Link from "next/link";
import { ArchitectureContent } from "@/components/ArchitectureContent";
import { Badge } from "@/components/ui/index";

export const metadata: Metadata = {
  title: "System Architecture & Technical Specs — SEO Studio Suite",
  description:
    "Complete technical architecture for Manifest V3 extension, AI training data vault, hybrid model inference routing, and Python fine-tuning pipelines.",
};

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb Navigation" className="flex items-center gap-2 text-caption text-text-muted">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-text">System Architecture</span>
      </nav>

      <header className="space-y-2">
        <Badge variant="notice">Manifest V3 · React 18 · Python 3.11+</Badge>
        <h1 className="text-display text-text">System Architecture &amp; Technical Specifications</h1>
        <p className="max-w-[72ch] text-body text-text-muted">
          Engineering specifications detailing client-side inspection boundaries, physical pixel calculation tables, AI training data collection, hybrid inference routing, and Python fine-tuning pipelines.
        </p>
      </header>

      <ArchitectureContent showHeader={false} />
    </div>
  );
}
