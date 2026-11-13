import type { SchemaMarkupItemDraft, SchemaMarkupSummary } from "./schema";

export interface SchemaMarkupOutput {
  items: SchemaMarkupItemDraft[];
  combinedJsonLdScript: string;
  summary: SchemaMarkupSummary;
}

export function renderSchemaMarkupOutput(items: SchemaMarkupItemDraft[]): SchemaMarkupOutput {
  const missingSchemaPages = items.filter((i) => i.status === "missing").length;
  const incompleteSchemaPages = items.filter((i) => i.status === "incomplete").length;
  const validSchemaPages = items.filter((i) => i.status === "valid").length;

  const combinedJsonLdScript = items
    .map(
      (i) =>
        `<!-- ${i.pageUrl} (${i.schemaType}) -->\n<script type="application/ld+json">\n${JSON.stringify(i.jsonLd, null, 2)}\n</script>`,
    )
    .join("\n\n");

  return {
    items,
    combinedJsonLdScript,
    summary: {
      pagesAudited: items.length,
      missingSchemaPages,
      incompleteSchemaPages,
      validSchemaPages,
    },
  };
}

