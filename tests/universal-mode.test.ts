import { describe, it, expect } from "vitest";
import {
  buildSnapshotFromHtml,
  createMemoryOverrideStore,
  createSnapshot,
  detectMode,
  resolveAuditMode,
  runAudit,
  validateAuditReport,
  type PageSnapshot,
} from "../rules/index.ts";

const GOOD_TITLE = "Enterprise SEO Visibility Platform for Hotels";
const GOOD_DESCRIPTION =
  "Track every keyword, audit any site, and deploy verified SEO fixes automatically across your entire hospitality portfolio in one dashboard.";

function goodUniversalSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return createSnapshot({
    url: "https://example.com/products/widgets",
    title: GOOD_TITLE,
    metaDescription: GOOD_DESCRIPTION,
    canonical: "https://example.com/products/widgets",
    headings: [{ level: 1, text: "Industrial Widgets" }],
    images: [],
    links: [],
    wordCount: 420,
    textContent: "Industrial widgets engineered for durability. ".repeat(20),
    jsonLd: [{ "@type": "WebSite" }],
    scriptSrcs: [],
    openGraph: {
      title: "Industrial Widgets",
      description: "Durable industrial widgets.",
      image: "https://example.com/og.png",
    },
    twitter: { card: "summary_large_image" },
    hasViewport: true,
    reservationWidgets: false,
    ...overrides,
  });
}

describe("Phase 1 — Domain & Context Detection", () => {
  it("defaults to Universal Mode when no hospitality signal is present", () => {
    const detection = detectMode(goodUniversalSnapshot());
    expect(detection.mode).toBe("universal");
    expect(detection.signals).toEqual([]);
    expect(detection.overridden).toBe(false);
  });

  it("detects Hotel Mode from a LodgingBusiness JSON-LD type", () => {
    const snapshot = goodUniversalSnapshot({ jsonLd: [{ "@type": "Hotel" }] });
    const detection = detectMode(snapshot);
    expect(detection.mode).toBe("hotel");
    expect(detection.signals).toContain("jsonld:Hotel");
    expect(detection.confidence).toBeGreaterThan(0);
  });

  it("detects Hotel Mode from a booking-engine script signature", () => {
    const snapshot = goodUniversalSnapshot({
      scriptSrcs: ["https://cdn.example.com/synxis-booking.js"],
    });
    const detection = detectMode(snapshot);
    expect(detection.mode).toBe("hotel");
    expect(detection.signals).toContain("booking-engine:synxis");
  });

  it("detects Hotel Mode from a reservation widget or booking params", () => {
    const widget = detectMode(goodUniversalSnapshot({ reservationWidgets: true }));
    expect(widget.mode).toBe("hotel");
    expect(widget.signals).toContain("reservation-widget");

    const params = detectMode(
      goodUniversalSnapshot({
        links: [{ href: "/book?checkin=2026-01-01&rooms=2", external: false }],
      })
    );
    expect(params.mode).toBe("hotel");
    expect(params.signals.some((s) => s.startsWith("reservation-param:"))).toBe(true);
  });

  it("honours a manual per-domain override over automatic detection", () => {
    const store = createMemoryOverrideStore({ "example.com": "hotel" });
    const resolution = resolveAuditMode(goodUniversalSnapshot(), store);
    expect(resolution.mode).toBe("hotel");
    expect(resolution.overridden).toBe(true);
    expect(resolution.confidence).toBe(1);
  });
});

describe("Phase 1 — Universal Rule Engine", () => {
  it("produces a clean, validated report for a well-optimised page", () => {
    const report = runAudit(goodUniversalSnapshot(), {
      auditId: "aud_test_good_univ",
      now: "2026-01-15T10:30:00.000Z",
    });
    expect(report.mode).toBe("universal");
    expect(report.issues).toEqual([]);
    expect(report.summary.score).toBe(100);
    expect(() => validateAuditReport(report)).not.toThrow();
  });

  it("flags missing meta description, alt text, thin content and canonical mismatch", () => {
    const snapshot = goodUniversalSnapshot({
      url: "https://example.com/products/widgets",
      title: "Industrial Widgets",
      metaDescription: "",
      canonical: "https://example.com/products/other",
      wordCount: 120,
      textContent: "Short page copy.",
      images: [{ src: "https://example.com/images/hero.jpg", alt: null, width: null, height: null }],
    });

    const report = runAudit(snapshot, { auditId: "aud_test_issues_univ" });
    const ids = report.issues.map((issue) => issue.issueId);

    expect(ids).toContain("iss_meta_desc_missing");
    expect(ids).toContain("iss_img_alt_missing");
    expect(ids).toContain("iss_thin_content");
    expect(ids).toContain("iss_canonical_mismatch");
    expect(report.summary.score).toBeLessThan(100);

    // Severity ordering: critical issues surface first.
    expect(report.issues[0]!.severity).toBe("critical");

    // Standardized payload round-trips through the strict schema.
    const parsed = validateAuditReport(report);
    expect(parsed.auditId).toBe("aud_test_issues_univ");
    expect(parsed.modeDetection.mode).toBe("universal");
  });

  it("carries CMS-ready targeting metadata on fixable issues", () => {
    const report = runAudit(goodUniversalSnapshot({ metaDescription: "" }));
    const metaIssue = report.issues.find((issue) => issue.issueId === "iss_meta_desc_missing");
    expect(metaIssue).toBeDefined();
    expect(metaIssue!.fixable).toBe(true);
    expect(metaIssue!.cmsTargetField).toBe("meta_description");
    expect(metaIssue!.context.selector).toContain("description");
  });

  it("flags legacy/un-dimensioned images and technical gaps", () => {
    const snapshot = goodUniversalSnapshot({
      canonical: null,
      hasViewport: false,
      openGraph: {},
      twitter: {},
      jsonLd: [],
      metaRobots: "noindex, nofollow",
      images: [{ src: "https://example.com/a.png", alt: "ok", width: null, height: null }],
      links: [
        { href: "https://external.example.org/x", external: true, rel: null },
        { href: "/gone", external: false, statusCode: 404 },
        { href: "/hop", external: false, redirectChain: ["/a", "/hop"] },
      ],
    });

    const ids = runAudit(snapshot).issues.map((issue) => issue.issueId);
    expect(ids).toContain("iss_canonical_missing");
    expect(ids).toContain("iss_viewport_missing");
    expect(ids).toContain("iss_noindex");
    expect(ids).toContain("iss_og_image_missing");
    expect(ids).toContain("iss_twitter_card_missing");
    expect(ids).toContain("iss_structured_data_missing");
    expect(ids).toContain("iss_img_legacy_format");
    expect(ids).toContain("iss_img_missing_dimensions");
    expect(ids).toContain("iss_external_link_rel");
    expect(ids).toContain("iss_broken_internal_link");
    expect(ids).toContain("iss_redirect_chain");
  });
});

