/**
 * Comprehensive Site Audit Issue Definitions
 * Adapted from open-seo (every-app/open-seo) under MIT License
 */

export type IssueSeverity = "critical" | "warning" | "info";

export interface AuditIssueDescriptor {
  severity: IssueSeverity;
  category: "crawlability" | "indexability" | "onpage" | "links" | "performance" | "schema" | "security";
  title: string;
  explanation: string;
  howToFix: string;
}

export const AUDIT_ISSUE_TYPES: Record<string, AuditIssueDescriptor> = {
  "blocked-page": {
    severity: "critical",
    category: "crawlability",
    title: "Crawler was blocked",
    explanation:
      "The site returned a bot challenge or access denial (e.g. 403 Forbidden or WAF challenge) instead of content. Search engines may face similar crawl friction.",
    howToFix:
      "Allowlist trusted search engine crawlers and ensure your firewall rules do not inadvertently block Googlebot or client audit agents.",
  },
  "broken-link": {
    severity: "critical",
    category: "links",
    title: "Broken link (404/5xx)",
    explanation:
      "The URL returned an HTTP error (such as 404 Not Found or 500 Internal Server Error). Broken links hurt user trust and squander crawl budget.",
    howToFix:
      "Update internal links pointing to this destination or configure a 301 permanent redirect to the most relevant equivalent page.",
  },
  "redirect-chain": {
    severity: "warning",
    category: "links",
    title: "Redirect chain or loop detected",
    explanation:
      "The link passes through two or more redirect hops before reaching its destination, increasing page load latency and diluting PageRank.",
    howToFix:
      "Update internal links and canonical declarations to point directly to the final destination URL.",
  },
  "missing-canonical": {
    severity: "warning",
    category: "indexability",
    title: "Missing canonical tag",
    explanation:
      "The page lacks a <link rel=\"canonical\"> tag, increasing the risk of search engines indexing duplicate parameter URLs or alternate versions.",
    howToFix:
      "Add a self-referential or master canonical tag <link rel=\"canonical\" href=\"...\"> in the <head> of the document.",
  },
  "canonical-mismatch": {
    severity: "warning",
    category: "indexability",
    title: "Canonical points to another URL",
    explanation:
      "The canonical URL differs from the requested address. This instructs Google not to index this page and instead index the target.",
    howToFix:
      "Verify whether this is intentional consolidation. If this page should rank on its own, update the canonical to be self-referential.",
  },
  "noindex-tag": {
    severity: "warning",
    category: "indexability",
    title: "Page contains noindex directive",
    explanation:
      "The page contains <meta name=\"robots\" content=\"noindex\"> or an X-Robots-Tag: noindex header, preventing search engines from listing it.",
    howToFix:
      "Remove the noindex tag if the page is intended to receive organic search traffic.",
  },
  "missing-h1": {
    severity: "critical",
    category: "onpage",
    title: "Missing primary <h1> heading",
    explanation:
      "The page does not declare an <h1> tag, depriving search engines and assistive technology of a clear primary topical anchor.",
    howToFix:
      "Add a single, descriptive <h1> element reflecting the primary focus and keyword theme of the page.",
  },
  "multiple-h1": {
    severity: "warning",
    category: "onpage",
    title: "Multiple <h1> headings declared",
    explanation:
      "Declaring multiple <h1> tags dilutes the primary subject matter and confuses semantic hierarchy.",
    howToFix:
      "Consolidate to a single primary <h1> at the top of the content and convert secondary headlines to <h2>.",
  },
  "missing-meta-description": {
    severity: "warning",
    category: "onpage",
    title: "Missing meta description",
    explanation:
      "The page lacks a <meta name=\"description\"> tag, forcing search engines to generate automated snippet previews.",
    howToFix:
      "Write a compelling, benefit-focused meta description between 130 and 155 characters that includes the target keyword.",
  },
  "duplicate-title": {
    severity: "warning",
    category: "onpage",
    title: "Duplicate title tag across pages",
    explanation:
      "Multiple pages share the exact same <title> tag, leading to keyword cannibalization and diluted click-through rates.",
    howToFix:
      "Ensure every public URL has a distinct, descriptive title tag incorporating unique page qualifiers and location signals.",
  },
  "missing-structured-data": {
    severity: "info",
    category: "schema",
    title: "No Schema.org structured data detected",
    explanation:
      "The page does not provide JSON-LD schema markup, missing out on rich results (such as star ratings, breadcrumbs, and FAQs).",
    howToFix:
      "Implement relevant Schema.org types (e.g. Hotel, LocalBusiness, FAQPage, BreadcrumbList) in a JSON-LD script tag.",
  },
  "javascript-rendering-suspected": {
    severity: "warning",
    category: "crawlability",
    title: "Content requires JavaScript rendering",
    explanation:
      "The raw HTML payload contains minimal readable text and empty app containers. Search engine indexing may be delayed or incomplete without server-side rendering.",
    howToFix:
      "Implement Server-Side Rendering (SSR), Incremental Static Regeneration (ISR), or pre-rendering for crucial content and navigation links.",
  },
};
