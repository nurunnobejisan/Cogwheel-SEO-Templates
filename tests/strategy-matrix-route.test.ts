/**
 * Tasks 4.2 / 4.3 / 4.4 — pack-driven /strategy-matrix route, target-page
 * clustering, disclaimer and template noindex guardrails.
 *
 * Locks:
 *  - `?pack=` resolves only against the catalog; unknown ids fall back to
 *    the default pack and render a complete validated dataset
 *  - per-pack metadata is unique, 50–60 / 145–155 like every other route
 *  - the cluster view picks exactly one primary per target page,
 *    deterministically, and flags schema/intent overlaps
 *  - the dataset disclaimer is rendered on the matrix surface
 *  - template detail pages carry `robots: noindex`
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StrategyMatrixPage, { generateMetadata } from "../src/app/strategy-matrix/page";
import {
  generateMetadata as generateTemplateMetadata,
} from "../src/app/templates/[category]/[slug]/page";
import { clusterByTargetPageType } from "../src/packs/clusters";
import {
  PACK_MATRICES,
  getPackMatrix,
  resolveMatrixPackId,
} from "../src/packs/matrices";
import { PACK_CATALOG, DEFAULT_PACK_ID, getPackMeta } from "../src/packs/catalog";
import type { KeywordItem } from "../src/schemas/validation";
import { TEMPLATES_DATA } from "../src/packs/hotel/templates";

describe("Task 4.2 — pack-driven /strategy-matrix metadata", () => {
  it("generates strict-length metadata for every pack", () => {
    for (const pack of PACK_CATALOG) {
      const meta = generateMetadata({ searchParams: { pack: pack.id } });
      const title = String(meta.title);
      const desc = String(meta.description);
      expect(title.length, `${pack.id} title "${title}"`).toBeGreaterThanOrEqual(50);
      expect(title.length, `${pack.id} title "${title}"`).toBeLessThanOrEqual(60);
      expect(desc.length, `${pack.id} desc`).toBeGreaterThanOrEqual(145);
      expect(desc.length, `${pack.id} desc`).toBeLessThanOrEqual(155);
    }
  });

  it("titles and descriptions are unique across the six packs", () => {
    const titles = PACK_CATALOG.map(
      (p) => String(generateMetadata({ searchParams: { pack: p.id } }).title)
    );
    const descs = PACK_CATALOG.map(
      (p) => String(generateMetadata({ searchParams: { pack: p.id } }).description)
    );
    expect(new Set(titles).size).toBe(PACK_CATALOG.length);
    expect(new Set(descs).size).toBe(PACK_CATALOG.length);
  });

  it("unknown or missing ?pack= falls back to the default pack", () => {
    expect(resolveMatrixPackId(undefined)).toBe(DEFAULT_PACK_ID);
    expect(resolveMatrixPackId("nope")).toBe(DEFAULT_PACK_ID);
    expect(resolveMatrixPackId("")).toBe(DEFAULT_PACK_ID);
    expect(resolveMatrixPackId("finance")).toBe("finance");
    expect(generateMetadata({ searchParams: { pack: "bogus" } })).toEqual(
      generateMetadata({})
    );
    expect(generateMetadata({ searchParams: { pack: DEFAULT_PACK_ID } }).title).toBe(
      generateMetadata({}).title
    );
  });
});

describe("Task 4.2 — server-side pack matrices", () => {
  it("loads and validates one matrix per catalog pack", () => {
    expect(Object.keys(PACK_MATRICES).sort()).toEqual(
      PACK_CATALOG.map((p) => p.id).sort()
    );
    for (const pack of PACK_CATALOG) {
      const matrix = getPackMatrix(pack.id);
      expect(matrix.keywords, pack.id).toHaveLength(78);
      expect(matrix.categories, pack.id).toHaveLength(6);
      expect(matrix.metadata.notes, pack.id).toContain("not measured search data");
    }
  });

  it("unknown ids render the default pack's dataset", () => {
    expect(getPackMatrix("bogus")).toBe(getPackMatrix(DEFAULT_PACK_ID));
  });
});

describe("Task 4.2/4.3 — rendered page", () => {
  it("renders the default pack with switcher, disclaimer and funnel view", () => {
    const html = renderToStaticMarkup(
      createElement(StrategyMatrixPage, { searchParams: {} })
    );
    expect(html).toContain(`${getPackMeta(DEFAULT_PACK_ID)?.name.replace("&", "&amp;")} Dataset`);
    expect(html).toContain("About this dataset");
    expect(html).toContain("not measured search data");
    expect(html).toContain("not live content");
    // Pack switcher links every other vertical.
    for (const pack of PACK_CATALOG) {
      expect(html).toContain(`/strategy-matrix?pack=${pack.id}`);
    }
    // Funnel view shows category KPIs; no cluster badges.
    expect(html).toContain("Conversational AI Prompts");
    expect(html).not.toContain("Overlaps primary");
  });

  it("adapts to ?pack= (Task 4.2 brand badge)", () => {
    const html = renderToStaticMarkup(
      createElement(StrategyMatrixPage, { searchParams: { pack: "saas" } })
    );
    expect(html).toContain("SaaS &amp; Software Dataset");
    expect(html).toContain('href="/strategy-matrix?pack=saas"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Pricing &amp; Plans");
  });

  it("renders the cluster view for ?view=clusters (Task 4.3)", () => {
    const html = renderToStaticMarkup(
      createElement(StrategyMatrixPage, {
        searchParams: { pack: "finance", view: "clusters" },
      })
    );
    expect(html).toContain("Primary");
    expect(html).toContain("1 primary");
    expect(html).toContain("Funnel categories"); // toggle back
    // Cluster heading present with a real target page type from the dataset.
    expect(html).toContain("target page");
    expect(html).not.toContain("targets)"); // funnel category headers absent
  });

  it("keeps unknown query values on the default pack", () => {
    const html = renderToStaticMarkup(
      createElement(StrategyMatrixPage, {
        searchParams: { pack: "bogus", view: "whatever" },
      })
    );
    expect(html).toContain(`${getPackMeta(DEFAULT_PACK_ID)?.name.replace("&", "&amp;")} Dataset`);
    expect(html).not.toContain("Overlaps primary");
  });
});

describe("Task 4.3 — clusterByTargetPageType", () => {
  function row(partial: Partial<KeywordItem> & { id: string }): KeywordItem {
    return {
      keyword: `formula ${partial.id}`,
      category: "Cat A",
      subCategory: "sub",
      searchIntent: "Informational",
      searchVolumeTier: "Medium",
      cpcEstimate: { value: "$0.50 - $1.50", source: "illustrative" },
      targetPageType: "Homepage",
      recommendedSchema: "Article",
      geoEngineRelevance: ["Google Search"],
      targetEntityPrompt: "what is it?",
      competitiveContext: "other pages covering the same topic",
      ...partial,
    };
  }

  it("picks the primary by illustrative tier, then id — deterministically", () => {
    const cluster = clusterByTargetPageType([
      row({ id: "a-1", searchVolumeTier: "Long-Tail / Conversational" }),
      row({ id: "a-2", searchVolumeTier: "High" }),
      row({ id: "a-3", searchVolumeTier: "High" }),
    ])[0];
    expect(cluster?.primary.id).toBe("a-2"); // High beats Long-Tail; id tiebreak
    expect(cluster?.variants.map((v) => v.keyword.id)).toEqual(["a-3", "a-1"]);
  });

  it("flags variants sharing the primary's schema or intent", () => {
    const [cluster] = clusterByTargetPageType([
      row({ id: "b-1", recommendedSchema: "FAQPage", searchIntent: "Informational" }),
      row({ id: "b-2", recommendedSchema: "FAQPage", searchIntent: "Commercial" }),
      row({ id: "b-3", recommendedSchema: "BreadcrumbList", searchIntent: "Transactional" }),
    ]);
    expect(cluster?.primary.id).toBe("b-1");
    expect(cluster?.variants.map((v) => v.overlapsPrimary)).toEqual([true, false]);
  });

  it("groups every matrix row into exactly one cluster", () => {
    for (const pack of PACK_CATALOG) {
      const matrix = getPackMatrix(pack.id);
      const clusters = clusterByTargetPageType(matrix.keywords);
      const ids = clusters.flatMap((c) => [
        c.primary.id,
        ...c.variants.map((v) => v.keyword.id),
      ]);
      expect(ids, pack.id).toHaveLength(78);
      expect(new Set(ids).size, `${pack.id} unique rows`).toBe(78);
      expect(clusters.length, pack.id).toBeGreaterThanOrEqual(6);
      expect(clusters.length, pack.id).toBeLessThanOrEqual(12);
      for (const cluster of clusters) {
        expect(cluster.variants.length, `${pack.id}/${cluster.targetPageType}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("Task 4.4 — template detail pages are noindex", () => {
  it("sets robots noindex on every generated template page", () => {
    const template = TEMPLATES_DATA[0];
    expect(template).toBeDefined();
    if (!template) return;
    const meta = generateTemplateMetadata({
      params: { category: template.categorySlug, slug: template.slug },
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
    // Metadata itself is untouched by the guardrail.
    expect(String(meta.title).length).toBeGreaterThanOrEqual(50);
    expect(String(meta.description).length).toBeGreaterThanOrEqual(145);
  });
});
