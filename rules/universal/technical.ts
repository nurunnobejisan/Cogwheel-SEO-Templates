/**
 * Universal Rule Engine — Pillar 4: Technical & Schema
 *
 * Indexability, canonical integrity, link health, social meta and structured
 * data presence for any web property.
 */

import type { AuditIssue, AuditRule } from "../types.ts";
import { makeIssue } from "../issues.ts";

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path}${url.search}`;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

export const canonicalPresenceRule: AuditRule = {
  id: "universal/technical/canonical-presence",
  pillar: "technical",
  description: "Every indexable page should declare a canonical URL.",
  evaluate({ snapshot }) {
    if (snapshot.canonical && snapshot.canonical.trim().length > 0) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_canonical_missing",
        category: "technical",
        severity: "medium",
        cmsTargetField: "canonical_url",
        currentValue: "",
        selector: "head > link[rel='canonical']",
        recommendedAction: "Add a self-referential <link rel=\"canonical\"> to the page head.",
      }),
    ];
  },
};

export const canonicalMatchRule: AuditRule = {
  id: "universal/technical/canonical-match",
  pillar: "technical",
  description: "The canonical must not silently point to an unrelated URL.",
  evaluate({ snapshot }) {
    if (!snapshot.canonical || !snapshot.canonical.trim()) {
      return [];
    }
    if (normalizeUrl(snapshot.canonical) === normalizeUrl(snapshot.url)) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_canonical_mismatch",
        category: "technical",
        severity: "high",
        cmsTargetField: "canonical_url",
        currentValue: snapshot.canonical,
        selector: "head > link[rel='canonical']",
        recommendedAction:
          "Confirm the consolidation is intentional; otherwise make the canonical self-referential.",
      }),
    ];
  },
};

export const noindexRule: AuditRule = {
  id: "universal/technical/noindex-directive",
  pillar: "technical",
  description: "Flag pages excluded from the index via robots directives.",
  evaluate({ snapshot }) {
    const directives = (snapshot.metaRobots ?? "").toLowerCase();
    if (!directives.includes("noindex")) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_noindex",
        category: "technical",
        severity: "high",
        cmsTargetField: "meta_robots",
        currentValue: snapshot.metaRobots,
        selector: "head > meta[name='robots']",
        recommendedAction:
          "Remove the noindex directive if this page is intended to rank organically.",
      }),
    ];
  },
};

export const brokenLinkRule: AuditRule = {
  id: "universal/technical/broken-links",
  pillar: "technical",
  description: "Flag internal links returning 4xx/5xx status codes.",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const link of snapshot.links) {
      if (link.external || link.statusCode === null || link.statusCode === undefined) {
        continue;
      }
      if (link.statusCode < 400) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_broken_internal_link",
          category: "technical",
          severity: "critical",
          cmsTargetField: "internal_link_url",
          currentValue: `${link.href} → ${link.statusCode}`,
          selector: `a[href="${link.href}"]`,
          recommendedAction:
            "Repair the link target or add a 301 redirect to the closest live equivalent.",
        })
      );
    }
    return issues;
  },
};

export const redirectChainRule: AuditRule = {
  id: "universal/technical/redirect-chain",
  pillar: "technical",
  description: "Flag links that pass through two or more redirect hops.",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const link of snapshot.links) {
      const hops = link.redirectChain ?? [];
      if (hops.length < 2) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_redirect_chain",
          category: "technical",
          severity: "medium",
          cmsTargetField: "internal_link_url",
          currentValue: `${hops.length} hops`,
          selector: `a[href="${link.href}"]`,
          recommendedAction: "Point the link directly at the final destination URL.",
        })
      );
    }
    return issues;
  },
};

export const externalLinkRelRule: AuditRule = {
  id: "universal/technical/external-link-rel",
  pillar: "technical",
  description: "External links opening a new tab need rel=noopener/noreferrer.",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const link of snapshot.links) {
      if (!link.external) {
        continue;
      }
      const rel = (link.rel ?? "").toLowerCase();
      if (rel.includes("noopener") || rel.includes("noreferrer")) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_external_link_rel",
          category: "technical",
          severity: "low",
          cmsTargetField: "link_rel",
          currentValue: link.rel ?? "",
          selector: `a[href="${link.href}"]`,
          recommendedAction: "Add rel=\"noopener noreferrer\" to the external link.",
        })
      );
    }
    return issues;
  },
};

export const viewportRule: AuditRule = {
  id: "universal/technical/viewport",
  pillar: "technical",
  description: "A responsive viewport meta tag is required for mobile-first indexing.",
  evaluate({ snapshot }) {
    if (snapshot.hasViewport) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_viewport_missing",
        category: "technical",
        severity: "medium",
        cmsTargetField: "viewport_meta",
        currentValue: null,
        selector: "head > meta[name='viewport']",
        recommendedAction:
          "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
      }),
    ];
  },
};

export const openGraphRule: AuditRule = {
  id: "universal/technical/open-graph",
  pillar: "technical",
  description: "Open Graph title, description and image completeness.",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    if (!snapshot.openGraph.title) {
      issues.push(
        makeIssue({
          issueId: "iss_og_title_missing",
          category: "technical",
          severity: "low",
          cmsTargetField: "og_title",
          currentValue: null,
          selector: "head > meta[property='og:title']",
          recommendedAction: "Add an og:title matching the page's primary topic.",
        })
      );
    }
    if (!snapshot.openGraph.description) {
      issues.push(
        makeIssue({
          issueId: "iss_og_description_missing",
          category: "technical",
          severity: "low",
          cmsTargetField: "og_description",
          currentValue: null,
          selector: "head > meta[property='og:description']",
          recommendedAction: "Add an og:description summarising the page.",
        })
      );
    }
    if (!snapshot.openGraph.image) {
      issues.push(
        makeIssue({
          issueId: "iss_og_image_missing",
          category: "technical",
          severity: "medium",
          cmsTargetField: "og_image",
          currentValue: null,
          selector: "head > meta[property='og:image']",
          recommendedAction: "Add a 1200x630 og:image for social sharing previews.",
        })
      );
    }
    return issues;
  },
};

export const twitterCardRule: AuditRule = {
  id: "universal/technical/twitter-card",
  pillar: "technical",
  description: "Twitter/X card metadata completeness.",
  evaluate({ snapshot }) {
    if (snapshot.twitter.card) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_twitter_card_missing",
        category: "technical",
        severity: "info",
        cmsTargetField: "twitter_card",
        currentValue: null,
        selector: "head > meta[name='twitter:card']",
        recommendedAction: "Add a twitter:card (summary_large_image) with image and title.",
      }),
    ];
  },
};

export const structuredDataRule: AuditRule = {
  id: "universal/technical/structured-data",
  pillar: "schema",
  description: "Warn when no JSON-LD structured data is present.",
  evaluate({ snapshot }) {
    if (snapshot.jsonLd.length > 0) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_structured_data_missing",
        category: "schema",
        severity: "info",
        cmsTargetField: "json_ld_schema",
        currentValue: null,
        selector: "script[type='application/ld+json']",
        recommendedAction:
          "Add relevant JSON-LD (Article, Product, LocalBusiness, FAQPage, Organization).",
      }),
    ];
  },
};

export const TECHNICAL_RULES: AuditRule[] = [
  canonicalPresenceRule,
  canonicalMatchRule,
  noindexRule,
  brokenLinkRule,
  redirectChainRule,
  externalLinkRelRule,
  viewportRule,
  openGraphRule,
  twitterCardRule,
  structuredDataRule,
];
