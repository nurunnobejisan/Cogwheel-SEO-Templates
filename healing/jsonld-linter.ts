/**
 * JSON-LD Structured-Data Linter (Phase 4, step 5)
 *
 * Validates injected structured data against the required/expected properties
 * that Google's Structured Data testing applies, so a malformed schema block
 * triggers a rollback rather than shipping silently.
 */

import type { JsonLdNode } from "../rules/types.ts";
import type { JsonLdLintIssue, JsonLdLintResult } from "./types.ts";

/** Required properties per schema.org type (subset used by the engine). */
const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Article: ["headline"],
  NewsArticle: ["headline"],
  BlogPosting: ["headline"],
  Product: ["name", "offers"],
  Organization: ["name"],
  WebSite: ["name", "url"],
  LocalBusiness: ["name", "address"],
  LodgingBusiness: ["name", "address"],
  Hotel: ["name", "address"],
  Resort: ["name", "address"],
  FAQPage: ["mainEntity"],
  BreadcrumbList: ["itemListElement"],
  Event: ["name", "startDate", "location"],
};

function typesOf(node: JsonLdNode): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") {
    return [raw];
  }
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}

function lintNode(node: JsonLdNode, path: string, issues: JsonLdLintIssue[], types: string[]): void {
  const nodeTypes = typesOf(node);
  if (nodeTypes.length === 0) {
    issues.push({ path, message: "node has no @type" });
  }
  types.push(...nodeTypes);

  for (const type of nodeTypes) {
    for (const property of REQUIRED_PROPERTIES[type] ?? []) {
      const value = node[property];
      if (value === undefined || value === null || value === "") {
        issues.push({ path: `${path}.${type}`, message: `missing required property "${property}"` });
      }
    }
  }

  // Recurse into nested objects that carry their own @type.
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@")) {
      continue;
    }
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        const childNode = child as JsonLdNode;
        if (typesOf(childNode).length > 0) {
          lintNode(childNode, `${path}.${key}`, issues, types);
        }
      }
    }
  }
}

/** Lint a single JSON-LD node (and its typed descendants). */
export function lintJsonLdNode(node: JsonLdNode, path = "$"): JsonLdLintResult {
  const issues: JsonLdLintIssue[] = [];
  const types: string[] = [];
  lintNode(node, path, issues, types);
  return {
    valid: issues.length === 0,
    nodeCount: 1,
    types: [...new Set(types)],
    issues,
  };
}

/** Lint every JSON-LD node found on a page. */
export function lintJsonLdScripts(nodes: JsonLdNode[]): JsonLdLintResult {
  const issues: JsonLdLintIssue[] = [];
  const types: string[] = [];
  for (const [index, node] of nodes.entries()) {
    lintNode(node, `$[${index}]`, issues, types);
  }
  if (nodes.length === 0) {
    issues.push({ path: "$", message: "no JSON-LD structured data found" });
  }
  return {
    valid: issues.length === 0,
    nodeCount: nodes.length,
    types: [...new Set(types)],
    issues,
  };
}
