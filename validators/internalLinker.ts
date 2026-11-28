/**
 * SEO Studio Templates — Semantic Topic Clustering & Internal Linking Engine
 * 
 * Manages:
 * - Manifest-driven contextual internal linking
 * - Hub, Child, and Sibling page hierarchy connections
 * - Guardrails:
 *   - Never link page to itself
 *   - Maximum 1 link per target URL per page
 *   - Never inject links inside headings (<h1> - <h6>)
 *   - Never inject links inside existing <a> tags
 *   - Anchor text variation to avoid over-optimization penalties
 *   - Configurable limits per page
 * - Actionable linking audit reports
 */

export interface PageManifestItem {
  url: string;
  primaryKeyword: string;
  secondaryTags?: string[];
  parentPage?: string;
  categoryHierarchy?: string[];
  approvedAnchorVariations?: string[];
}

export interface InternalLinkerOptions {
  maxLinksPerPage?: number;
  maxLinksPerTarget?: number;
  allowExactMatch?: boolean;
}

export interface InjectedLinkRecord {
  anchorText: string;
  targetUrl: string;
  relationship: "parent" | "child" | "sibling" | "topical";
}

export interface InternalLinkingReport {
  sourceUrl: string;
  totalInjected: number;
  links: InjectedLinkRecord[];
  skippedReasons: string[];
}

/**
 * Calculates a topical relevance score between two manifest items based on category and tags.
 */
export function calculateTopicalRelevance(source: PageManifestItem, target: PageManifestItem): number {
  if (source.url === target.url) return 0;

  // Base topical score for distinct pages in the same site manifest
  let score = 5;

  // Direct Parent / Child relationship
  if (source.parentPage === target.url || target.parentPage === source.url) {
    score += 50;
  }

  // Sibling relationship (share same parent)
  if (source.parentPage && target.parentPage && source.parentPage === target.parentPage) {
    score += 30;
  }

  // Shared category hierarchy
  if (source.categoryHierarchy && target.categoryHierarchy) {
    const sharedCategories = source.categoryHierarchy.filter((cat) => target.categoryHierarchy?.includes(cat));
    score += sharedCategories.length * 15;
  }

  // Shared tags
  if (source.secondaryTags && target.secondaryTags) {
    const sharedTags = source.secondaryTags.filter((tag) => target.secondaryTags?.includes(tag));
    score += sharedTags.length * 10;
  }

  return score;
}

/**
 * Injects internal contextual links into an HTML body string while strictly adhering to SEO guardrails.
 */
export function injectInternalLinks(
  htmlContent: string,
  sourcePage: PageManifestItem,
  siteManifest: PageManifestItem[],
  options: InternalLinkerOptions = {}
): {
  html: string;
  report: InternalLinkingReport;
} {
  const maxLinks = options.maxLinksPerPage ?? parseInt(process.env.INTERNAL_LINK_MAX_PER_PAGE || "5", 10);
  const maxPerTarget = options.maxLinksPerTarget ?? parseInt(process.env.INTERNAL_LINK_MAX_PER_TARGET || "1", 10);

  const report: InternalLinkingReport = {
    sourceUrl: sourcePage.url,
    totalInjected: 0,
    links: [],
    skippedReasons: []
  };

  // Find candidate targets sorted by relevance
  const candidates = siteManifest
    .filter((target) => target.url !== sourcePage.url)
    .map((target) => ({
      target,
      score: calculateTopicalRelevance(sourcePage, target),
      relationship: (sourcePage.parentPage === target.url
        ? "parent"
        : target.parentPage === sourcePage.url
          ? "child"
          : sourcePage.parentPage && target.parentPage && sourcePage.parentPage === target.parentPage
            ? "sibling"
            : "topical") as "parent" | "child" | "sibling" | "topical"
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  let modifiedHtml = htmlContent;
  const targetCounts: Record<string, number> = {};

  for (const { target, relationship } of candidates) {
    if (report.totalInjected >= maxLinks) break;

    const currentCount = targetCounts[target.url] || 0;
    if (currentCount >= maxPerTarget) continue;

    // Build anchor phrases to search for: primary keyword + variations
    const anchors = [
      target.primaryKeyword,
      ...(target.approvedAnchorVariations || [])
    ].filter(Boolean);

    let linked = false;

    for (const anchor of anchors) {
      if (linked) break;
      if (report.totalInjected >= maxLinks) break;

      // Escape special regex chars in anchor
      const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Regex matching anchor text OUTSIDE headings and existing anchors
      // Safely apply word boundary only if first/last char is a word character
      const startsWithWord = /^\w/.test(anchor);
      const endsWithWord = /\w$/.test(anchor);
      const leftBoundary = startsWithWord ? "\\b" : "(?:^|\\s)";
      const rightBoundary = endsWithWord ? "\\b" : "(?:$|[\\s.,!?;])";
      const anchorRegex = new RegExp(`${leftBoundary}(${escapedAnchor})${rightBoundary}`, "i");

      // Check if candidate appears inside content
      if (!anchorRegex.test(modifiedHtml)) continue;

      // Safe replacement avoiding existing <a>...</a> and <h1..6>...</h1..6>
      // We split content into tokens (tags vs text)
      let injected = false;
      const parts = modifiedHtml.split(/(<[^>]+>)/g);
      let inForbiddenTag = false;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith("<")) {
          // Check if entering forbidden tag: <a>, <h1> - <h6>, <script>, <style>
          if (/^<(a|h[1-6]|script|style)\b/i.test(part)) {
            inForbiddenTag = true;
          } else if (/^<\/(a|h[1-6]|script|style)>/i.test(part)) {
            inForbiddenTag = false;
          }
        } else if (!inForbiddenTag && part.trim().length > 0) {
          // Plain text node outside forbidden tags
          if (anchorRegex.test(part)) {
            parts[i] = part.replace(
              anchorRegex,
              `<a href="${target.url}" title="$1" class="contextual-internal-link">$1</a>`
            );
            injected = true;
            linked = true;
            targetCounts[target.url] = (targetCounts[target.url] || 0) + 1;
            report.totalInjected++;
            report.links.push({
              anchorText: anchor,
              targetUrl: target.url,
              relationship
            });
            break;
          }
        }
      }

      if (injected) {
        modifiedHtml = parts.join("");
      }
    }
  }

  return {
    html: modifiedHtml,
    report
  };
}
