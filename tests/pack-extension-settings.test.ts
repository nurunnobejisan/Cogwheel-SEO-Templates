/**
 * Tasks 2.4 / 3.2 — extension pack selection and pack-weighted composite.
 *
 * Locks:
 *  - activePack lives in ExtensionOptions, defaults to the catalog's default,
 *    and back-compat-merges for settings stored before the field existed
 *  - resolveScoringWeights always returns catalog weights (never invented)
 *  - calculateSeoScores composites with the weights it is given
 *  - classifyPageTypeForAudit maps the DOM audit payload onto the shared
 *    rule-based classifier (page-type confidence pill)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  loadExtensionOptions,
} from "../chrome-extension/src/utils/extensionOptions";
import {
  resolveScoringWeights,
  getActivePackId,
  getActiveScoringWeights,
} from "../chrome-extension/src/utils/activePack";
import {
  calculateSeoScores,
  DEFAULT_COMPOSITE_WEIGHTS,
  SEO_STUDIO_OPTIMAL_AUDIT_DATA,
} from "../chrome-extension/src/data/seoStudioTemplates";
import { classifyPageTypeForAudit } from "../chrome-extension/src/utils/pageTypeClassification";
import { PACK_CATALOG, DEFAULT_PACK_ID, getPackMeta } from "../src/packs/catalog";
import otaConfig from "../data/ota-config.json";

vi.mock("../chrome-extension/src/utils/extensionOptions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../chrome-extension/src/utils/extensionOptions")>();
  return { ...actual, loadExtensionOptions: vi.fn() };
});

afterEach(() => {
  vi.mocked(loadExtensionOptions).mockReset();
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe("Task 2.4 — activePack in ExtensionOptions", () => {
  it("defaults to the catalog's default pack", () => {
    expect(DEFAULT_OPTIONS.activePack).toBe(DEFAULT_PACK_ID);
    expect(DEFAULT_PACK_ID).toBe("hotel");
  });

  it("reads a stored pack and validates it against the catalog", async () => {
    vi.mocked(loadExtensionOptions).mockResolvedValue({
      ...DEFAULT_OPTIONS,
      activePack: "ecommerce",
    });
    expect(await getActivePackId()).toBe("ecommerce");
    expect(await getActiveScoringWeights()).toEqual(
      getPackMeta("ecommerce")?.scoringWeights
    );
  });

  it("falls back to the default pack for unknown stored ids", async () => {
    vi.mocked(loadExtensionOptions).mockResolvedValue({
      ...DEFAULT_OPTIONS,
      activePack: "not-a-real-pack",
    });
    expect(await getActivePackId()).toBe(DEFAULT_PACK_ID);
    expect(await getActiveScoringWeights()).toEqual(
      getPackMeta(DEFAULT_PACK_ID)?.scoringWeights
    );
  });

  it("back-compat: stored settings without activePack merge to the default", async () => {
    const real =
      await vi.importActual<typeof import("../chrome-extension/src/utils/extensionOptions")>(
        "../chrome-extension/src/utils/extensionOptions"
      );

    // Simulate sync storage written before Phase C (no activePack field).
    const storedOptions = {
      consent: true,
      captureMode: "auto",
      allowlistDomains: ["example.com"],
      blocklistDomains: [],
      blocklistPaths: [],
      apiUrl: "https://example.com/api",
      apiToken: "",
    };
    const g = globalThis as { chrome?: unknown };
    const captured: Array<Record<string, unknown>> = [];
    g.chrome = {
      runtime: { lastError: null },
      storage: {
        sync: {
          get: (key: string, cb: (res: Record<string, unknown>) => void) =>
            cb({ [key]: storedOptions }),
          set: (items: Record<string, unknown>, cb: () => void) => {
            captured.push(items);
            cb();
          },
        },
      },
    };

    const merged = await real.loadExtensionOptions();
    expect(merged.activePack).toBe(DEFAULT_PACK_ID);
    expect(merged.consent).toBe(true); // stored value preserved
    expect(merged.allowlistDomains).toEqual(["example.com"]);

    // …and a pack selection round-trips into storage.
    await real.saveExtensionOptions({ ...merged, activePack: "saas" });
    const key = "seo_studio_extension_options_v1";
    expect(captured[0]?.[key]).toMatchObject({ activePack: "saas" });
  });
});

describe("Task 3.2 — pack-weighted composite", () => {
  it("default weights are the hotel pack's weights from data/ota-config.json", () => {
    expect(DEFAULT_COMPOSITE_WEIGHTS).toEqual(otaConfig.scoringWeights);
    expect(DEFAULT_COMPOSITE_WEIGHTS).toEqual(getPackMeta("hotel")?.scoringWeights);
  });

  it("resolveScoringWeights serves every catalog pack and never invents values", () => {
    for (const meta of PACK_CATALOG) {
      const weights = resolveScoringWeights(meta.id);
      expect(weights).toEqual(meta.scoringWeights);
      expect(weights.onPage + weights.schema + weights.geoAi).toBeCloseTo(1, 5);
    }
    // Unknown id → default pack weights, not a fabricated triple.
    expect(resolveScoringWeights("nope")).toEqual(
      resolveScoringWeights(DEFAULT_PACK_ID)
    );
  });

  it("composites exactly with the weights it is given", () => {
    const data = SEO_STUDIO_OPTIMAL_AUDIT_DATA;
    const base = calculateSeoScores(data);

    // Default path = documented 35/35/30 formula.
    expect(base.overall).toBe(
      Math.round(
        base.onPage * 0.35 + base.schemaTechnical * 0.35 + base.geoAiReadiness * 0.3
      )
    );

    // Isolating each pillar proves the weights are actually applied.
    expect(
      calculateSeoScores(data, { onPage: 1, schema: 0, geoAi: 0 }).overall
    ).toBe(base.onPage);
    expect(
      calculateSeoScores(data, { onPage: 0, schema: 1, geoAi: 0 }).overall
    ).toBe(base.schemaTechnical);
    expect(
      calculateSeoScores(data, { onPage: 0, schema: 0, geoAi: 1 }).overall
    ).toBe(base.geoAiReadiness);

    // A different pack's weights shift the composite (ecommerce: 35/40/25).
    const ecommerce = calculateSeoScores(data, resolveScoringWeights("ecommerce"));
    expect(ecommerce.overall).toBe(
      Math.round(
        base.onPage * 0.35 + base.schemaTechnical * 0.4 + base.geoAiReadiness * 0.25
      )
    );
  });
});

describe("Task 3.2 — page-type classification from the audit payload", () => {
  const baseAudit = {
    url: "https://example.com/",
    hostname: "example.com",
    title: "Example",
    metaDesc: "",
    canonical: "",
    words: 400,
    schemas: [] as Array<Record<string, unknown>>,
    hasViewport: true,
  };

  it("classifies a root page with Organization JSON-LD as home", () => {
    const result = classifyPageTypeForAudit(
      { ...baseAudit, schemas: [{ "@type": "Organization", name: "Example" }] },
      { textContent: "welcome" }
    );
    expect(result.pageType).toBe("home");
    expect(result.confidence).toBeGreaterThan(50);
    expect(result.signals).toContain("home: root path");
  });

  it("classifies a booking flow via DOM reservation signals", () => {
    const result = classifyPageTypeForAudit(
      { ...baseAudit, url: "https://example.com/book/ocean-suite" },
      { textContent: "choose your dates", reservationWidgets: true }
    );
    expect(result.pageType).toBe("booking");
    expect(result.confidence).toBe(100);
    expect(result.signals).toContain("booking: reservation widget in DOM");
  });

  it("reports other/0 when nothing matches — no signal is not a guess", () => {
    const result = classifyPageTypeForAudit(
      { ...baseAudit, url: "https://example.com/x" },
      { textContent: "" }
    );
    expect(result.pageType).toBe("other");
    expect(result.confidence).toBe(0);
  });

  it("maps JSON-LD @type arrays from the audit payload", () => {
    const result = classifyPageTypeForAudit(
      {
        ...baseAudit,
        url: "https://shop.example.com/product/blue-runner",
        schemas: [{ "@type": ["Product", "Brand"] }],
      },
      { textContent: "add to cart" }
    );
    expect(result.pageType).toBe("product");
    expect(result.confidence).toBeGreaterThan(50);
  });
});
