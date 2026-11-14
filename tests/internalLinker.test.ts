import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateTopicalRelevance,
  injectInternalLinks,
  type PageManifestItem
} from "../validators/internalLinker.ts";

describe("Day 7: Semantic Topic Clustering & Internal Linking", () => {
  const manifest: PageManifestItem[] = [
    {
      url: "https://example.com/denver/",
      primaryKeyword: "Denver Hotels Hub",
      categoryHierarchy: ["Colorado", "Denver"],
      approvedAnchorVariations: ["downtown Denver guide", "Denver hospitality"]
    },
    {
      url: "https://example.com/denver/suites/",
      primaryKeyword: "luxury suites",
      parentPage: "https://example.com/denver/",
      categoryHierarchy: ["Colorado", "Denver", "Suites"],
      secondaryTags: ["luxury", "rooms"],
      approvedAnchorVariations: ["executive suites", "boutique rooms"]
    },
    {
      url: "https://example.com/denver/dining/",
      primaryKeyword: "rooftop restaurant",
      parentPage: "https://example.com/denver/",
      categoryHierarchy: ["Colorado", "Denver", "Dining"],
      secondaryTags: ["dining", "cocktails"],
      approvedAnchorVariations: ["on-site dining", "craft cocktails"]
    }
  ];

  it("calculates high topical relevance for parent-child and sibling pages", () => {
    const parent = manifest[0];
    const child1 = manifest[1];
    const child2 = manifest[2];

    const parentChildScore = calculateTopicalRelevance(parent, child1);
    const siblingScore = calculateTopicalRelevance(child1, child2);

    assert(parentChildScore >= 50, `Expected parent-child score >= 50, got ${parentChildScore}`);
    assert(siblingScore >= 30, `Expected sibling score >= 30, got ${siblingScore}`);
  });

  it("never links a page to itself", () => {
    const page = manifest[1];
    const html = "<p>Discover our luxury suites in Denver.</p>";
    const result = injectInternalLinks(html, page, manifest);

    assert.strictEqual(result.report.totalInjected, 0);
    assert(!result.html.includes(page.url));
  });

  it("injects contextual links into paragraphs but skips headings and existing links", () => {
    const sourcePage = manifest[0];
    const inputHtml = `
      <h1>Explore Our Luxury Suites</h1>
      <p>We feature an exclusive <a href="https://other.com">luxury suites link</a> here.</p>
      <p>Guests can book modern luxury suites or enjoy dinner at our rooftop restaurant downtown.</p>
    `;

    const { html, report } = injectInternalLinks(inputHtml, sourcePage, manifest);

    // Should NOT inject in <h1>
    assert(!html.includes("<h1>Explore Our <a"));

    // Should NOT inject inside existing <a> tag
    assert(!html.includes('<a href="https://other.com"><a'));

    // Should inject into the second paragraph
    assert(html.includes('<a href="https://example.com/denver/suites/"'));
    assert(html.includes('<a href="https://example.com/denver/dining/"'));
    assert.strictEqual(report.totalInjected, 2);
  });

  it("enforces maximum links per page limit", () => {
    const sourcePage = manifest[0];
    const inputHtml = `
      <p>Our luxury suites are wonderful. Our rooftop restaurant is acclaimed.</p>
    `;

    const { report } = injectInternalLinks(inputHtml, sourcePage, manifest, {
      maxLinksPerPage: 1
    });

    assert.strictEqual(report.totalInjected, 1);
  });
});
