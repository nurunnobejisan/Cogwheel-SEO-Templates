import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { metadata as homeMeta } from "../src/app/page";
import sitemap from "../src/app/sitemap";
import { metadata as extensionMeta } from "../src/app/extension/page";
import { isMainTab, MAIN_TAB_IDS } from "../src/config/main-tabs";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("crawlable ?tab= navigation", () => {
  it("validates tab ids", () => {
    for (const id of MAIN_TAB_IDS) expect(isMainTab(id)).toBe(true);
    for (const bad of ["", "unknown", 1, undefined, ["home", "tasks"]]) {
      expect(isMainTab(bad)).toBe(false);
    }
  });

  it("reads and validates searchParams before choosing the initial tab", () => {
    const home = source("src/app/page.tsx");
    expect(home).toContain("searchParams?: { tab?: string | string[] }");
    expect(home).toContain("isMainTab(rawTab) ? rawTab : \"home\"");
    expect(source("src/components/PropertyDashboard.tsx")).toContain("useState<MainTab>(initialTab)");
  });

  it("renders real anchors and canonicalises the variants to /", () => {
    expect(homeMeta.alternates?.canonical).toBe("/");
    const dashboard = source("src/components/PropertyDashboard.tsx");
    expect(dashboard).toContain('href={`/?tab=${tab.id}`}');
    expect(dashboard).toContain("aria-current=");
  });
});

describe("pre-paint theme and tap targets", () => {
  it("applies the saved theme before paint and marks the html element", () => {
    const layout = source("src/app/layout.tsx");
    expect(layout).toContain("suppressHydrationWarning");
    expect(layout).toContain('localStorage.getItem("seo_studio_theme")');
    expect(layout).toContain('matchMedia("(prefers-color-scheme: dark)")');
  });

  it("keeps primary controls at least 44px tall", () => {
    const dashboard = source("src/components/PropertyDashboard.tsx");
    expect(dashboard).toContain("h-11 w-11 items-center justify-center rounded-lg border");
    expect(dashboard.match(/min-h-11 items-center/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source("src/components/SiteFooter.tsx")).toContain("inline-flex min-h-11 items-center");
  });
});

describe("extension install page and empty state", () => {
  it("reuses existing install wording and is in the sitemap", () => {
    const page = source("src/app/extension/page.tsx");
    expect(page).toContain("chrome://extensions");
    expect(page).toContain("Developer mode");
    expect(page).toContain("Load unpacked");
    expect(page).toContain("chrome-extension/dist");
    expect(page).toContain('href="/seo-studio.zip"');
    expect(extensionMeta.alternates?.canonical).toBe("/extension");
    expect(sitemap().some((entry) => entry.url === "https://seo-studio.vercel.app/extension")).toBe(true);
  });

  it("shows an empty state when the template filters match nothing", () => {
    expect(source("src/app/templates/TemplatesHubClient.tsx")).toContain("filteredTemplates.length === 0");
    expect(source("src/app/templates/TemplatesHubClient.tsx")).toContain("No Data");
  });
});
