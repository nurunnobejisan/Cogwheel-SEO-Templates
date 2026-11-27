import { describe, it, expect } from "vitest";
import {
  sanitizeTextAndRedactPii,
  sanitizeUrlString,
} from "../shared/ts/training-capture";

describe("Phase 1.1: Comprehensive PII Sanitizer Test Suite", () => {
  describe("Negative Cases (Must NOT be redacted or altered)", () => {
    it("preserves various price formats without false positive redaction", () => {
      const prices = [
        "Room starting at $229.00 per night.",
        "Total price: $1,499.99 with tax included.",
        "Price range is $49 - $199 USD.",
        "Euro price is €450,50 and British Pounds £120.00.",
        "Subtotal 99.95 and discount 15%.",
      ];

      for (const text of prices) {
        const { sanitized, phonesCount, cardsCount, tokensCount } = sanitizeTextAndRedactPii(text);
        expect(sanitized).toBe(text);
        expect(phonesCount).toBe(0);
        expect(cardsCount).toBe(0);
        expect(tokensCount).toBe(0);
      }
    });

    it("preserves historical and future calendar years without false matches", () => {
      const years = [
        "Founded in 1984 and modernized in 2020.",
        "Copyright 2024, 2025, and 2026 SEO Studio.",
        "Between 1999 and 2030 projections look strong.",
      ];

      for (const text of years) {
        const { sanitized, phonesCount } = sanitizeTextAndRedactPii(text);
        expect(sanitized).toBe(text);
        expect(phonesCount).toBe(0);
      }
    });

    it("preserves 5-digit and 9-digit postal / ZIP codes without false matches", () => {
      const zips = [
        "Located in Panama City Beach, FL 32413.",
        "Beverly Hills CA 90210 and New York NY 10001.",
        "Extended code: Boston, MA 02109.",
      ];

      for (const text of zips) {
        const { sanitized, phonesCount, cardsCount } = sanitizeTextAndRedactPii(text);
        expect(sanitized).toBe(text);
        expect(phonesCount).toBe(0);
        expect(cardsCount).toBe(0);
      }
    });

    it("preserves order IDs, invoice numbers, and SKU reference strings", () => {
      const orderRefs = [
        "Order reference ORD-98421 confirmed.",
        "Invoice #104928 and shipment tracking ID TRK-882194.",
        "SKU: 8849-214-99 is in stock.",
        "Reference ID: REF-2026-998811.",
      ];

      for (const text of orderRefs) {
        const { sanitized, phonesCount, cardsCount, tokensCount } = sanitizeTextAndRedactPii(text);
        expect(sanitized).toBe(text);
        expect(phonesCount).toBe(0);
        expect(cardsCount).toBe(0);
        expect(tokensCount).toBe(0);
      }
    });

    it("preserves legitimate business and personal email addresses", () => {
      const emails = [
        "Inquiries to info@example.com or support@sub.domain.co.uk.",
        "Contact direct: john.doe+sales@company.org.",
        "General questions: concierge@luxuryhotel.com.",
      ];

      for (const text of emails) {
        const { sanitized } = sanitizeTextAndRedactPii(text);
        expect(sanitized).toBe(text);
      }
    });

    it("preserves non-sensitive URL search parameters and paths", () => {
      const urls = [
        "https://example.com/search?category=hotels&city=miami&page=2&sort=price_asc",
        "https://shop.example.com/product/12345?variant=blue&size=large",
        "https://blog.example.com/articles/seo-best-practices?utm_source=newsletter&utm_medium=email",
      ];

      for (const url of urls) {
        const { sanitizedUrl, hasRedactedQuery } = sanitizeUrlString(url);
        expect(hasRedactedQuery).toBe(false);
        expect(sanitizedUrl).toBe(url);
      }
    });
  });

  describe("Positive Cases (MUST be accurately redacted)", () => {
    it("redacts telephone numbers with international prefixes and separators", () => {
      const phones = [
        { text: "Call us at +1-850-230-6004 today.", count: 1 },
        { text: "Toll free: 1-800-555-0199 or office: (850) 230-6004.", count: 2 },
        { text: "Dot separated: 850.230.6004 is available.", count: 1 },
        { text: "International: +44 20 7946 0958 London office.", count: 1 },
      ];

      for (const item of phones) {
        const { sanitized, phonesCount } = sanitizeTextAndRedactPii(item.text);
        expect(phonesCount).toBe(item.count);
        expect(sanitized).toContain("[REDACTED_PHONE]");
        expect(sanitized).not.toContain("850-230-6004");
      }
    });

    it("redacts standard JSON Web Tokens (JWT)", () => {
      const jwt = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const { sanitized, jwtsCount } = sanitizeTextAndRedactPii(`Session: ${jwt}`);

      expect(jwtsCount).toBe(1);
      expect(sanitized).toContain("[REDACTED_JWT]");
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });

    it("redacts common API tokens, Google API keys, GitHub tokens, and Bearer tokens", () => {
      const tokens = [
        "Google Key: AIzaSyFakeKeyForTestPurposesOnly1234567 in config.",
        "GitHub token: ghp_1111222233334444555566667777888899990000 in header.",
        "Bearer ya29.a0AfH6SMByaBcDeFgHiJkLmNoPqRsTuVwXyZ12345 auth header.",
      ];

      for (const text of tokens) {
        const { sanitized, tokensCount } = sanitizeTextAndRedactPii(text);
        expect(tokensCount).toBeGreaterThan(0);
        expect(sanitized).toContain("[REDACTED_API_KEY]");
      }
    });

    it("redacts major credit card number patterns with spaces or hyphens", () => {
      const cards = [
        "Visa: 4111-2222-3333-4444 on file.",
        "MasterCard: 5500 0000 0000 0004 expires 12/28.",
        "Amex: 3782-822463-10005 personal card.",
      ];

      for (const text of cards) {
        const { sanitized, cardsCount } = sanitizeTextAndRedactPii(text);
        expect(cardsCount).toBeGreaterThan(0);
        expect(sanitized).toContain("[REDACTED_CARD]");
        expect(sanitized).not.toContain("4111-2222-3333-4444");
      }
    });

    it("redacts IBAN account numbers", () => {
      const text = "Wire payment to IBAN: GB82WEST12345698765432 branch London.";
      const { sanitized, cardsCount } = sanitizeTextAndRedactPii(text);

      expect(cardsCount).toBe(1);
      expect(sanitized).toContain("[REDACTED_CARD]");
      expect(sanitized).not.toContain("GB82WEST12345698765432");
    });

    it("redacts sensitive authentication and session parameters in URLs", () => {
      const sensitiveUrls = [
        "https://example.com/checkout?token=sec_abc123456&item=hotel",
        "https://api.example.com/v1/auth?session=sess_99887766&api_key=my_secret_key",
        "https://example.com/callback?access_token=ya29.auth_token&state=active",
      ];

      for (const url of sensitiveUrls) {
        const { sanitizedUrl, hasRedactedQuery } = sanitizeUrlString(url);
        expect(hasRedactedQuery).toBe(true);
        expect(sanitizedUrl).toContain("[REDACTED]");
        expect(sanitizedUrl).not.toContain("sec_abc123456");
        expect(sanitizedUrl).not.toContain("sess_99887766");
      }
    });
  });
});
