import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isUrlAllowedByRobots,
  matchesIncludeExclude,
  normalizeCrawlUrl,
  parseHtmlPage,
  parseRobotsTxt,
  parseSitemapXml,
  type CrawlPageRecord,
} from "@/core/crawler";
import { computeSiteSummary, evaluatePageIssues } from "@/tasks/site-crawl/validator";

const FIXTURE_DIR = path.resolve(__dirname, "fixtures/crawl");
const readFixture = (name: string) => fs.readFileSync(path.join(FIXTURE_DIR, name), "utf-8");

describe("Site Crawl core primitives", () => {
  it("normalizes URLs (strips fragments, tracking params, trailing slash, enforces same host)", () => {
    const base = "https://hotelx.example.com/rooms";
    expect(normalizeCrawlUrl("/dining/?utm_source=google&fbclid=123#menu", base)).toBe(
      "https://hotelx.example.com/dining",
    );
    expect(normalizeCrawlUrl("https://www.hotelx.example.com/suites/?page=2&gclid=abc", base)).toBe(
      "https://www.hotelx.example.com/suites?page=2",
    );
    expect(normalizeCrawlUrl("https://external.com/other", base, true)).toBeNull();
    expect(normalizeCrawlUrl("mailto:info@hotelx.example.com", base, true)).toBeNull();
  });

  it("respects include and exclude path patterns", () => {
    expect(matchesIncludeExclude("https://hotelx.example.com/rooms/king", ["/rooms"], ["/admin"])).toBe(true);
    expect(matchesIncludeExclude("https://hotelx.example.com/admin/login", [], ["/admin"])).toBe(false);
    expect(matchesIncludeExclude("https://hotelx.example.com/dining", ["/rooms"], [])).toBe(false);
  });

  it("parses robots.txt rules and enforces Allow/Disallow", () => {
    const rules = parseRobotsTxt(`
      User-agent: *
      Disallow: /admin/
      Disallow: /private
      Allow: /private/public-page
      Sitemap: https://hotelx.example.com/sitemap.xml
    `);
    expect(rules.sitemaps).toEqual(["https://hotelx.example.com/sitemap.xml"]);
    expect(isUrlAllowedByRobots("https://hotelx.example.com/rooms", rules)).toBe(true);
    expect(isUrlAllowedByRobots("https://hotelx.example.com/admin/settings", rules)).toBe(false);
    expect(isUrlAllowedByRobots("https://hotelx.example.com/private/secret", rules)).toBe(false);
    expect(isUrlAllowedByRobots("https://hotelx.example.com/private/public-page", rules)).toBe(true);
  });

  it("parses sitemap.xml and sitemap_index.xml", () => {
    const sm = parseSitemapXml(`
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://hotelx.example.com/</loc></url>
        <url><loc>https://hotelx.example.com/rooms</loc></url>
      </urlset>
    `);
    expect(sm.isIndex).toBe(false);
    expect(sm.locs).toEqual(["https://hotelx.example.com/", "https://hotelx.example.com/rooms"]);

    const idx = parseSitemapXml(`
      <sitemapindex>
        <sitemap><loc>https://hotelx.example.com/sitemap-pages.xml</loc></sitemap>
      </sitemapindex>
    `);
    expect(idx.isIndex).toBe(true);
    expect(idx.locs).toEqual(["https://hotelx.example.com/sitemap-pages.xml"]);
  });

  it("extracts full page data and flags issues across HTML fixtures", () => {
    const clean = parseHtmlPage(readFixture("clean.html"), "https://hotelx.example.com/");
    expect(clean.title).toBe("Hotel X Gainesville | Boutique Hotel Near UF Campus");
    expect(clean.canonical).toBe("https://hotelx.example.com/");
    expect(clean.robotsMeta).toBe("index, follow");
    expect(clean.h1H6).toEqual([
      { level: 1, text: "Boutique Hotel in Gainesville, FL" },
      { level: 2, text: "Rooftop Dining & Pool" },
    ]);
    expect(clean.images[0]).toEqual({
      src: "https://hotelx.example.com/images/lobby.jpg",
      alt: "Hotel X Gainesville lobby",
      width: 1200,
      height: 800,
      fileSize: 145000,
    });
    expect(clean.internalLinks).toEqual([
      "https://hotelx.example.com/rooms",
      "https://hotelx.example.com/dining",
    ]);
    expect(clean.externalLinks).toEqual(["https://visitgainesville.com/things-to-do"]);
    expect(clean.hreflang).toEqual([{ lang: "en-us", href: "https://hotelx.example.com/" }]);
    expect(clean.jsonLd).toHaveLength(1);
    expect(clean.openGraph["og:type"]).toBe("hotel");
    expect(clean.needsJsRendering).toBe(false);

    const missingTitle = parseHtmlPage(readFixture("missing-title.html"), "https://hotelx.example.com/suites");
    const missingTitleIssues = evaluatePageIssues({
      crawlRunId: "r1",
      url: "https://hotelx.example.com/suites",
      finalUrl: "https://hotelx.example.com/suites",
      statusCode: 200,
      redirectChain: [],
      ...missingTitle,
      responseTimeMs: 50,
      depth: 1,
      inSitemap: true,
      crawledAt: new Date().toISOString(),
    });
    expect(missingTitleIssues.some((i) => i.code === "missing-title")).toBe(true);

    const dupH1 = parseHtmlPage(readFixture("duplicate-h1.html"), "https://hotelx.example.com/dining");
    const dupH1Issues = evaluatePageIssues({
      crawlRunId: "r1",
      url: "https://hotelx.example.com/dining",
      finalUrl: "https://hotelx.example.com/dining",
      statusCode: 200,
      redirectChain: [],
      ...dupH1,
      responseTimeMs: 50,
      depth: 1,
      inSitemap: true,
      crawledAt: new Date().toISOString(),
    });
    expect(dupH1Issues.some((i) => i.code === "duplicate-h1")).toBe(true);

    const missingAlt = parseHtmlPage(readFixture("missing-alt.html"), "https://hotelx.example.com/gallery");
    const missingAltIssues = evaluatePageIssues({
      crawlRunId: "r1",
      url: "https://hotelx.example.com/gallery",
      finalUrl: "https://hotelx.example.com/gallery",
      statusCode: 200,
      redirectChain: [],
      ...missingAlt,
      responseTimeMs: 50,
      depth: 1,
      inSitemap: true,
      crawledAt: new Date().toISOString(),
    });
    expect(missingAltIssues.some((i) => i.code === "images-missing-alt")).toBe(true);

    const jsOnly = parseHtmlPage(readFixture("js-only.html"), "https://hotelx.example.com/app");
    expect(jsOnly.needsJsRendering).toBe(true);
  });

  it("computes orphan pages, broken links, redirect chains, and missing-from-sitemap", () => {
    const basePage = (url: string, overrides: Partial<CrawlPageRecord>): CrawlPageRecord => ({
      crawlRunId: "r1",
      url,
      finalUrl: url,
      statusCode: 200,
      redirectChain: [],
      canonical: url,
      robotsMeta: null,
      title: "Page",
      metaDescription: "Desc",
      h1H6: [{ level: 1, text: "H1" }],
      wordCount: 100,
      contentHash: "hash",
      images: [],
      internalLinks: [],
      externalLinks: [],
      hreflang: [],
      jsonLd: [],
      openGraph: {},
      responseTimeMs: 40,
      depth: 0,
      inSitemap: true,
      needsJsRendering: false,
      issues: [],
      crawledAt: new Date().toISOString(),
      ...overrides,
    });

    const pages: CrawlPageRecord[] = [
      basePage("https://hotelx.example.com/", {
        internalLinks: ["https://hotelx.example.com/rooms", "https://hotelx.example.com/broken"],
      }),
      basePage("https://hotelx.example.com/rooms", {
        inSitemap: true,
        redirectChain: [{ url: "https://hotelx.example.com/rooms", statusCode: 301 }],
        finalUrl: "https://hotelx.example.com/guest-rooms",
      }),
      basePage("https://hotelx.example.com/orphan", { inSitemap: true }),
      basePage("https://hotelx.example.com/hidden-gem", { inSitemap: false }),
      basePage("https://hotelx.example.com/broken", {
        statusCode: 404,
        inSitemap: false,
        issues: [{ code: "broken-status", message: "HTTP 404", severity: "error" }],
      }),
    ];

    const summary = computeSiteSummary({
      pages,
      sitemapUrls: [
        "https://hotelx.example.com/",
        "https://hotelx.example.com/rooms",
        "https://hotelx.example.com/orphan",
      ],
      sitemapStatuses: [{ url: "https://hotelx.example.com/sitemap.xml", status: 200, urlCount: 3 }],
      robotsTxtPresent: true,
      startUrl: "https://hotelx.example.com/",
    });

    expect(summary.orphanPages).toEqual(["https://hotelx.example.com/orphan"]);
    expect(summary.missingFromSitemap).toEqual(["https://hotelx.example.com/hidden-gem"]);
    expect(summary.brokenLinks).toEqual([
      { url: "https://hotelx.example.com/broken", statusCode: 404, foundOn: ["https://hotelx.example.com/"] },
    ]);
    expect(summary.redirectChains).toHaveLength(1);
  });
});

