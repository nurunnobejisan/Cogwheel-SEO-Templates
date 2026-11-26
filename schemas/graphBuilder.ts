/**
 * SEO Studio Templates — Composable JSON-LD @graph Builder
 * 
 * Aggregates individual entity schemas into a single unified JSON-LD @graph
 * under the standard https://schema.org @context.
 */

export interface GraphBuilderOptions {
  minify?: boolean;
}

export class JsonLdGraphBuilder {
  private items: Record<string, any>[] = [];

  /**
   * Adds an entity schema to the graph.
   */
  public add(schema: Record<string, any> | Record<string, any>[] | null | undefined): this {
    if (!schema) return this;
    if (Array.isArray(schema)) {
      schema.forEach((s) => this.add(s));
    } else {
      // Remove local @context if present so graph context is authoritative
      const { "@context": _, ...cleanSchema } = schema;
      this.items.push(cleanSchema);
    }
    return this;
  }

  /**
   * Returns graph as a native JavaScript object structure.
   */
  public toObject(): { "@context": string; "@graph": Record<string, any>[] } {
    return {
      "@context": "https://schema.org",
      "@graph": this.items
    };
  }

  /**
   * Safely serializes the graph into a JSON string with safe quote and newline handling.
   */
  public serialize(options: GraphBuilderOptions = { minify: false }): string {
    const obj = this.toObject();
    const jsonString = options.minify
      ? JSON.stringify(obj)
      : JSON.stringify(obj, null, 2);

    // Safeguard against HTML script breakout like </script>
    return jsonString.replace(/<\/script>/gi, "<\\/script>");
  }

  /**
   * Wraps the serialized graph in a standard HTML <script type="application/ld+json"> tag.
   */
  public toHtmlScript(options: GraphBuilderOptions = { minify: false }): string {
    return `<script type="application/ld+json">\n${this.serialize(options)}\n</script>`;
  }
}

/**
 * Convenience helper to build graph in one functional call.
 */
export function buildSchemaGraph(
  schemas: (Record<string, any> | null | undefined)[],
  options?: GraphBuilderOptions
): string {
  const builder = new JsonLdGraphBuilder();
  schemas.forEach((s) => builder.add(s));
  return builder.toHtmlScript(options);
}
