import { describe, expect, it } from "vitest";
import { validateLlmsTxt } from "../rules/geo/llms-txt";
import { checkAiCrawlers, parseRobotsTxt } from "../rules/geo/ai-crawlers";
import { buildCitabilityScore } from "../rules/geo/citability";
import { diffGeoSnapshots } from "../rules/geo/drift";
import { collectGeoAudit } from "../src/rules/geo";
import type { PageSnapshot } from "../rules/types";

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: "https://example.com/",
    hostname: "example.com",
    title: "Example Hotel — Official Site",
    metaDescription: "Example Hotel in Denver. Rooms, rates and amenities.",
    canonical: "https://example.com/",
    metaRobots: null,
    language: "en",
    headings: [
      { level: 1, text: "Example Hotel" },
      { level: 2, text: "What amenities does Example Hotel offer?" },
      { level: 2, text: "How much does a room cost?" },
      { level: 2, text: "Where is Example Hotel located?" },
    ],
    images: [],
    links: [
      { href: "https://example.com/rooms", external: false },
      { href: "https://tourism.example.org/guide", external: true },
      { href: "https://data.example.org/stats", external: true },
    ],
    wordCount: 900,
    textContent:
      "Example Hotel is a 120-room boutique hotel in downtown Denver.\n\n" +
      "Rooms start at 40% below peak season and guests stay an average of 3 nights. " +
      "According to the city tourism board, 62% of visitors book within 30 days. " +
      "“The location makes the whole trip walkable,” one guest said.\n\n" +
      "- Free breakfast\n- Rooftop pool\n- Pet friendly\n\n" +
      "Example Hotel has been operating since 2018 and is independently owned.",
    jsonLd: [
      { "@type": "Hotel", name: "Example Hotel", telephone: "+1-303-555-0100", address: { streetAddress: "1 Main St" }, sameAs: ["https://example.com/about"] },
      { "@type": "FAQPage", name: "Example Hotel FAQ" },
      { "@type": "Organization", name: "Example Hotel" },
    ],
    scriptSrcs: [],
    openGraph: { title: "Example Hotel" },
    twitter: {},
    hasViewport: true,
    reservationWidgets: true,
    fetchStatus: 200,
    ...overrides,
  };
}

describe("llms.txt validation", () => {
  it("accepts a well-formed llms.txt", () => {
    const result = validateLlmsTxt({
      url: "https://example.com/llms.txt",
      statusCode: 200,
      text: "# Example Hotel\n\n> A downtown Denver boutique hotel.\n\n## Rooms\n\n- [Rooms](https://example.com/rooms)\n- [FAQ](https://example.com/faq)\n",
    });
    expect(result.status).toBe("present");
    expect(result.score).toBe(100);
    expect(result.parsed?.sectionCount).toBe(1);
    expect(result.parsed?.linkCount).toBe(2);
  });

  it("reports a missing file as absent, not invalid", () => {
    const result = validateLlmsTxt({ url: "https://example.com/llms.txt", statusCode: 404 });
    expect(result.status).toBe("absent");
    expect(result.score).toBe(0);
  });

  it("rejects an HTML page served at /llms.txt", () => {
    const result = validateLlmsTxt({
      url: "https://example.com/llms.txt",
      statusCode: 200,
      text: "<!doctype html><html><body>Not found</body></html>",
    });
    expect(result.status).toBe("invalid");
    expect(result.checks.find((c) => c.id === "plain_text")?.pass).toBe(false);
  });

  it("marks a network failure unavailable", () => {
    const result = validateLlmsTxt({ url: "https://example.com/llms.txt", statusCode: null, error: "timeout" });
    expect(result.status).toBe("unavailable");
    expect(result.score).toBeNull();
  });
});

describe("AI crawler robots.txt parsing", () => {
  it("group multiple user-agent lines before rules", () => {
    const groups = parseRobotsTxt("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n");
    expect(groups).toHaveLength(1);
    expect(groups[0].agents).toEqual(["GPTBot", "ClaudeBot"]);
    expect(groups[0].rules).toEqual([{ allow: false, path: "/" }]);
  });

  it("blocks named crawlers and lets an Allow rule override", () => {
    const result = checkAiCrawlers({
      robotsUrl: "https://example.com/robots.txt",
      statusCode: 200,
      text: [
        "User-agent: GPTBot",
        "Disallow: /",
        "",
        "User-agent: ClaudeBot",
        "Disallow: /private",
        "Allow: /",
        "",
        "User-agent: *",
        "Disallow: /",
      ].join("\n"),
    });
    expect(result.status).toBe("present");
    expect(result.bots.find((b) => b.bot === "GPTBot")?.status).toBe("blocked");
    expect(result.bots.find((b) => b.bot === "ClaudeBot")?.status).toBe("allowed");
    expect(result.bots.find((b) => b.bot === "PerplexityBot")?.status).toBe("blocked");
    expect(result.blockedBots).toContain("GPTBot");
  });

  it("treats a 404 robots.txt as unrestricted by default", () => {
    const result = checkAiCrawlers({ robotsUrl: "https://example.com/robots.txt", statusCode: 404 });
    expect(result.status).toBe("absent");
    expect(result.blockedBots).toHaveLength(0);
    expect(result.unmentionedBots.length).toBeGreaterThan(0);
  });

  it("does not claim access when robots.txt could not be fetched", () => {
    const result = checkAiCrawlers({ robotsUrl: "https://example.com/robots.txt", statusCode: null, error: "timeout" });
    expect(result.provenance).toBe("unavailable");
    expect(result.status).toBe("unavailable");
  });
});

