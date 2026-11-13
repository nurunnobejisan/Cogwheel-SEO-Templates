import { afterEach, describe, expect, it } from "vitest";
import {
  clearCrawlCache,
  detectServicesInText,
  extractHtmlCrawlText,
  UrlValidationError,
  validateTargetUrl,
} from "@/core/crawler";

describe("core/crawler", () => {
  afterEach(() => {
    clearCrawlCache();
  });

  it("validates public http/https URLs and normalizes missing scheme", () => {
    expect(validateTargetUrl("thenines.com")).toBe("https://thenines.com/");
    expect(validateTargetUrl("https://www.hilton.com/en/hotels/")).toBe("https://www.hilton.com/en/hotels/");
    expect(validateTargetUrl("")).toBe("");
  });

  it("blocks SSRF targets (localhost, private IPs, non-http schemes)", () => {
    expect(() => validateTargetUrl("http://localhost:3000")).toThrow(UrlValidationError);
    expect(() => validateTargetUrl("http://127.0.0.1/admin")).toThrow(UrlValidationError);
    expect(() => validateTargetUrl("http://10.0.0.5/")).toThrow(UrlValidationError);
    expect(() => validateTargetUrl("http://192.168.1.1/")).toThrow(UrlValidationError);
    expect(() => validateTargetUrl("http://172.16.0.10/")).toThrow(UrlValidationError);
    expect(() => validateTargetUrl("http://169.254.169.254/latest/meta-data/")).toThrow(UrlValidationError);
    expect(() => validateTargetUrl("ftp://example.com/file")).toThrow(UrlValidationError);
    expect(() => validateTargetUrl("http://internal-service.local")).toThrow(UrlValidationError);
  });

  it("detects hospitality services from text", () => {
    const services = detectServicesInText("Luxury boutique hotel with rooftop pool, spa, wedding venues and pet friendly rooms");
    expect(services.has("lodging")).toBe(true);
    expect(services.has("boutique")).toBe(true);
    expect(services.has("luxury")).toBe(true);
    expect(services.has("pool")).toBe(true);
    expect(services.has("spa")).toBe(true);
    expect(services.has("wedding")).toBe(true);
    expect(services.has("venues")).toBe(true);
    expect(services.has("pet_friendly")).toBe(true);
  });

  it("extracts title, meta description, headings, and strips scripts", () => {
    const html = `
      <html>
        <head>
          <title>Hotel X Gainesville</title>
          <meta name="description" content="Boutique hotel near UF campus." />
        </head>
        <body>
          <script>var secret = "ignore me";</script>
          <h1>Welcome to Hotel X</h1>
          <h2>Dining &amp; Rooftop Bar</h2>
          <p>Pet friendly rooms in Gainesville, FL.</p>
        </body>
      </html>
    `;
    const extracted = extractHtmlCrawlText(html);
    expect(extracted.title).toBe("Hotel X Gainesville");
    expect(extracted.headings).toEqual(["Welcome to Hotel X", "Dining & Rooftop Bar"]);
    expect(extracted.text).toContain("Boutique hotel near UF campus.");
    expect(extracted.text).not.toContain("ignore me");
  });
});

