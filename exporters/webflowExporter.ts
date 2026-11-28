/**
 * SEO Studio Templates — Webflow CMS Exporter
 * 
 * Generates Webflow CMS Collection-compliant CSV structures
 * with clean rich-text HTML escaping and standard Webflow SEO fields.
 */

export interface WebflowCmsItem {
  name: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  postBodyHtml: string;
  heroImage?: string;
  category?: string;
  archived?: boolean;
  draft?: boolean;
}

/**
 * Escapes a single CSV cell value according to RFC 4180 rules.
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If string contains comma, quote, or newline, escape internal quotes by doubling them
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Converts a list of Webflow CMS items into an RFC-compliant CSV string.
 */
export function exportToWebflowCsv(items: WebflowCmsItem[]): string {
  const headers = [
    "Name",
    "Slug",
    "Meta Title",
    "Meta Description",
    "Post Body",
    "Hero Image",
    "Category",
    "Archived",
    "Draft"
  ];

  const rows = items.map((item) => [
    escapeCsvCell(item.name),
    escapeCsvCell(item.slug),
    escapeCsvCell(item.metaTitle),
    escapeCsvCell(item.metaDescription),
    escapeCsvCell(item.postBodyHtml),
    escapeCsvCell(item.heroImage || ""),
    escapeCsvCell(item.category || ""),
    escapeCsvCell(item.archived ? "true" : "false"),
    escapeCsvCell(item.draft ? "true" : "false")
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
