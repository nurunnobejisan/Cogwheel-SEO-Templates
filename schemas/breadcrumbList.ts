/**
 * Cogwheel SEO Templates — BreadcrumbList Schema Builder
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbListInput {
  items: BreadcrumbItem[];
  id?: string;
}

export function buildBreadcrumbSchema(input: BreadcrumbListInput): Record<string, any> {
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("BreadcrumbList schema requires at least one breadcrumb item.");
  }

  const schemaId = input.id || (input.items[input.items.length - 1]?.url ? `${input.items[input.items.length - 1].url}#breadcrumb` : undefined);

  return {
    "@type": "BreadcrumbList",
    ...(schemaId ? { "@id": schemaId } : {}),
    "itemListElement": input.items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name.trim(),
      "item": item.url.trim()
    }))
  };
}
