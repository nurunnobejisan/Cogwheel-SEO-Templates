import { describe, expect, it } from "vitest";
import {
  changeEventFromDeployment,
  delta,
  findPageMetric,
  gscPropertyFromUrl,
  measureChange,
  planWindows,
  samePage,
  selectControlPages,
  totalsFromRows,
  type ChangeEvent,
  type MeasureDeps,
} from "../src/core/outcomes";
import type { GscSearchRow } from "../src/core/gsc/types";

function row(page: string, clicks: number, impressions: number, position: number): GscSearchRow {
  return { keys: [page], clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position };
}

const CHANGE: ChangeEvent = {
  id: "chg_test",
  siteUrl: "sc-domain:example.com",
  pageUrl: "https://example.com/rooms",
  kind: "deployment",
  summary: "deployment",
  appliedAt: "2026-01-10T12:00:00Z",
  provenance: "measured",
};

describe("planWindows", () => {
  it("puts the before window immediately before the change and the after window after the lag", () => {
    const plan = planWindows("2026-01-10T12:00:00Z", { now: new Date("2026-06-30T00:00:00Z"), windowDays: 28, leadDays: 3 });
    expect(plan.before).toEqual({ startDate: "2025-12-13", endDate: "2026-01-09" });
    expect(plan.after).toEqual({ startDate: "2026-01-13", endDate: "2026-02-09" });
    expect(plan.afterComplete).toBe(true);
  });

  it("flags and clamps a still-filling after window", () => {
    const plan = planWindows("2026-06-25T00:00:00Z", { now: new Date("2026-06-30T00:00:00Z"), windowDays: 28, leadDays: 3 });
    expect(plan.afterComplete).toBe(false);
    expect(plan.after.endDate).toBe("2026-06-30");
  });
});

describe("page matching and aggregation", () => {
  it("matches pages ignoring scheme, www and trailing slash", () => {
    expect(samePage("https://www.example.com/rooms/", "https://example.com/rooms")).toBe(true);
    expect(samePage("https://example.com/rooms", "https://example.com/suites")).toBe(false);
  });

  it("aggregates with an impression-weighted position", () => {
    const totals = totalsFromRows([row("/a", 10, 100, 4), row("/b", 5, 50, 10)]);
    expect(totals.clicks).toBe(15);
    expect(totals.impressions).toBe(150);
    expect(totals.ctr).toBeCloseTo(0.1, 4);
    expect(totals.position).toBe(6); // (4*100 + 10*50) / 150
  });

  it("computes deltas", () => {
    const d = delta(
      { clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
      { clicks: 15, impressions: 120, ctr: 0.125, position: 4.5 },
    );
    expect(d).toEqual({ clicks: 5, impressions: 20, ctr: 0.025, position: -0.5 });
  });

  it("finds a page metric by full URL", () => {
    const rows = [row("https://example.com/rooms", 3, 30, 8)];
    expect(findPageMetric(rows, "https://www.example.com/rooms/")?.clicks).toBe(3);
    expect(findPageMetric(rows, "https://example.com/suites")).toBeNull();
  });
});

describe("selectControlPages", () => {
  it("excludes the changed page and picks the highest-impression controls, deterministically", () => {
    const rows = [row("/rooms", 10, 100, 5), row("/a", 1, 900, 9), row("/b", 1, 500, 9), row("/c", 1, 200, 9)];
    expect(selectControlPages(rows, "https://example.com/rooms", 2)).toEqual(["/a", "/b"]);
    expect(selectControlPages(rows, "https://example.com/rooms", 2, ["/a"])).toEqual(["/b", "/c"]);
  });
});

describe("measureChange", () => {
  const beforeRows = [row("https://example.com/rooms", 10, 100, 5), row("https://example.com/a", 5, 900, 9), row("https://example.com/b", 5, 500, 9)];
  const afterRows = [row("https://example.com/rooms", 15, 120, 4.5), row("https://example.com/a", 6, 950, 9), row("https://example.com/b", 6, 520, 9)];

  function deps(overrides: Partial<MeasureDeps> = {}): MeasureDeps {
    return {
      isConfigured: () => true,
      fetchPages: async ({ endDate }) => (endDate < "2026-01-10" ? beforeRows : afterRows),
      now: () => new Date("2026-06-30T00:00:00Z"),
      windowDays: 28,
      leadDays: 3,
      controlLimit: 2,
      ...overrides,
    };
  }

  it("records measured before/after metrics and a control delta", async () => {
    const record = await measureChange(CHANGE, deps());
    expect(record.provenance).toBe("measured");
    expect(record.afterComplete).toBe(true);
    expect(record.reason).toBeUndefined();
    expect(record.changed.before?.clicks).toBe(10);
    expect(record.changed.after?.clicks).toBe(15);
    expect(record.changed.delta?.clicks).toBe(5);
    expect(record.control?.pages).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(record.control?.before?.clicks).toBe(10);
    expect(record.control?.after?.clicks).toBe(12);
    expect(record.control?.delta?.clicks).toBe(2);
  });

  it("is unavailable when Search Console is not connected", async () => {
    const record = await measureChange(CHANGE, deps({ isConfigured: () => false }));
    expect(record.provenance).toBe("unavailable");
    expect(record.reason).toMatch(/not connected/i);
    expect(record.changed.delta).toBeNull();
  });

  it("reports no rows and flags an incomplete after window", async () => {
    const none = await measureChange(CHANGE, deps({ fetchPages: async () => [] }));
    expect(none.provenance).toBe("unavailable");
    expect(none.reason).toMatch(/no search console rows/i);

    const incomplete = await measureChange(
      { ...CHANGE, appliedAt: "2026-06-25T00:00:00Z" },
      deps(),
    );
    expect(incomplete.afterComplete).toBe(false);
    expect(incomplete.reason).toMatch(/still filling/i);
  });
});

describe("changeEventFromDeployment", () => {
  it("derives a domain property and a deterministic id", () => {
    const a = changeEventFromDeployment({ pageUrl: "https://www.example.com/rooms", appliedAt: "2026-01-01T00:00:00Z", tenantId: "org_1" });
    const b = changeEventFromDeployment({ pageUrl: "https://www.example.com/rooms", appliedAt: "2026-01-01T00:00:00Z" });
    expect(a.siteUrl).toBe("sc-domain:example.com");
    expect(a.kind).toBe("deployment");
    expect(a.tenantId).toBe("org_1");
    expect(a.id).toBe(b.id);
  });

  it("honours an explicit Search Console property", () => {
    expect(gscPropertyFromUrl("https://www.example.com/rooms", "https://example.com/")).toBe("https://example.com/");
  });
});
