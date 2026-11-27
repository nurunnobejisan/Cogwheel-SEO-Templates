/**
 * Single template renderer for the Next.js app and the Chrome extension
 * (Phase E — "one template renderer").
 *
 * Before Phase E three substitution implementations existed:
 *   - `src/core/templates/template-engine.ts` — zero consumers, deleted;
 *   - `chrome-extension/src/core/templates/template-engine.ts` — now a thin
 *     re-export of this module (function identity asserted in tests);
 *   - the inline `[Brand Name]`-style chain in `TemplateCustomizerView` —
 *     now `renderBracketTokens` + `validators/variableResolver`.
 *
 * Every placeholder substitution in the product goes through this file:
 *   - `{{var}}` / `{{var | fallback: "x"}}` mustache tokens
 *     (`parseTemplateWithFallbacks`, `renderTemplateString`, `renderTemplate`)
 *   - exact `{{var}}` / `{var}` / `${var}` keys
 *     (`substituteExactPlaceholders` — used by `validators/variableResolver`)
 *   - `[Brand Name]` bracket tokens (`renderBracketTokens`)
 *
 * Deliberately dependency-free (no `validators/` imports) so both trees can
 * bundle it; validation and XSS layers live app-side in `validators/`.
 */

export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

export interface ParsedTemplateResult {
  rendered: string;
  usedFallbacks: string[];
  missingWithoutFallback: string[];
}

const PLACEHOLDER_REGEX =
  /\{\{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*fallback\s*:\s*(?:"([^"]*)"|'([^']*)'))?\s*\}\}/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves one variable key against a flat (optionally nested) variable map.
 * Empty/whitespace-only values count as missing so fallbacks apply instead of
 * leaking blank strings. Arrays join with ", " (ported from the app copy);
 * dotted keys ("brand.name") traverse nested plain objects (extension contract
 * preserved: flat keys are checked first, exactly as before).
 */
export function resolveVariableValue(
  variables: TemplateVariables,
  key: string
): string | undefined {
  if (Object.prototype.hasOwnProperty.call(variables, key)) {
    const raw = variables[key];
    if (raw === null || raw === undefined) return undefined;
    if (Array.isArray(raw)) {
      const joined = raw.filter(Boolean).map(String).join(", ");
      return joined.length > 0 ? joined : undefined;
    }
    const str = String(raw).trim();
    return str.length > 0 ? str : undefined;
  }

  if (key.includes(".")) {
    let cursor: unknown = variables;
    for (const part of key.split(".")) {
      if (cursor !== null && typeof cursor === "object" && part in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    if (cursor === null || cursor === undefined || typeof cursor === "object") return undefined;
    const str = String(cursor).trim();
    return str.length > 0 ? str : undefined;
  }

  return undefined;
}

/**
 * Renders `{{var}}` and `{{var | fallback: "default"}}` tokens, reporting
 * which fallbacks were used and which tokens had neither a value nor a
 * fallback (those render as `globalDefaultFallback`, never as "undefined").
 */
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

/** String-only convenience over `parseTemplateWithFallbacks`. */
export function renderTemplateString(
  template: string,
  variables: TemplateVariables,
  globalDefaultFallback = ""
): string {
  return parseTemplateWithFallbacks(template, variables, globalDefaultFallback).rendered;
}

/**
 * App-side signature kept for callers of the deleted
 * `src/core/templates/template-engine.ts`: renders mustache tokens, missing
 * values become "" (never "undefined"/"null").
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return renderTemplateString(template, variables as TemplateVariables, "");
}

/**
 * Replaces `[Brand Name]`-style bracket tokens (the template catalog's
 * syntax) with the provided values. Tokens absent from `tokens` are left
 * untouched so unfinished fields stay visible; callers pass
 * `value || "[Token]"` to keep a token in place while its variable is empty.
 */
export function renderBracketTokens(template: string, tokens: Record<string, string>): string {
  let rendered = template;
  for (const [token, value] of Object.entries(tokens)) {
    if (token) {
      rendered = rendered.split(token).join(value);
    }
  }
  return rendered;
}

/**
 * Exact-key substitution for `{{key}}`, `{key}` and `${key}` — the syntax
 * `validators/variableResolver.resolveTemplate` validates around. Ported here
 * in Phase E so no second substitution implementation lives outside this
 * module; semantics are identical to the original loop (missing values render
 * as "").
 */
export function substituteExactPlaceholders(
  text: string,
  context: Record<string, unknown>
): string {
  let rendered = text;
  for (const [key, val] of Object.entries(context)) {
    const stringVal = String(val ?? "");
    // Order matters: `${key}` must be replaced before `{key}`, otherwise the
    // single-curly pass matches inside it and leaves a stray "$" behind
    // (the original loop had this bug — `${var}` never resolved unspaced).
    rendered = rendered.replace(
      new RegExp(`\\$\\{\\s*${escapeRegExp(key)}\\s*\\}`, "g"),
      () => stringVal
    );
    rendered = rendered.replace(
      new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g"),
      () => stringVal
    );
    rendered = rendered.replace(new RegExp(`\\{${escapeRegExp(key)}\\}`, "g"), () => stringVal);
  }
  return rendered;
}
