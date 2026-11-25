/**
 * Dynamic Template Parser with Fallback Protection
 *
 * Supports:
 * - {{variable}}
 * - {{variable | fallback: "default value"}}
 * - {{variable | fallback: 'default value'}}
 *
 * Guarantees no "undefined" or "null" strings leak into rendered output.
 */

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*fallback\s*:\s*(?:"([^"]*)"|'([^']*)'))?\s*\}\}/g;

export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

export interface ParsedTemplateResult {
  rendered: string;
  usedFallbacks: string[];
  missingWithoutFallback: string[];
}

export function resolveVariableValue(
  variables: TemplateVariables,
  key: string
): string | undefined {
  // Support dotted paths like "brand.name" or flat keys like "brandName"
  if (Object.prototype.hasOwnProperty.call(variables, key)) {
    const raw = variables[key];
    if (raw === null || raw === undefined) return undefined;
    const str = String(raw).trim();
    return str.length > 0 ? str : undefined;
  }
  return undefined;
}

export function parseTemplateWithFallbacks(
  template: string,
  variables: TemplateVariables,
  globalDefaultFallback = ""
): ParsedTemplateResult {
  const usedFallbacks: string[] = [];
  const missingWithoutFallback: string[] = [];

  const rendered = template.replace(
    PLACEHOLDER_REGEX,
    (_match, key: string, dblFallback?: string, sglFallback?: string) => {
      const value = resolveVariableValue(variables, key);
      if (value !== undefined) {
        return value;
      }

      const explicitFallback = dblFallback ?? sglFallback;
      if (explicitFallback !== undefined) {
        usedFallbacks.push(key);
        return explicitFallback;
      }

      missingWithoutFallback.push(key);
      return globalDefaultFallback;
    }
  );

  return {
    rendered,
    usedFallbacks: Array.from(new Set(usedFallbacks)),
    missingWithoutFallback: Array.from(new Set(missingWithoutFallback)),
  };
}

export function renderTemplateString(
  template: string,
  variables: TemplateVariables,
  globalDefaultFallback = ""
): string {
  return parseTemplateWithFallbacks(template, variables, globalDefaultFallback).rendered;
}
