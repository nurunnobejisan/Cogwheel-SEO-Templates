/**
 * Phase E — `validators/internalLinker` wired into the product via
 * `InternalLinkLab` (LabsView sandbox).
 *
 * The lab runs the real engine over a fixed four-page manifest; these tests
 * pin that the rendered output IS the engine's computed suggestion set
 * (anchors, targets, relationships, heading guardrail) — not hand-written UI.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InternalLinkLab } from "@/components/InternalLinkLab";

const property = {
  name: "Test Hotel",
  brand: "Test Hotel",
  city: "Denver",
  state: "CO",
  url: "https://hotel.example/",
};

describe("InternalLinkLab — internalLinker wired", () => {
  it("renders the engine's three computed link suggestions for the property URL", () => {
    const html = renderToStaticMarkup(createElement(InternalLinkLab, { property }));

    // Targets: suites (sibling), home (parent), contact (sibling) — the
    // engine's topical-relevance ordering with maxLinksPerPage: 3.
    expect(html).toContain("3 links");
    expect(html).toContain("https://hotel.example/suites/");
    expect(html).toContain("https://hotel.example/contact/");
    expect(html).toContain("&quot;https://hotel.example/&quot;");
    expect(html).toContain("sibling");
    expect(html).toContain("parent");

    // Heading guardrail: the <h2> stays link-free (engine rule — never
    // inject inside h1–h6), rendered here as escaped text inside <pre>.
    expect(html).toContain("&lt;h2&gt;Plan Your Stay&lt;/h2&gt;");
  });

  it("works without a property (example.com defaults), deterministically", () => {
    const first = renderToStaticMarkup(createElement(InternalLinkLab, {}));
    const second = renderToStaticMarkup(createElement(InternalLinkLab, {}));
    expect(first).toBe(second);
    expect(first).toContain("3 links");
    expect(first).toContain("https://example.com/suites/");
    expect(first).toContain("https://example.com/contact/");
  });
});
