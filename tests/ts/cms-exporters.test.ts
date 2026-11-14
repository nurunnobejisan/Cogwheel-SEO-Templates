import { describe, it } from "node:test";
import assert from "node:assert";
import {
  exportToHtml,
  exportToShopifyLiquid,
  exportToWordPressPhp,
  exportToWordPressImportRecord,
  exportToWebflowCsv
} from "../../exporters/index.ts";

describe("Vitest/TS: Multi-CMS Exporters (HTML, Shopify, WordPress, Webflow)", () => {
  it("HTML Exporter produces clean HTML5 with canonicals, robots, and minification", () => {
    const output = exportToHtml(
      {
        title: "Denver Hotel Suites",
        metaDescription: "Luxury boutique hotel suites in downtown Denver.",
        canonicalUrl: "https://example.com/suites/",
        robotsDirective: '<meta name="robots" content="index, follow" />',
        bodyContent: "<main><h1>Denver Suites</h1><p>Spacious accommodations.</p></main>",
        jsonLdScript: '<script type="application/ld+json">{"@context":"https://schema.org"}</script>'
      },
      { minify: true }
    );

    assert(output.startsWith("<!DOCTYPE html>"));
    assert(output.includes("<title>Denver Hotel Suites</title>"));
    assert(output.includes('<link rel="canonical" href="https://example.com/suites/">'));
    assert(output.includes("application/ld+json"));
    assert(!output.includes("\n  ")); // verified minification
  });

  it("Shopify Exporter generates valid Liquid without template variable conflicts", () => {
    const liquid = exportToShopifyLiquid({
      scope: "product",
      snippetName: "luxury-suite-product",
      richContentHtml: "<article><h2>Penthouse Suite</h2></article>",
      schemaJsonLd: '{"@type":"Product","name":"Penthouse"}'
    });

    assert(liquid.includes("{%- comment -%}"));
    assert(liquid.includes("{{ product.title | escape }}"));
    assert(liquid.includes("{{ product.metafields.seo.title | escape }}"));
    assert(liquid.includes("{{ canonical_url }}"));
    assert(liquid.includes("luxury-suite-product.liquid"));
  });

  it("WordPress Exporter generates secure PHP partial and Yoast/RankMath records", () => {
    const php = exportToWordPressPhp({
      postTitle: "Denver Travel Guide 2026",
      postName: "denver-travel-guide-2026",
      postContent: "<p>Explore the best attractions in downtown Denver.</p>",
      seoTitle: "Denver Travel Guide | Downtown Denver Hotel",
      metaDescription: "Comprehensive guide to visiting Denver.",
      schemaJsonLd: '{"@type":"Article"}'
    });

    assert(php.includes("<?php"));
    assert(php.includes("if (!defined('ABSPATH'))"));
    assert(php.includes("esc_html"));
    assert(php.includes("Denver Travel Guide 2026"));

    const record = exportToWordPressImportRecord({
      postTitle: "Denver Travel Guide",
      postName: "denver-guide",
      postContent: "<p>Content</p>",
      seoTitle: "SEO Title",
      metaDescription: "Meta Desc",
      canonicalUrl: "https://example.com/denver-guide/",
      focusKeyword: "Denver Travel"
    });

    assert.strictEqual(record._yoast_wpseo_title, "SEO Title");
    assert.strictEqual(record._yoast_wpseo_canonical, "https://example.com/denver-guide/");
    assert.strictEqual(record.rank_math_title, "SEO Title");
    assert.strictEqual(record.rank_math_focus_keyword, "Denver Travel");
  });

  it("Webflow Exporter generates RFC 4180-compliant CSV rows with proper quote escaping", () => {
    const items = [
      {
        name: 'The "Grand" Hotel',
        slug: "the-grand-hotel",
        metaTitle: "Grand Hotel & Suites, Denver",
        metaDescription: "Luxury stay with pool, restaurant, and spa.",
        postBodyHtml: "<p>Welcome to our hotel.</p>"
      }
    ];

    const csv = exportToWebflowCsv(items);
    assert(csv.startsWith("Name,Slug,Meta Title,Meta Description,Post Body"));
    // Double quotes properly escaped as ""
    assert(csv.includes('"The ""Grand"" Hotel"'));
    assert(csv.includes('"Grand Hotel & Suites, Denver"'));
  });
});
