import type { TaskRunFlag } from "@/core/runs";
import type {
  SitemapNavigationOptimizationDraft,
  SitemapNavigationOptimizationInput,
} from "./schema";

export interface SitemapNavigationOptimizationOutput {
  property: SitemapNavigationOptimizationInput["property"];
  xmlSitemapHealth: SitemapNavigationOptimizationDraft["xmlSitemapHealth"];
  clickDepthAnalysis: SitemapNavigationOptimizationDraft["clickDepthAnalysis"];
  navigationGaps: string[];
  xmlSitemapString: string;
  entriesCount: number;
  generatedAt: string;
}

export function buildSitemapXmlString(
  entries: SitemapNavigationOptimizationDraft["generatedXmlSitemapEntries"],
): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of entries) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return lines.join("\n");
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export function renderSitemapNavigationOptimizationOutput(opts: {
  input: SitemapNavigationOptimizationInput;
  draft: SitemapNavigationOptimizationDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: SitemapNavigationOptimizationOutput } {
  const xmlString = buildSitemapXmlString(opts.draft.generatedXmlSitemapEntries ?? []);

  const output: SitemapNavigationOptimizationOutput = {
    property: opts.input.property,
    xmlSitemapHealth: opts.draft.xmlSitemapHealth,
    clickDepthAnalysis: opts.draft.clickDepthAnalysis ?? [],
    navigationGaps: opts.draft.navigationGaps ?? [],
    xmlSitemapString: xmlString,
    entriesCount: opts.draft.generatedXmlSitemapEntries?.length ?? 0,
    generatedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