describe("Phase 1 — Hotel Mode remains 100% operational", () => {
  const hotelSnapshot = (overrides: Partial<PageSnapshot> = {}): PageSnapshot =>
    goodUniversalSnapshot({
      jsonLd: [
        {
          "@type": "LodgingBusiness",
          name: "The Example Hotel",
          address: { "@type": "PostalAddress", streetAddress: "1 Main St" },
          telephone: "+1-555-0100",
          priceRange: "$$$",
          amenityFeature: [{ "@type": "LocationFeatureSpecification", name: "Spa" }],
          starRating: { "@type": "Rating", ratingValue: 4 },
        },
      ],
      scriptSrcs: ["https://cdn.example.com/synxis/booking-engine.js"],
      reservationWidgets: true,
      ...overrides,
    });

  it("runs the hospitality ruleset on top of the universal engine", () => {
    const report = runAudit(hotelSnapshot());
    expect(report.mode).toBe("hotel");
    expect(report.modeDetection.signals).toContain("jsonld:LodgingBusiness");
    expect(report.issues).toEqual([]);
    expect(report.summary.score).toBe(100);
    expect(() => validateAuditReport(report)).not.toThrow();
  });

  it("flags a missing LodgingBusiness schema when Hotel Mode is forced", () => {
    const store = createMemoryOverrideStore({ "example.com": "hotel" });
    const report = runAudit(goodUniversalSnapshot(), { overrideStore: store });
    expect(report.mode).toBe("hotel");
    const hotelIssues = report.issues.filter((issue) => issue.category === "hospitality");
    expect(hotelIssues.map((issue) => issue.issueId)).toContain("iss_hotel_schema_missing");
  });

  it("flags missing required LodgingBusiness properties", () => {
    const report = runAudit(
      hotelSnapshot({
        jsonLd: [{ "@type": "Hotel", name: "Only A Name" }],
      })
    );
    const ids = report.issues.map((issue) => issue.issueId);
    expect(ids).toContain("iss_hotel_schema_property_missing");
  });
});

describe("Phase 1 — Lightweight HTML snapshot fallback", () => {
  it("parses a real document into a snapshot and audits it end-to-end", () => {
    const html = `<!doctype html>
<html lang="en">
<head>
  <title>Widgets for Industrial Teams</title>
  <meta name="description" content="${GOOD_DESCRIPTION}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Widgets for Industrial Teams">
  <meta property="og:description" content="Durable widgets.">
  <meta property="og:image" content="https://example.com/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://example.com/products/widgets">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Widgets"}</script>
</head>
<body>
  <h1>Industrial Widgets</h1>
  <img src="/img/a.png" alt="A widget">
  <p>${"Durable widgets built for industrial use. ".repeat(30)}</p>
</body>
</html>`;

    const snapshot = buildSnapshotFromHtml(html, "https://example.com/products/widgets");
    expect(snapshot.title).toBe("Widgets for Industrial Teams");
    expect(snapshot.canonical).toBe("https://example.com/products/widgets");
    expect(snapshot.headings[0]).toEqual({ level: 1, text: "Industrial Widgets" });
    expect(snapshot.jsonLd[0]?.["@type"]).toBe("WebSite");
    expect(snapshot.hasViewport).toBe(true);

    const report = runAudit(snapshot, { auditId: "aud_html_univ" });
    expect(report.mode).toBe("universal");
    // Alt text present, canonical self-referential, no broken links.
    expect(report.issues.map((issue) => issue.issueId)).not.toContain("iss_img_alt_missing");
    expect(report.issues.map((issue) => issue.issueId)).not.toContain("iss_canonical_mismatch");
    expect(() => validateAuditReport(report)).not.toThrow();
  });
});
