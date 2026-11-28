import type { Metadata } from "next";
import Link from "next/link";
import { Download, FolderArchive, Puzzle, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Chrome Extension Install Guide — SEO & GEO Studio",
  description:
    "Install the SEO & GEO Studio Manifest V3 Chrome extension for live DOM auditing, SERP pixel checking, and schema validation.",
};

const INSTALL_STEPS = [
  {
    step: "1",
    title: "Download and unzip the bundle",
    body: "Click Download Extension (.zip) below and extract seo-studio.zip into a permanent folder on your computer.",
    icon: FolderArchive,
  },
  {
    step: "2",
    title: "Open Chrome Extensions",
    body: "Navigate to chrome://extensions in Google Chrome or any Chromium browser and toggle Developer mode in the top-right corner.",
    icon: Puzzle,
  },
  {
    step: "3",
    title: "Load unpacked & inspect any page",
    body: "Click Load unpacked, select the extracted folder, pin SEO & GEO Studio to your toolbar, and run live 100-point audits on any client URL.",
    icon: ShieldCheck,
  },
];

export default function ExtensionInstallPage() {
  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb Navigation" className="flex items-center gap-2 text-caption text-text-muted">
        <Link href="/" className="hover:underline">Home</Link>
        <span>/</span>
        <span className="font-medium text-text">Chrome Extension</span>
      </nav>

      <header className="telemetry-grid rounded border border-border bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-block rounded-sm bg-brand-soft px-2.5 py-0.5 text-caption font-medium text-text">
              Manifest V3 · Live DOM Inspector
            </span>
            <h1 className="text-display text-text">SEO &amp; GEO Studio Browser Extension</h1>
            <p className="max-w-[72ch] text-body text-text-muted">
              Audit rendered DOM titles, meta descriptions against 580 px / 920 px limits, heading trees, image alt coverage, and JSON-LD directly in Chrome.
            </p>
          </div>
          <a
            href="/seo-studio.zip"
            download="seo-studio.zip"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm bg-brand px-4 text-body font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Extension (.zip)
          </a>
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-3">
        {INSTALL_STEPS.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.step} className="surface-card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-surface-2 font-mono text-caption font-semibold text-text">
                  {item.step}
                </span>
                <Icon className="h-5 w-5 text-text-muted" aria-hidden="true" />
              </div>
              <h2 className="text-heading text-text">{item.title}</h2>
              <p className="max-w-[72ch] text-caption text-text-muted">{item.body}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
