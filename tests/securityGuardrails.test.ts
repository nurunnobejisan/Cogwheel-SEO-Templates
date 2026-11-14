import { describe, it } from "node:test";
import assert from "node:assert";
import { escapeHtml, escapeHtmlAttribute, sanitizeInput } from "../validators/xssProtection.ts";
import { normalizeCanonicalUrl } from "../validators/canonicalNormalizer.ts";
import {
  getRobotsDirectives,
  verifyProductionIndexable,
  ProductionNoindexError,
  deduplicateHeadTags
} from "../validators/robotsGuardrails.ts";

describe("Day 3: XSS Protection, Canonical Normalizer & Robots Guardrails", () => {
  describe("XSS Protection", () => {
    it("escapes dangerous HTML characters in body text", () => {
      const malicious = '<script>alert("XSS")</script>&"\'';
      const escaped = escapeHtml(malicious);
      assert(!escaped.includes("<script>"));
      assert(escaped.includes("&lt;script&gt;"));
      assert(escaped.includes("&quot;"));
      assert(escaped.includes("&#39;") || escaped.includes("&#x27;"));
    });

    it("prevents javascript: pseudo-protocols in HTML attributes", () => {
      const href = 'javascript:evil()';
      const sanitized = escapeHtmlAttribute(href);
      assert(!sanitized.startsWith("javascript:"));
      assert(sanitized.includes("blocked-javascript:"));
    });

    it("sanitizes inline event handlers from rich text", () => {
      const input = '<img src="img.jpg" onerror="alert(1)">';
      const cleaned = sanitizeInput(input);
      assert(!cleaned.includes("onerror"));
    });
  });

  describe("Canonical Normalizer", () => {
    it("enforces HTTPS, removes tracking params, deduplicates slashes, and adds trailing slash", () => {
      const dirty = "http://HOTEL.com//denver//rooms/?utm_source=google&fbclid=12345#overview";
      const normalized = normalizeCanonicalUrl(dirty);
      assert.strictEqual(normalized, "https://hotel.com/denver/rooms/");
    });

    it("preserves legitimate query parameters while removing analytics params", () => {
      const url = "https://hotel.com/search?roomType=deluxe&utm_campaign=winter_promo&gclid=abc";
      const normalized = normalizeCanonicalUrl(url);
      assert.strictEqual(normalized, "https://hotel.com/search/?roomType=deluxe");
    });
  });

  describe("Robots Guardrails", () => {
    it("generates noindex for staging and index for production", () => {
      const devDirectives = getRobotsDirectives("development");
      assert.strictEqual(devDirectives.index, false);
      assert(devDirectives.tag.includes("noindex, nofollow"));

      const prodDirectives = getRobotsDirectives("production");
      assert.strictEqual(prodDirectives.index, true);
      assert(prodDirectives.tag.includes("index, follow"));
    });

    it("blocks production builds when noindex is present", () => {
      const leakedHtml = '<html><head><meta name="robots" content="noindex, nofollow"></head></html>';
      assert.throws(
        () => verifyProductionIndexable(leakedHtml, "production"),
        (err: any) => err instanceof ProductionNoindexError
      );
    });

    it("deduplicates multiple titles, meta descriptions, and canonical tags", () => {
      const duplicateHtml = `
        <title>First Title</title>
        <title>Second Title</title>
        <meta name="description" content="Desc 1" />
        <meta name="description" content="Desc 2" />
        <link rel="canonical" href="https://example.com/1/" />
        <link rel="canonical" href="https://example.com/2/" />
      `;
      const cleaned = deduplicateHeadTags(duplicateHtml);
      const titleMatches = cleaned.match(/<title>/gi) || [];
      const descMatches = cleaned.match(/name="description"/gi) || [];
      const canonMatches = cleaned.match(/rel="canonical"/gi) || [];

      assert.strictEqual(titleMatches.length, 1);
      assert.strictEqual(descMatches.length, 1);
      assert.strictEqual(canonMatches.length, 1);
    });
  });
});
