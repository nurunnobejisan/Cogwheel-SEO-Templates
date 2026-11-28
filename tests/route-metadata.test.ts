import { describe, it, expect } from "vitest";
import { metadata as homeMeta } from "../src/app/(app)/page";
import { metadata as templatesMeta } from "../src/app/(public)/templates/page";
import { generateMetadata as generateMatrixMetadata } from "../src/app/(public)/strategy-matrix/page";
import { metadata as archMeta } from "../src/app/(public)/architecture/page";
import { TEMPLATES_DATA } from "../src/packs/hotel/templates";
import { PACK_CATALOG } from "../src/packs/catalog";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

describe("GEMINI.md Rules Enforcement — Route Metadata & SEO Standards", () => {
  const routes = [
    { route: "/", meta: homeMeta, name: "Home Dashboard" },
    { route: "/templates", meta: templatesMeta, name: "Templates Catalog" },
    { route: "/architecture", meta: archMeta, name: "System Architecture" },
    // Task 4.2: /strategy-matrix metadata is generated per pack — every
    // vertical must satisfy the same title/description rules as static routes.
    ...PACK_CATALOG.map((pack) => ({
      route: `/strategy-matrix?pack=${pack.id}`,
      meta: generateMatrixMetadata({ searchParams: { pack: pack.id } }),
      name: `${pack.name} Strategy Matrix`,
    })),
  ];

  it("enforces unique meta titles on all routes", () => {
    const titles = routes.map((r) => String(r.meta.title));
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(routes.length);
  });

  it("enforces strict meta title length between 50 and 60 characters", () => {
    routes.forEach((r) => {
      const title = String(r.meta.title);
      expect(
        title.length,
        `Route ${r.route} title "${title}" (${title.length} chars) must be 50-60 chars`
      ).toBeGreaterThanOrEqual(50);
      expect(
        title.length,
        `Route ${r.route} title "${title}" (${title.length} chars) must be 50-60 chars`
      ).toBeLessThanOrEqual(60);
    });
  });

  it("enforces unique meta descriptions on all routes", () => {
    const descriptions = routes.map((r) => String(r.meta.description));
    const uniqueDesc = new Set(descriptions);
    expect(uniqueDesc.size).toBe(routes.length);
  });

  it("enforces strict meta description length between 145 and 155 characters", () => {
    routes.forEach((r) => {
      const desc = String(r.meta.description);
      expect(
        desc.length,
        `Route ${r.route} description "${desc}" (${desc.length} chars) must be 145-155 chars`
      ).toBeGreaterThanOrEqual(145);
      expect(
        desc.length,
        `Route ${r.route} description "${desc}" (${desc.length} chars) must be 145-155 chars`
      ).toBeLessThanOrEqual(155);
    });
  });

  it("validates all 12 templates have strict 50-60 char titles and 145-155 char descriptions", () => {
    expect(TEMPLATES_DATA.length).toBe(12);
    TEMPLATES_DATA.forEach((tmpl) => {
      expect(
        tmpl.metaTitle.length,
        `Template ${tmpl.slug} title "${tmpl.metaTitle}" (${tmpl.metaTitle.length} chars) must be 50-60 chars`
      ).toBeGreaterThanOrEqual(50);
      expect(
        tmpl.metaTitle.length,
        `Template ${tmpl.slug} title "${tmpl.metaTitle}" (${tmpl.metaTitle.length} chars) must be 50-60 chars`
      ).toBeLessThanOrEqual(60);

      expect(
        tmpl.metaDescription.length,
        `Template ${tmpl.slug} desc "${tmpl.metaDescription}" (${tmpl.metaDescription.length} chars) must be 145-155 chars`
      ).toBeGreaterThanOrEqual(145);
      expect(
        tmpl.metaDescription.length,
        `Template ${tmpl.slug} desc "${tmpl.metaDescription}" (${tmpl.metaDescription.length} chars) must be 145-155 chars`
      ).toBeLessThanOrEqual(155);

      // Verify direct answer is 40-70 words
      const wordCount = tmpl.directAnswer.trim().split(/\s+/).length;
      expect(
        wordCount,
        `Template ${tmpl.slug} direct answer (${wordCount} words) must be around 45-60 words`
      ).toBeGreaterThanOrEqual(35);
      expect(
        wordCount,
        `Template ${tmpl.slug} direct answer (${wordCount} words) must be around 45-60 words`
      ).toBeLessThanOrEqual(75);
    });
  });

  it("generates valid sitemap covering all routes", () => {
    const sitemapEntries = sitemap();
    expect(sitemapEntries.length).toBe(16);
    const urls = sitemapEntries.map((e) => e.url);
    expect(urls).toContain("https://seo-studio-one.vercel.app");
    expect(urls).toContain("https://seo-studio-one.vercel.app/templates");
    expect(urls).toContain("https://seo-studio-one.vercel.app/strategy-matrix");
    expect(urls).toContain("https://seo-studio-one.vercel.app/architecture");

    // All 12 templates must be represented
    TEMPLATES_DATA.forEach((tmpl) => {
      expect(urls).toContain(
        `https://seo-studio-one.vercel.app/templates/${tmpl.categorySlug}/${tmpl.slug}`
      );
    });
  });

  it("generates valid robots.txt rules", () => {
    const robotsRules = robots();
    expect(robotsRules.rules).toBeDefined();
    expect(robotsRules.sitemap).toBe("https://seo-studio-one.vercel.app/sitemap.xml");
  });
});
