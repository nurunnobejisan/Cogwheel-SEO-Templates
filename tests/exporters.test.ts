import { describe, it } from "node:test";
import assert from "node:assert";
import {
  exportToHtml,
  exportToShopifyLiquid,
  exportToWordPressPhp,
  exportToWordPressImportRecord,
  exportToWebflowCsv
} from "../exporters/index.ts";

describe("Day 8: Multi-CMS Export Adapters", () => {
  it("generates valid HTML5 with metadata and minification support", () => {
    const html = exportToHtml(
      {
        title: "Boutique Denver Hotel",
        metaDescription: "Experience luxury rooms in downtown Denver.",
        canonicalUrl: "https://example.com/denver/",
        bodyContent: "<main><h1>Welcome to Denver</h1></main>",
        jsonLdScript: '<script type="application/ld+json">{"@context":"https://schema.org"}</script>'
      },
      { minify: true }
    );

    assert(html.startsWith("<!DOCTYPE html>"));
    assert(html.includes("<title>Boutique Denver Hotel</title>"));
    assert(html.includes('<link rel="canonical" href="https://example.com/denver/">'));
    assert(html.includes("application/ld+json"));
  });

  it("deduplicates head tags smuggled through raw fields (robotsGuardrails)", () => {
    const html = exportToHtml({
      title: "Clean Title",
      metaDescription: "Clean description.",
      canonicalUrl: "https://example.com/",
      // Raw fields can try to inject a second title/description — the export
      // passes through deduplicateHeadTags, so only the real tags survive.
      bodyContent: "</body></html><title>Evil Second Title</title>",
      jsonLdScript: '<meta name="description" content="injected">'
    });

    const titles = html.match(/<title>[\s\S]*?<\/title>/gi) || [];
    assert.strictEqual(titles.length, 1);
    assert.strictEqual(titles[0], "<title>Clean Title</title>");

    const descriptions = html.match(/<meta[^>]+name=["']description["'][^>]*>/gi) || [];
    assert.strictEqual(descriptions.length, 1);
    assert(descriptions[0].includes("Clean description."));
  });

  it("generates valid Shopify Liquid with object model mappings", () => {
    const liquid = exportToShopifyLiquid({
      scope: "product",
      snippetName: "hotel-room-seo",
      richContentHtml: "<p>Spacious suite with king bed.</p>"
    });

    assert(liquid.includes("{%- comment -%}"));
    assert(liquid.includes("{{ product.title | escape }}"));
    assert(liquid.includes("{{ canonical_url }}"));
    assert(liquid.includes("hotel-room-seo.liquid"));
  });

  it("generates WordPress PHP partial and Yoast/RankMath import structures", () => {
    const php = exportToWordPressPhp({
      postTitle: "Denver Travel Guide",
      postName: "denver-travel-guide",
      postContent: "<p>Best attractions in Colorado.</p>",
      seoTitle: "Denver Travel Guide 2026",
      metaDescription: "Plan your trip with our guide."
    });

    assert(php.includes("<?php"));
    assert(php.includes("Denver Travel Guide"));

    const record = exportToWordPressImportRecord({
      postTitle: "Denver Travel Guide",
      postName: "denver-travel-guide",
      postContent: "<p>Content</p>",
      seoTitle: "SEO Title",
      metaDescription: "Meta Description",
      focusKeyword: "Denver Travel"
    });

    assert.strictEqual(record._yoast_wpseo_title, "SEO Title");
    assert.strictEqual(record._yoast_wpseo_focuskw, "Denver Travel");
    assert.strictEqual(record.rank_math_title, "SEO Title");
    assert.strictEqual(record.rank_math_focus_keyword, "Denver Travel");
  });

  it("generates Webflow-compliant CSV with RFC-escaped columns", () => {
    const items = [
      {
        name: "Denver Hotel, Resort & Spa",
        slug: "denver-hotel-resort",
        metaTitle: 'Title with "Quotes"',
        metaDescription: "Meta description with, comma",
        postBodyHtml: "<p>Rich text</p>"
      }
    ];

    const csv = exportToWebflowCsv(items);
    assert(csv.startsWith("Name,Slug,Meta Title,Meta Description"));
    assert(csv.includes('"Denver Hotel, Resort & Spa"'));
    assert(csv.includes('"Title with ""Quotes"""'));
    assert(csv.includes('"Meta description with, comma"'));
  });
});
