/**
 * Cogwheel SEO Templates — Robots Guardrails & Metadata Deduplicator
 * 
 * Manages:
 * - Environment-aware robots meta tags (noindex for staging/dev, index for prod)
 * - Production noindex leakage detection (throws error if noindex found in production)
 * - HTML metadata deduplication (<title>, meta description, canonical)
 */

export type AppEnvironment = "development" | "staging" | "production";

export interface RobotsDirective {
  index: boolean;
  follow: boolean;
  tag: string;
}

/**
 * Returns appropriate robots directives based on environment.
 */
export function getRobotsDirectives(env?: string): RobotsDirective {
  const currentEnv = (env || process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();

  if (currentEnv === "production") {
    return {
      index: true,
      follow: true,
      tag: '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />'
    };
  }

  return {
    index: false,
    follow: false,
    tag: '<meta name="robots" content="noindex, nofollow" />'
  };
}

/**
 * Guardrail: Verifies that production HTML does not contain noindex directives.
 * Throws a ProductionNoindexError if a leak is detected.
 */
export class ProductionNoindexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionNoindexError";
  }
}

export function verifyProductionIndexable(html: string, env?: string): void {
  const currentEnv = (env || process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();

  if (currentEnv === "production") {
    const noindexMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i);
    if (noindexMatch) {
      throw new ProductionNoindexError(
        `CRITICAL SEO LEAK: Production build contains "noindex" directive: ${noindexMatch[0]}`
      );
    }
  }
}

/**
 * Deduplicates essential SEO tags in an HTML document:
 * - Keeps only the last or first valid <title>
 * - Keeps only the first meta description
 * - Keeps only the first canonical link tag
 */
export function deduplicateHeadTags(html: string): string {
  let cleaned = html;

  // Deduplicate Title: keep the first or clean multi-titles
  const titles = cleaned.match(/<title>[\s\S]*?<\/title>/gi);
  if (titles && titles.length > 1) {
    let kept = false;
    cleaned = cleaned.replace(/<title>[\s\S]*?<\/title>/gi, (match) => {
      if (!kept) {
        kept = true;
        return match;
      }
      return "";
    });
  }

  // Deduplicate Meta Description
  const descriptions = cleaned.match(/<meta[^>]+name=["']description["'][^>]*>/gi);
  if (descriptions && descriptions.length > 1) {
    let kept = false;
    cleaned = cleaned.replace(/<meta[^>]+name=["']description["'][^>]*>/gi, (match) => {
      if (!kept) {
        kept = true;
        return match;
      }
      return "";
    });
  }

  // Deduplicate Canonical Link
  const canon = cleaned.match(/<link[^>]+rel=["']canonical["'][^>]*>/gi);
  if (canon && canon.length > 1) {
    let kept = false;
    cleaned = cleaned.replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, (match) => {
      if (!kept) {
        kept = true;
        return match;
      }
      return "";
    });
  }

  return cleaned;
}
