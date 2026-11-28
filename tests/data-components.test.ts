import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DeltaBadge,
  EmptyState,
  FilterTabs,
  InlineAlert,
  IssueTable,
  KpiTile,
  MetricRow,
  PageHeader,
  ScoreRing,
  StatusIcon,
  VitalsBar,
} from "../src/components/data/index";

describe("Phase 2 — Data & Telemetry components", () => {
  it("renders DeltaBadge with meaning-driven colors via goodWhen", () => {
    const downIsGood = renderToStaticMarkup(createElement(DeltaBadge, { value: -5, goodWhen: "down" }));
    const upIsBad = renderToStaticMarkup(createElement(DeltaBadge, { value: 5, goodWhen: "down" }));
    expect(downIsGood).toContain("bg-success-soft");
    expect(downIsGood).toContain("▼ 5");
    expect(upIsBad).toContain("bg-error-soft");
    expect(upIsBad).toContain("▲ 5");
  });

  it("renders KpiTile with honest unmeasured fallback instead of 0", () => {
    const html = renderToStaticMarkup(createElement(KpiTile, { label: "Organic Clicks", value: null }));
    expect(html).toContain("—");
    expect(html).toContain("Not measured");
    expect(html).not.toContain(">0<");
  });

  it("renders ScoreRing, MetricRow, FilterTabs, VitalsBar, and PageHeader", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(PageHeader, { title: "Website Audit", description: "11-dimension diagnostics" }),
        createElement(ScoreRing, { score: 88 }),
        createElement(MetricRow, { label: "Indexable pages", value: 142 }),
        createElement(FilterTabs, {
          value: "all",
          options: [
            { id: "all", label: "All", count: 12 },
            { id: "new", label: "New", count: 3 },
          ],
        }),
        createElement(VitalsBar, {
          desktop: [{ label: "LCP", goodPct: 80, needsWorkPct: 15, poorPct: 5 }],
        }),
        createElement(StatusIcon, { status: "error" }),
        createElement(EmptyState, { title: "Empty", description: "Nothing here" }),
        createElement(InlineAlert, { variant: "notice", title: "Note", description: "Detail" })
      )
    );
    expect(html).toContain("Website Audit");
    expect(html).toContain("Healthy");
    expect(html).toContain("Indexable pages");
    expect(html).toContain("Core Web Vitals");
  });

  it("renders expandable IssueTable with error-soft and success-soft panels", () => {
    const html = renderToStaticMarkup(
      createElement(IssueTable, {
        items: [
          {
            id: "missing-h1",
            title: "Missing H1",
            severity: "error",
            pagesCount: 3,
            description: "No H1 found.",
            howToFix: "Add one H1.",
            affectedUrls: ["https://example.com/rooms"],
          },
        ],
      })
    );
    expect(html).toContain("Missing H1");
    expect(html).toContain("Issue description");
    expect(html).toContain("How to fix");
    expect(html).toContain("bg-error-soft");
    expect(html).toContain("bg-success-soft");
    expect(html).toContain("https://example.com/rooms");
  });
});
