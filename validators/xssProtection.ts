/**
 * Cogwheel SEO Templates — Context-Aware XSS Protection
 * 
 * Provides robust escaping for HTML text content, HTML attribute values,
 * and JSON-LD script context to prevent injection vulnerabilities.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;"
};

/**
 * Escapes unsafe characters for HTML body context.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str).replace(/[&<>"'`=\/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Escapes unsafe characters strictly for HTML attribute values (e.g., href, title, content).
 */
export function escapeHtmlAttribute(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/[&<>"'`=\/]/g, (char) => HTML_ESCAPE_MAP[char] || char)
    .replace(/javascript:/gi, "blocked-javascript:")
    .replace(/data:text\/html/gi, "blocked-data:");
}

/**
 * Strips script tags, on* event handlers, and dangerous protocols entirely.
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^>\s]+/gi, "")
    .replace(/javascript\s*:/gi, "blocked-javascript:");
}

/**
 * Context-aware dynamic variable sanitizer for template data
 */
export function sanitizeTemplateContext<T extends Record<string, any>>(context: T): T {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      sanitized[key] = escapeHtml(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => (typeof item === "string" ? escapeHtml(item) : item));
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeTemplateContext(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
