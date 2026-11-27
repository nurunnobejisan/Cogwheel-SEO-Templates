/**
 * Phase E — TemplateCustomizerView renders through the single renderer.
 *
 *   1. bracket tokens are substituted by `shared/ts/template-render` +
 *      `validators/variableResolver` (no inline replace chain);
 *   2. cleared variables surface in the preview audit (pre-render validation
 *      results are visible, not silently dropped);
 *   3. the HTML export escapes every interpolated field through
 *      `validators/xssProtection`;
 *   4. CSV fields are RFC-4180 quoted.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TemplateCustomizerView,
  buildCustomizerExportHtml,
  csvEscapeField,
} from "@/components/TemplateCustomizerView";
import { TEMPLATES_DATA, type SeoTemplate } from "@/packs/hotel/templates";

const templateWithToken =
  TEMPLATES_DATA.find((t) => t.contentMarkdown.includes("[Brand Name]")) ?? TEMPLATES_DATA[0];

function render(template: SeoTemplate): string {
  return renderToStaticMarkup(
    createElement(TemplateCustomizerView, { template, relatedTemplates: [] })
  );
}

/** The preview `<pre>` block — field labels legitimately show `[Brand Name]`. */
function previewOf(html: string): string {
  return html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1] ?? "";
}

describe("TemplateCustomizerView — one renderer + validators wired", () => {
  it("substitutes bracket tokens through the shared renderer with defaults filled", () => {
    const html = render(templateWithToken);
    const preview = previewOf(html);
    expect(preview).toContain(templateWithToken.defaultVariables.brandName);
    expect(preview).not.toContain("[Brand Name]");
    // Fully-filled defaults → the preview audit stays quiet.
    expect(html).not.toContain("Unresolved:");
  });

  it("surfaces cleared variables in the preview audit instead of blanking them", () => {
    const cleared: SeoTemplate = {
      ...templateWithToken,
      defaultVariables: {
        brandName: "",
        primaryKeyword: "",
        targetUrl: "",
        locationNiche: "",
        competitorDomain: "",
      },
    };
    const html = render(cleared);
    expect(html).toContain('role="status"');
    expect(html).toContain("Unresolved:");
    expect(html).toContain("brandName");
    // The empty variable keeps its bracket token visible in the preview.
    expect(previewOf(html)).toContain("[Brand Name]");
  });

  it("csvEscapeField quotes fields and doubles embedded quotes", () => {
    expect(csvEscapeField("plain")).toBe('"plain"');
    expect(csvEscapeField('say "hi"')).toBe('"say ""hi"""');
  });

  it("buildCustomizerExportHtml escapes every interpolated field", () => {
    const html = buildCustomizerExportHtml(
      '<script>alert(1)</script>',
      "A & B",
      "line <break> & 'quote'"
    );
    expect(html).not.toContain("<script>");
    // escapeHtml also encodes "/" → &#x2F; inside the closing tag.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("line &lt;break&gt;");
    expect(html).toContain("&#39;quote&#39;");
  });
});
