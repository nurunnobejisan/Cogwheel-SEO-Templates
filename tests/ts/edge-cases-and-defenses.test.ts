import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizeCanonicalUrl } from "../../validators/canonicalNormalizer.ts";
import { verifyProductionIndexable, ProductionNoindexError } from "../../validators/robotsGuardrails.ts";
import { cleanContent } from "../../validators/uniquenessGate.ts";
import { exportToHtml } from "../../exporters/htmlExporter.ts";
import { exportToWordPressPhp } from "../../exporters/wordPressExporter.ts";
import { injectInternalLinks, type PageManifestItem } from "../../validators/internalLinker.ts";

describe("Vitest/TS: Hardened Edge Cases & Defensive Safeguards", () => {
  it("Canonical normalizer maintains defaults when partial options are passed", () => {
    // Only pass trailingSlash: false, verifying forceHttps and stripTracking are NOT lost
    const normalized = normalizeCanonicalUrl("http://example.com/suites/?utm_source=fb&gclid=123", {
      trailingSlash: false
    });

    assert.strictEqual(normalized, "https://example.com/suites");
    assert(!normalized.includes("utm_source"));
    assert(!normalized.includes("gclid"));
    assert(normalized.startsWith("https://"));
  });

  it("Robots guardrail catches noindex regardless of attribute order", () => {
    // content attribute appears before name attribute
    const reversedAttributesHtml = '<html><head><meta content="noindex, follow" name="robots"></head></html>';
    assert.throws(
      () => verifyProductionIndexable(reversedAttributesHtml, "production"),
      ProductionNoindexError
    );

    // googlebot specific noindex
    const googlebotNoindexHtml = '<html><head><meta name="googlebot" content="noindex"></head></html>';
    assert.throws(
      () => verifyProductionIndexable(googlebotNoindexHtml, "production"),
      ProductionNoindexError
    );
  });

  it("Uniqueness gate safely handles empty and whitespace-only boilerplate phrases without hanging", () => {
    const raw = "<p>Welcome to Denver Luxury Hotel Suites.</p>";
    // Pass empty string and spaces in boilerplate
    const cleaned = cleanContent(raw, ["", "   ", "welcome to"]);
    assert.strictEqual(cleaned, "denver luxury hotel suites");
  });

  it("HTML Exporter safely escapes quotes in metadata attributes while preserving valid canonical URLs", () => {
    const html = exportToHtml({
      title: 'Luxury Hotel & "Spa" <Denver>',
      metaDescription: 'Rated "Best Luxury Resort" in downtown Denver.',
      canonicalUrl: "https://example.com/resort-suites/",
      bodyContent: "<main><h1>Welcome</h1></main>"
    });

    assert(html.includes('&quot;Best Luxury Resort&quot;'));
    assert(html.includes('<link rel="canonical" href="https://example.com/resort-suites/">'));
    assert(html.includes("&lt;Denver&gt;"));
  });

  it("WordPress PHP exporter outputs clean serialized JSON-LD without double json_encode", () => {
    const php = exportToWordPressPhp({
      postTitle: "Downtown Luxury Suite",
      postName: "downtown-luxury-suite",
      postContent: "<p>Room description</p>",
      seoTitle: "Downtown Luxury Suite | Official Site",
      metaDescription: "Spacious downtown suite.",
      schemaJsonLd: '{"@context":"https://schema.org","@type":"Hotel"}'
    });

    assert(php.includes("application/ld+json"));
    // Must NOT contain double json_encode
    assert(!php.includes("json_encode"));
    assert(php.includes('{"@context":"https://schema.org","@type":"Hotel"}'));
  });

  it("Internal linker handles anchor phrases with special characters and punctuation", () => {
    const sourcePage: PageManifestItem = {
      url: "https://example.com/guide/",
      primaryKeyword: "denver guide"
    };

    const siteManifest: PageManifestItem[] = [
      sourcePage,
      {
        url: "https://example.com/spa/",
        primaryKeyword: "spa & wellness",
        approvedAnchorVariations: ["luxury spa (on-site)", "#1 resort spa"]
      }
    ];

    const html = "<p>Relax at our luxury spa (on-site) during your vacation.</p>";
    const result = injectInternalLinks(html, sourcePage, siteManifest);

    assert.strictEqual(result.report.totalInjected, 1);
    assert(result.html.includes('href="https://example.com/spa/"'));
    assert(result.html.includes("luxury spa (on-site)"));
  });

  it("Variable resolver safely handles variables with regex pattern tokens like $& without placeholder leakage", async () => {
    const { resolveTemplate } = await import("../../validators/variableResolver.ts");
    const schema = {
      id: "offer-schema",
      name: "Special Offer",
      variables: {
        dealName: { name: "dealName", required: true }
      }
    };

    const res = resolveTemplate("Exclusive: {{dealName}} available now!", schema, {
      dealName: "Special $& Discount Offer"
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.output, "Exclusive: Special $& Discount Offer available now!");
  });

  it("Shopify Exporter properly uses payload fallback title and meta description when provided", async () => {
    const { exportToShopifyLiquid } = await import("../../exporters/shopifyExporter.ts");
    const liquid = exportToShopifyLiquid({
      scope: "product",
      snippetName: "presidential-suite",
      title: "Custom Presidential Suite Title",
      metaDescription: "Custom luxury suite description for SEO.",
      richContentHtml: "<p>Room content</p>"
    });

    assert(liquid.includes("Custom Presidential Suite Title | {{ shop.name }}"));
    assert(liquid.includes('content="Custom luxury suite description for SEO."'));
  });
});
