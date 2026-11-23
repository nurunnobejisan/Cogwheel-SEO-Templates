import { describe, it, expect } from "vitest";
import {
  extractCapturedWebSample,
  querySelectorAllDeep,
  extractMainContentText,
} from "../chrome-extension/src/content/training-capture";
import { createMockDocument, createMockElement, MockNode } from "./test-dom-helper";

describe("Phase 1.2: Training-Capture Extractor Tests with HTML Fixtures", () => {
  it("Scenario 1 (Static Page): extracts metadata, H1-H6 outline, full JSON-LD and links", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Grand Luxury Resort & Spa | Miami Beach Official Site</title>
          <meta name="description" content="Experience 5-star beachfront luxury in Miami Beach. Oceanfront suites, infinity pool, spa, and award-winning dining. Book direct for lowest rates." />
          <meta name="robots" content="index, follow" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="canonical" href="https://luxuryresort.com/miami" />
          <meta property="og:title" content="Grand Luxury Resort & Spa | Miami Beach" />
          <meta property="og:description" content="5-star beachfront luxury suites in Miami Beach." />
          <meta property="og:image" content="https://luxuryresort.com/og.jpg" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Hotel",
              "name": "Grand Luxury Resort & Spa",
              "url": "https://luxuryresort.com/miami",
              "telephone": "+1-305-555-0199"
            }
          </script>
        </head>
        <body>
          <main>
            <h1>Grand Luxury Resort & Spa</h1>
            <p>Welcome to our premier oceanfront hotel destination in South Beach Miami with luxury pool and hot breakfast.</p>
            <h2>Oceanfront Suites & Penthouse</h2>
            <h3>Presidential Suite</h3>
            <h4>Amenities List</h4>
            <a href="https://luxuryresort.com/book" class="booking-cta">Book Direct Now</a>
          </main>
        </body>
      </html>
    `;

    const doc = createMockDocument(html, "https://luxuryresort.com/miami");
    const sample = extractCapturedWebSample(doc);

    expect(sample.title).toBe("Grand Luxury Resort & Spa | Miami Beach Official Site");
    expect(sample.metaDescription).toContain("Experience 5-star beachfront luxury");
    expect(sample.canonicalUrl).toBe("https://luxuryresort.com/miami");
    expect(sample.lang).toBe("en");
    expect(sample.headings.h1).toContain("Grand Luxury Resort & Spa");
    expect(sample.headings.h2).toContain("Oceanfront Suites & Penthouse");
    expect(sample.headings.outline.length).toBeGreaterThanOrEqual(4);
    expect(sample.jsonLdTypes).toContain("Hotel");
    expect(sample.jsonLdFull.length).toBe(1);
    expect(sample.extractionErrors).toEqual([]);
  });

  it("Scenario 2 (Shadow DOM Page): discovers and pierces open shadow roots", () => {
    const html = `
      <html>
        <head><title>Shadow DOM Test Page</title></head>
        <body>
          <main>
            <h1>Main Light DOM Heading</h1>
            <div id="host-element"></div>
          </main>
        </body>
      </html>
    `;

    const doc = createMockDocument(html, "https://example.com/shadow");
    const host = doc.getElementById("host-element") as unknown as MockNode;
    expect(host).not.toBeNull();

    if (host && host.attachShadow) {
      const shadow = host.attachShadow({ mode: "open" });
      const shadowH2 = createMockElement("h2", {}, "Shadow DOM Nested Subheading");
      shadowH2.parent = shadow;
      shadow.children.push(shadowH2);
    }

    const allH2 = querySelectorAllDeep(doc, "h2");
    expect(allH2.length).toBeGreaterThanOrEqual(1);
    expect(allH2.some((el) => el.textContent.includes("Shadow DOM Nested Subheading"))).toBe(true);
  });

  it("Scenario 3 (Same-Origin Iframe): extracts frame with explicit frameId tag", () => {
    const frameHtml = `
      <html>
        <head><title>Embedded Booking Widget</title></head>
        <body>
          <main>
            <h2>Instant Booking Engine</h2>
            <p>Select dates and choose executive king room.</p>
            <a href="/reserve" class="btn">Reserve Room</a>
          </main>
        </body>
      </html>
    `;

    const frameDoc = createMockDocument(frameHtml, "https://luxuryresort.com/frame/widget");
    const sample = extractCapturedWebSample(frameDoc, 104);

    expect(sample.frameId).toBe(104);
    expect(sample.headings.h2).toContain("Instant Booking Engine");
  });

  it("Scenario 4 (SPA Route Change): updates extraction when DOM content changes", () => {
    const initialHtml = `
      <html>
        <head>
          <title>Step 1: Room Selection | Resort</title>
          <link rel="canonical" href="https://example.com/rooms" />
        </head>
        <body>
          <main id="app-root">
            <h1>Select Your Room</h1>
            <p>Choose from standard, deluxe, and ocean view.</p>
          </main>
        </body>
      </html>
    `;

    const doc = createMockDocument(initialHtml, "https://example.com/rooms");
    const sampleStep1 = extractCapturedWebSample(doc);
    expect(sampleStep1.title).toBe("Step 1: Room Selection | Resort");
    expect(sampleStep1.headings.h1).toContain("Select Your Room");

    // Simulate SPA dynamic DOM transition
    doc.title = "Step 2: Resort Amenities | Resort";
    const canonical = doc.querySelector('link[rel="canonical"]') as unknown as MockNode;
    if (canonical) canonical.setAttribute("href", "https://example.com/amenities");

    const root = doc.getElementById("app-root") as unknown as MockNode;
    if (root) {
      root.children = [
        createMockElement("h1", {}, "Resort Amenities & Spa"),
        createMockElement("p", {}, "Infinity edge pool, sauna, and direct beach cabanas."),
      ];
    }

    const sampleStep2 = extractCapturedWebSample(doc);
    expect(sampleStep2.title).toBe("Step 2: Resort Amenities | Resort");
    expect(sampleStep2.canonicalUrl).toBe("https://example.com/amenities");
    expect(sampleStep2.headings.h1).toContain("Resort Amenities & Spa");
  });

  it("Scenario 5 (Cookie Banner): strips cookie dialogs and banners from main content", () => {
    const html = `
      <html>
        <head><title>Article Page</title></head>
        <body>
          <div class="cookie-banner" role="dialog">
            <p>We use cookies to enhance your experience. Accept all cookies or manage preferences.</p>
          </div>
          <header><nav><a href="/">Home</a></nav></header>
          <main>
            <h1>Key SEO Strategies for Modern Web Applications</h1>
            <p>High-quality editorial content describing technical search engine optimization.</p>
          </main>
        </body>
      </html>
    `;

    const doc = createMockDocument(html, "https://example.com/blog/seo");
    const cleanText = extractMainContentText(doc);

    expect(cleanText).toContain("Key SEO Strategies for Modern Web Applications");
    expect(cleanText).toContain("High-quality editorial content");
    expect(cleanText).not.toContain("Accept all cookies or manage preferences");
  });

  it("Scenario 6 (Security Gate - Password Field): strictly aborts and rejects capture", () => {
    const loginHtml = `
      <html>
        <head><title>Secure Account Login</title></head>
        <body>
          <main>
            <h1>Sign in to your member portal</h1>
            <input type="email" name="user_email" />
            <input type="password" name="user_password" />
          </main>
        </body>
      </html>
    `;

    const doc = createMockDocument(loginHtml, "https://example.com/login");
    expect(() => {
      extractCapturedWebSample(doc);
    }).toThrowError(/SECURITY_ABORT.*password field/i);
  });
});