describe("citability score", () => {
  it("exposes a weighted formula and every input", () => {
    const score = buildCitabilityScore(snapshot());
    expect(score.provenance).toBe("estimated");
    expect(score.components.map((c) => c.id)).toEqual([
      "structured_data",
      "answer_coverage",
      "entity_signals",
      "content_depth",
      "citations",
    ]);
    expect(score.components.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
    expect(score.formula).toContain("0.25");
    expect(score.components.every((c) => Object.keys(c.inputs).length > 0)).toBe(true);
    expect(score.score).toBeGreaterThan(60);
  });

  it("scores a thin page with no schema lower", () => {
    const rich = buildCitabilityScore(snapshot()).score;
    const thin = buildCitabilityScore(
      snapshot({
        headings: [{ level: 1, text: "Home" }],
        jsonLd: [],
        wordCount: 90,
        textContent: "Welcome to our website. Contact us for details.",
        links: [],
        metaDescription: "",
        title: "Home",
      })
    ).score;
    expect(thin).toBeLessThan(rich);
    expect(thin).toBeLessThan(40);
  });
});

describe("GEO drift", () => {
  function geoReportFor(overrides: Parameters<typeof snapshot>[0] = {}) {
    const snap = snapshot(overrides);
    return collectGeoAudit({
      url: snap.url,
      domain: snap.hostname,
      snapshot: snap,
      capturedAt: "2026-11-01T00:00:00.000Z",
      robots: { url: "https://example.com/robots.txt", statusCode: 200, text: "User-agent: *\nAllow: /\n" },
      llms: {
        url: "https://example.com/llms.txt",
        statusCode: 200,
        text: "# Example\n\n> Summary\n\n## Pages\n\n- [Home](https://example.com/)\n",
      },
    });
  }

  it("reports no baseline on a first run", () => {
    const report = geoReportFor();
    expect(report.drift.status).toBe("no_baseline");
    expect(report.snapshot.citabilityScore).toBe(report.citability.score);
  });

  it("fails when citability drops past the threshold", () => {
    const baseline = geoReportFor().snapshot;
    const current = { ...baseline, citabilityScore: baseline.citabilityScore - 12, capturedAt: "2026-11-20T00:00:00.000Z" };
    const drift = diffGeoSnapshots(baseline, current, { failThreshold: 5 });
    expect(drift.status).toBe("fail");
    expect(drift.regressions.join(" ")).toMatch(/Citability dropped 12/);
  });

  it("passes a small change and fails when a crawler becomes blocked", () => {
    const baseline = geoReportFor().snapshot;
    const current = {
      ...baseline,
      citabilityScore: baseline.citabilityScore - 2,
      capturedAt: "2026-11-20T00:00:00.000Z",
      blockedBots: ["GPTBot"],
    };
    const drift = diffGeoSnapshots(baseline, current, { failThreshold: 5 });
    expect(drift.status).toBe("fail");
    expect(drift.regressions.join(" ")).toMatch(/Newly blocked/);
  });
});

describe("collectGeoAudit", () => {
  it("emits reviewable issues and provenance labels", () => {
    const report = collectGeoAudit({
      url: "https://example.com/",
      domain: "example.com",
      snapshot: snapshot(),
      robots: {
        url: "https://example.com/robots.txt",
        statusCode: 200,
        text: "User-agent: GPTBot\nDisallow: /\n",
      },
      llms: { url: "https://example.com/llms.txt", statusCode: 404 },
    });
    expect(report.provenance.measured).toContain("aiCrawlers (robots.txt user-agent groups for AI crawlers)");
    expect(report.provenance.estimated.join(" ")).toMatch(/citability/);
    expect(report.issues.find((i) => i.id === "geo-llms-txt-missing")).toBeTruthy();
    expect(report.issues.find((i) => i.id === "geo-ai-crawlers-blocked")?.severity).toBe("high");
    expect(report.snapshot.llmsTxtStatus).toBe("absent");
    expect(report.snapshot.blockedBots).toContain("GPTBot");
  });
});
