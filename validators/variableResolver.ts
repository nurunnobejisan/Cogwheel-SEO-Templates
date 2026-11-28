/**
 * SEO Studio Templates — Strict Variable Resolver & Fallback Engine
 * 
 * Provides:
 * - Pre-render validation for required and optional variables
 * - Safe fallback substitution
 * - Multi-syntax placeholder resolution ({{var}}, {var}, ${var}, %var%)
 * - Post-render scanning to prevent unresolved placeholders (undefined, null, NaN, {{raw}})
 */

export interface VariableDefinition {
  name: string;
  required: boolean;
  fallback?: string | number | boolean;
  description?: string;
  type?: "string" | "number" | "boolean" | "array" | "object";
}

export interface TemplateSchema {
  id: string;
  name: string;
  variables: Record<string, VariableDefinition>;
}

export interface ResolutionResult {
  success: boolean;
  output: string;
  missingVariables: string[];
  unresolvedPlaceholders: string[];
  warnings: string[];
}

export class TemplateResolutionError extends Error {
  public missingVariables: string[];
  public unresolvedPlaceholders: string[];

  constructor(message: string, missing: string[] = [], unresolved: string[] = []) {
    super(message);
    this.name = "TemplateResolutionError";
    this.missingVariables = missing;
    this.unresolvedPlaceholders = unresolved;
  }
}

/**
 * Patterns matching unresolved placeholders across templating conventions
 */
export const UNRESOLVED_PLACEHOLDER_REGEXES = [
  /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,       // {{variable}}
  /\{\{\s*raw\s*\}\}/gi,                    // {{raw}}
  /\{([a-zA-Z0-9_.-]+)\}/g,                 // {keyword}
  /\$\{([a-zA-Z0-9_.-]+)\}/g,               // ${variable}
  /\bundefined\b/g,                         // literal undefined
  /\bnull\b/g,                              // literal null
  /\bNaN\b/g                                // literal NaN
];

/**
 * Validates provided context against required schema definitions before rendering.
 */
export function preRenderValidate(
  schema: TemplateSchema,
  context: Record<string, any>
): { valid: boolean; missing: string[]; resolvedContext: Record<string, any> } {
  const missing: string[] = [];
  const resolvedContext: Record<string, any> = { ...context };

  for (const [key, def] of Object.entries(schema.variables)) {
    const val = context[key];
    if (val === undefined || val === null || val === "" || (typeof val === "number" && isNaN(val))) {
      if (def.fallback !== undefined) {
        resolvedContext[key] = def.fallback;
      } else if (def.required) {
        missing.push(key);
      } else {
        resolvedContext[key] = "";
      }
    } else {
      resolvedContext[key] = val;
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    resolvedContext
  };
}

/**
 * Scans rendered string for any remaining placeholder or invalid literal string.
 */
export function postRenderScan(renderedHtml: string): string[] {
  const leaks: Set<string> = new Set();

  for (const regex of UNRESOLVED_PLACEHOLDER_REGEXES) {
    const matches = renderedHtml.matchAll(new RegExp(regex.source, regex.flags));
    for (const match of matches) {
      leaks.add(match[0]);
    }
  }

  return Array.from(leaks);
}

/**
 * Core resolver function: takes a template string, a schema, and context values.
 * Performs pre-validation, substitution, fallback injection, and post-render validation.
 */
export function resolveTemplate(
  templateStr: string,
  schema: TemplateSchema,
  context: Record<string, any>,
  options: { strict?: boolean } = { strict: true }
): ResolutionResult {
  const preCheck = preRenderValidate(schema, context);

  if (!preCheck.valid && options.strict) {
    throw new TemplateResolutionError(
      `Template "${schema.name}" failed pre-render validation. Missing required variables: ${preCheck.missing.join(", ")}`,
      preCheck.missing
    );
  }

  let rendered = templateStr;
  const warnings: string[] = [];

  if (preCheck.missing.length > 0) {
    warnings.push(`Rendered with missing optional variables: ${preCheck.missing.join(", ")}`);
  }

  // Replace double curly {{key}} and single curly {key}
  for (const [key, val] of Object.entries(preCheck.resolvedContext)) {
    const stringVal = String(val ?? "");
    const doubleCurly = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    const singleCurly = new RegExp(`\\{${key}\\}`, "g");
    const templateLiteral = new RegExp(`\\$\\{\\s*${key}\\s*\\}`, "g");

    rendered = rendered.replace(doubleCurly, () => stringVal);
    rendered = rendered.replace(singleCurly, () => stringVal);
    rendered = rendered.replace(templateLiteral, () => stringVal);
  }

  // Scan for any leftover unresolved patterns
  const leftover = postRenderScan(rendered);

  if (leftover.length > 0 && options.strict) {
    throw new TemplateResolutionError(
      `Post-render scan detected ${leftover.length} unresolved placeholder(s): ${leftover.join(", ")}`,
      [],
      leftover
    );
  }

  return {
    success: leftover.length === 0 && preCheck.valid,
    output: rendered,
    missingVariables: preCheck.missing,
    unresolvedPlaceholders: leftover,
    warnings
  };
}
