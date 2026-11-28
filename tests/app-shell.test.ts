import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveBreadcrumbs, resolveSectionFromPath, NAV_SECTIONS } from "../src/components/shell/nav-config";
import { SiteFooter } from "../src/components/SiteFooter";
import { TooltipProvider } from "../src/components/ui/tooltip";

describe("Phase 1 — AppShell routing, breadcrumbs, and public footer", () => {
  it("resolves section IDs and breadcrumbs for every top-level route", () => {
    expect(resolveSectionFromPath("/")).toBe("dashboard");
    expect(resolveSectionFromPath("/audit/issues")).toBe("audit");
    expect(resolveSectionFromPath("/search-console")).toBe("audit");
    expect(resolveSectionFromPath("/keywords/matrix")).toBe("keywords");
    expect(resolveSectionFromPath("/content")).toBe("keywords");
    expect(resolveSectionFromPath("/geo/compset")).toBe("geo");
    expect(resolveSectionFromPath("/tasks")).toBe("tasks");
    expect(resolveSectionFromPath("/reports/pptx")).toBe("reports");
    expect(resolveSectionFromPath("/settings/ai-training")).toBe("settings");

    expect(resolveBreadcrumbs("/audit/issues").map((b) => b.label)).toEqual([
      "Website Audit",
      "Issue Report",
    ]);
    expect(resolveBreadcrumbs("/reports/memo").map((b) => b.label)).toEqual([
      "Reports",
      "MEMO",
    ]);
  });

  it("includes every main rail section", () => {
    expect(NAV_SECTIONS.map((s) => s.id)).toEqual([
      "dashboard",
      "audit",
      "keywords",
      "geo",
      "tasks",
      "reports",
      "settings",
    ]);
  });

  it("renders unified public footer with single product name and owner credit", () => {
    const html = renderToStaticMarkup(
      createElement(TooltipProvider, null, createElement(SiteFooter))
    );
    expect(html).toContain("SEO &amp; GEO Studio");
    expect(html).toContain("Nurunnobe Jisan");
    expect(html).not.toContain(">SJ<");
  });
});
