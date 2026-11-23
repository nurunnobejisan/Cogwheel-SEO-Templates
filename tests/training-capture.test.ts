import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import {
  sanitizeTextAndRedactPii,
  sanitizeUrlString,
  extractMainContentText,
  extractCapturedWebSample,
  CapturedWebSample,
} from "../src/content/training-capture";

describe("Training Data Capture & PII Sanitization Module", () => {
  describe("PII Redaction Engine", () => {
    it("redacts standard and corporate email addresses", () => {
      const input = "Contact general manager at gm@luxuryresort.com or reservations@marriott-bonvoy.co.uk.";
      const { sanitized, emailsCount } = sanitizeTextAndRedactPii(input);

      expect(emailsCount).toBe(2);
      expect(sanitized).toBe("Contact general manager at [REDACTED_EMAIL] or [REDACTED_EMAIL].");
      expect(sanitized).not.toContain("gm@luxuryresort.com");
      expect(sanitized).not.toContain("reservations@marriott-bonvoy.co.uk");
    });

    it("redacts multiple telephone number formats", () => {
      const input = "Call front desk at +1-850-230-6004 or toll-free at 1-800-555-0199. Local: (850) 230-6004.";
      const { sanitized, phonesCount } = sanitizeTextAndRedactPii(input);

      expect(phonesCount).toBe(3);
      expect(sanitized).not.toContain("850-230-6004");
      expect(sanitized).not.toContain("1-800-555-0199");
      expect(sanitized).toContain("[REDACTED_PHONE]");
    });

    it("preserves standard dates and zip codes without false positives", () => {
      const input = "Check-in date is 2026-11-21 at postal code 32413 with room rate $299.";
      const { sanitized, phonesCount } = sanitizeTextAndRedactPii(input);

      expect(phonesCount).toBe(0);
      expect(sanitized).toBe(input);
    });

    it("strips tracking tokens and query parameters from URLs", () => {
      const urlWithTracking = "https://www.marriott.com/hotel/ecpsb?utm_source=google&gclid=CjwKCAiA&auth=token123#amenities";
      const { sanitizedUrl, hasRedactedQuery } = sanitizeUrlString(urlWithTracking);

      expect(hasRedactedQuery).toBe(true);
      expect(sanitizedUrl).toContain("?redacted_query=true");
      expect(sanitizedUrl).not.toContain("utm_source");
      expect(sanitizedUrl).not.toContain("gclid");
      expect(sanitizedUrl).not.toContain("auth=token123");
    });

    it("redacts URLs embedded inside body text", () => {
      const text = "Visit our booking portal at https://booking.example.com/reserve?promo=SPRING2026&token=secret today.";
      const { sanitized, queriesCount } = sanitizeTextAndRedactPii(text);

      expect(queriesCount).toBe(1);
      expect(sanitized).toContain("https://booking.example.com/reserve?redacted_query=true");
      expect(sanitized).not.toContain("token=secret");
    });
  });

  describe("Read-Only DOM Content Extraction", () => {
    // Helper to create synthetic HTML documents in Node test environment
    const createMockDocument = (html: string): Document => {
      const dom = new JSDOM(html);
      return dom.window.document;
    };

    it("extracts clean main article text while excluding nav, footer, scripts, and hidden nodes", () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Test Hotel</title></head>
        <body>
          <header><div class="navbar"><a href="/">Home</a><nav>Navigation Links</nav></div></header>
          <nav>Sidebar Navigation</nav>
          <main>
            <h1>Premier Beachfront Resort</h1>
            <p>Welcome to our luxury beachfront suites on the Florida Gulf Coast.</p>
            <div style="display: none">Hidden SEO keyword stuffing text</div>
            <p aria-hidden="true">Accessibility hidden text</p>
            <script>console.log("analytics tracking code");</script>
            <style>body { color: red; }</style>
            <p>Enjoy our oceanfront lazy river and complimentary hot breakfast.</p>
          </main>
          <aside><p>Sidebar promotions and banner ads</p></aside>
          <footer><p>Copyright 2026 Hotel LLC. All rights reserved.</p></footer>
        </body>
        </html>
      `;

      const doc = createMockDocument(mockHtml);
      const mainText = extractMainContentText(doc);

      expect(mainText).toContain("Premier Beachfront Resort");
      expect(mainText).toContain("Welcome to our luxury beachfront suites");
      expect(mainText).toContain("Enjoy our oceanfront lazy river and complimentary hot breakfast.");

      // Verify excluded elements
      expect(mainText).not.toContain("Sidebar Navigation");
      expect(mainText).not.toContain("Navigation Links");
      expect(mainText).not.toContain("Copyright 2026 Hotel LLC");
      expect(mainText).not.toContain("analytics tracking code");
      expect(mainText).not.toContain("Sidebar promotions");
      expect(mainText).not.toContain("Hidden SEO keyword stuffing text");
    });

    it("extracts full structured metadata, JSON-LD @graph types, and Open Graph tags", () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SpringHill Suites Panama City Beachfront | Marriott</title>
          <meta name="description" content="Stay beachfront with lazy river pool. Call +1-850-230-6004 for info.">
          <link rel="canonical" href="https://www.marriott.com/hotel/ecpsb?session=abc">
          <meta property="og:title" content="SpringHill Suites Official Site">
          <meta property="og:description" content="Direct booking beachfront hotel suites.">
          <meta property="og:type" content="hotel">
          <meta property="og:image" content="https://cache.marriott.com/img.jpg?w=1200">
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Hotel",
                "name": "SpringHill Suites"
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "Is breakfast free?"
                  }
                ]
              }
            ]
          }
          </script>
        </head>
        <body>
          <main>
            <h1>SpringHill Suites Panama City Beachfront</h1>
            <h2>Oceanfront Suites & Amenities</h2>
            <h2>Dining & Beachfront Bar</h2>
            <p>Send reservations questions to reservations@marriott.com or call 850-230-6004.</p>
          </main>
        </body>
        </html>
      `;

      const doc = createMockDocument(mockHtml);
      const sample = extractCapturedWebSample(doc);

      expect(sample.title).toBe("SpringHill Suites Panama City Beachfront | Marriott");
      expect(sample.metaDescription).toContain("[REDACTED_PHONE]");
      expect(sample.canonicalUrl).toContain("?redacted_query=true");

      // Headings
      expect(sample.headings.h1).toEqual(["SpringHill Suites Panama City Beachfront"]);
      expect(sample.headings.h2).toEqual([
        "Oceanfront Suites & Amenities",
        "Dining & Beachfront Bar",
      ]);

      // JSON-LD Types
      expect(sample.jsonLdTypes).toContain("Hotel");
      expect(sample.jsonLdTypes).toContain("FAQPage");
      expect(sample.jsonLdTypes).toContain("Question");

      // Open Graph
      expect(sample.openGraph.title).toBe("SpringHill Suites Official Site");
      expect(sample.openGraph.type).toBe("hotel");

      // PII Sanitization Metrics
      expect(sample.mainContentText).toContain("[REDACTED_EMAIL]");
      expect(sample.mainContentText).toContain("[REDACTED_PHONE]");
      expect(sample.sanitizationMetrics.redactedEmailsCount).toBeGreaterThan(0);
      expect(sample.sanitizationMetrics.redactedPhonesCount).toBeGreaterThan(0);
      expect(sample.wordCount).toBeGreaterThan(0);
      expect(sample.extractedAt).toBeDefined();
    });
  });
});
