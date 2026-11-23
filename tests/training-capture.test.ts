import { describe, it, expect } from "vitest";
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
    // Lightweight, zero-dependency mock Document generator for Node test runtime
    interface MockNode {
      tagName: string;
      attrs: Record<string, string>;
      textContent: string;
      children: MockNode[];
      parent?: MockNode;
      isRemoved?: boolean;
      getAttribute(name: string): string | null;
      querySelectorAll(selector: string): MockNode[];
      querySelector(selector: string): MockNode | null;
      remove(): void;
      cloneNode(deep?: boolean): MockNode;
    }

    function createMockElement(tag: string, attrs: Record<string, string> = {}, text = ""): MockNode {
      const el: MockNode = {
        tagName: tag.toUpperCase(),
        attrs: { ...attrs },
        textContent: text,
        children: [],
        getAttribute(name: string) {
          const lower = name.toLowerCase();
          for (const [k, v] of Object.entries(this.attrs)) {
            if (k.toLowerCase() === lower) return v;
          }
          return null;
        },
        remove() {
          this.isRemoved = true;
          if (this.parent) {
            this.parent.children = this.parent.children.filter((c) => c !== this);
          }
        },
        querySelectorAll(selector: string): MockNode[] {
          const matches: MockNode[] = [];
          const testEl = (node: MockNode): boolean => {
            if (node.isRemoved) return false;
            if (selector === "*") return true;
            if (selector === '[aria-hidden="true"]') return node.getAttribute("aria-hidden") === "true";
            if (selector === "[hidden]") return node.getAttribute("hidden") !== null;
            if (selector.startsWith(".")) {
              const cls = selector.slice(1);
              return (node.getAttribute("class") || "").split(/\s+/).includes(cls);
            }
            if (selector.includes("[")) {
              const match = selector.match(/^([a-z0-9_-]+)?\[([a-z0-9_-]+)(?:="([^"]*)")?\]/i);
              if (match) {
                const [, sTag, attr, val] = match;
                if (sTag && node.tagName.toLowerCase() !== sTag.toLowerCase()) return false;
                const actual = node.getAttribute(attr);
                if (val !== undefined) return actual === val;
                return actual !== null;
              }
            }
            return node.tagName.toLowerCase() === selector.toLowerCase();
          };

          const traverse = (node: MockNode) => {
            for (const child of node.children) {
              if (child.isRemoved) continue;
              if (testEl(child)) matches.push(child);
              traverse(child);
            }
          };
          traverse(this);
          return matches;
        },
        querySelector(selector: string): MockNode | null {
          const res = this.querySelectorAll(selector);
          return res.length > 0 ? res[0] : null;
        },
        cloneNode(deep = true): MockNode {
          const cloned = createMockElement(this.tagName, { ...this.attrs }, this.textContent);
          if (deep) {
            cloned.children = this.children
              .filter((c) => !c.isRemoved)
              .map((c) => {
                const childClone = c.cloneNode(true);
                childClone.parent = cloned;
                return childClone;
              });
          }
          // Compute textContent dynamically from non-removed children
          Object.defineProperty(cloned, "textContent", {
            get() {
              if (this.children.length === 0) return this._rawText || "";
              return this.children
                .filter((c: MockNode) => !c.isRemoved)
                .map((c: MockNode) => c.textContent)
                .join(" ");
            },
            set(v: string) {
              this._rawText = v;
            },
          });
          (cloned as any)._rawText = this.textContent;
          return cloned;
        },
      };
      return el;
    }

    const createMockDocument = (html: string): Document => {
      const root = createMockElement("html");
      const head = createMockElement("head");
      const body = createMockElement("body");
      head.parent = root;
      body.parent = root;
      root.children.push(head, body);

      // Extract title
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const titleText = titleMatch ? titleMatch[1].trim() : "";
      if (titleMatch) {
        const titleEl = createMockElement("title", {}, titleText);
        titleEl.parent = head;
        head.children.push(titleEl);
      }

      // Extract meta tags
      const metaRegex = /<meta\s+([^>]+)>/gi;
      let m: RegExpExecArray | null;
      while ((m = metaRegex.exec(html)) !== null) {
        const attrStr = m[1];
        const attrs: Record<string, string> = {};
        const attrRegex = /([a-z0-9_-]+)="([^"]*)"/gi;
        let am: RegExpExecArray | null;
        while ((am = attrRegex.exec(attrStr)) !== null) {
          attrs[am[1]] = am[2];
        }
        const metaEl = createMockElement("meta", attrs);
        metaEl.parent = head;
        head.children.push(metaEl);
      }

      // Extract link canonical
      const linkRegex = /<link\s+([^>]+)>/gi;
      while ((m = linkRegex.exec(html)) !== null) {
        const attrStr = m[1];
        const attrs: Record<string, string> = {};
        const attrRegex = /([a-z0-9_-]+)="([^"]*)"/gi;
        let am: RegExpExecArray | null;
        while ((am = attrRegex.exec(attrStr)) !== null) {
          attrs[am[1]] = am[2];
        }
        const linkEl = createMockElement("link", attrs);
        linkEl.parent = head;
        head.children.push(linkEl);
      }

      // Extract script ld+json
      const scriptRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
      while ((m = scriptRegex.exec(html)) !== null) {
        const scriptEl = createMockElement("script", { type: "application/ld+json" }, m[1].trim());
        scriptEl.parent = head;
        head.children.push(scriptEl);
      }

      // Check for <main> block
      const mainMatch = html.match(/<main>([\s\S]*?)<\/main>/i);
      let mainEl: MockNode | null = null;
      if (mainMatch) {
        mainEl = createMockElement("main");
        mainEl.parent = body;
        body.children.push(mainEl);

        // Parse inner tags of main or general content
        const tagRegex = /<([a-z0-9_-]+)([^>]*)>([\s\S]*?)<\/\1>/gi;
        let tm: RegExpExecArray | null;
        while ((tm = tagRegex.exec(mainMatch[1])) !== null) {
          const tag = tm[1];
          const attrStr = tm[2];
          const content = tm[3];
          const attrs: Record<string, string> = {};
          const attrRegex = /([a-z0-9_-]+)="([^"]*)"/gi;
          let am: RegExpExecArray | null;
          while ((am = attrRegex.exec(attrStr)) !== null) {
            attrs[am[1]] = am[2];
          }
          const childEl = createMockElement(tag, attrs, content.replace(/<[^>]+>/g, "").trim());
          childEl.parent = mainEl;
          mainEl.children.push(childEl);
        }
      }

      // Check for elements outside main: header, nav, aside, footer
      const otherTags = ["header", "nav", "aside", "footer"];
      for (const ot of otherTags) {
        const reg = new RegExp(`<${ot}[^>]*>([\\s\\S]*?)<\\/${ot}>`, "gi");
        let om: RegExpExecArray | null;
        while ((om = reg.exec(html)) !== null) {
          const el = createMockElement(ot, {}, om[1].replace(/<[^>]+>/g, "").trim());
          el.parent = body;
          body.children.push(el);
        }
      }

      // Check for standalone h1, h2
      const h1Regex = /<h1>([\s\S]*?)<\/h1>/gi;
      while ((m = h1Regex.exec(html)) !== null) {
        const text = m[1].trim();
        if (!mainEl?.children.some((c) => c.tagName === "H1" && c.textContent === text)) {
          const el = createMockElement("h1", {}, text);
          el.parent = body;
          body.children.push(el);
        }
      }
      const h2Regex = /<h2>([\s\S]*?)<\/h2>/gi;
      while ((m = h2Regex.exec(html)) !== null) {
        const text = m[1].trim();
        if (!mainEl?.children.some((c) => c.tagName === "H2" && c.textContent === text)) {
          const el = createMockElement("h2", {}, text);
          el.parent = body;
          body.children.push(el);
        }
      }

      const docMock = {
        title: titleText,
        location: {
          href: "https://www.marriott.com/hotel/ecpsb?session=abc",
          hostname: "www.marriott.com",
        },
        querySelector(selector: string) {
          if (selector === "title") return head.querySelector("title");
          if (selector === "main") return mainEl;
          if (selector === "body") return body;
          return root.querySelector(selector);
        },
        querySelectorAll(selector: string) {
          return root.querySelectorAll(selector);
        },
        body,
      };

      return docMock as unknown as Document;
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
