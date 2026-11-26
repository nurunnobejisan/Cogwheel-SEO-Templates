import { describe, expect, it } from "vitest";
import {
  aggregateByKind,
  confidenceFor,
  counterfactual,
  judgeOutcomes,
  perChangeEffect,
} from "../src/core/judgment";
import type { ChangeEffect } from "../src/core/judgment";
import type { ChangeEvent, OutcomeRecord, PageMetric } from "../src/core/outcomes";

function metric(clicks: number, impressions: number, position: number): PageMetric {
  return { page: "https://example.com/p", clicks, impressions, ctr: impressions ? clicks / impressions : 0, position };
}

function change(id: string, kind = "meta_description"): ChangeEvent {
  return {
    id,
    siteUrl: "sc-domain:example.com",
    pageUrl: `https://example.com/${id}`,
    kind,
    summary: kind,
    appliedAt: "2026-01-10T12:00:00Z",
    provenance: "measured",
  };
}

function outcome(changeId: string, overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    id: `out_${changeId}`,
    changeId,
    siteUrl: "sc-domain:example.com",
    pageUrl: `https://example.com/${changeId}`,
    measuredAt: "2026-06-30T00:00:00Z",
    provenance: "measured",
    windowDays: 28,
    afterComplete: true,
    beforeWindow: { startDate: "2025-12-13", endDate: "2026-01-09" },
    afterWindow: { startDate: "2026-01-13", endDate: "2026-02-09" },
    changed: { before: metric(10, 100, 5), after: metric(15, 130, 4), delta: null },
    control: { pages: ["https://example.com/a"], before: { clicks: 10, impressions: 500, ctr: 0.02, position: 9 }, after: { clicks: 12, impressions: 520, ctr: 0.023, position: 9 }, delta: null },
    ...overrides,
  };
}

describe("counterfactual", () => {
  it("scales by the control trend when the control has traffic", () => {
    expect(counterfactual(10, 10, 12)).toBe(12);
    expect(counterfactual(100, 50, 75)).toBe(150);
  });

  it("falls back to an additive counterfactual when the control before-value is zero", () => {
    expect(counterfactual(10, 0, 5)).toBe(15);
  });
});

describe("confidenceFor", () => {
  it("caps confidence by sample size", () => {
    expect(confidenceFor(0)).toBe("low");
    expect(confidenceFor(3)).toBe("low");
    expect(confidenceFor(4)).toBe("medium");
    expect(confidenceFor(9)).toBe("medium");
    expect(confidenceFor(10)).toBe("high");
  });
});

describe("perChangeEffect", () => {
  it("computes a control-adjusted (difference-in-differences) effect", () => {
    const effect = perChangeEffect(change("c1"), outcome("c1"));
    // clicks: 15 - (10 * 12/10) = 3
    expect(effect?.netClicks).toBe(3);
    // impressions: 130 - (100 * 520/500) = 26
    expect(effect?.netImpressions).toBe(26);
    // position gain: before 5 → after 4 = +1
    expect(effect?.positionGain).toBe(1);
  });

  it("excludes unavailable, incomplete, and control-less outcomes", () => {
    expect(perChangeEffect(change("c1"), undefined)).toBeNull();
    expect(perChangeEffect(change("c1"), outcome("c1", { provenance: "unavailable" }))).toBeNull();
    expect(perChangeEffect(change("c1"), outcome("c1", { afterComplete: false }))).toBeNull();
    expect(perChangeEffect(change("c1"), outcome("c1", { control: null }))).toBeNull();
  });
});

describe("aggregateByKind", () => {
  const effects: ChangeEffect[] = [
    { changeId: "a", kind: "meta_description", pageUrl: "x", netClicks: 3, netImpressions: 10, positionGain: 1 },
    { changeId: "b", kind: "meta_description", pageUrl: "y", netClicks: -1, netImpressions: -5, positionGain: 0 },
    { changeId: "c", kind: "meta_description", pageUrl: "z", netClicks: 5, netImpressions: 20, positionGain: 2 },
  ];

  it("reports median/mean/positive share and low confidence for a small sample", () => {
    const [kind] = aggregateByKind(effects, new Map([["meta_description", 4]]));
    expect(kind!.sampleSize).toBe(3);
    expect(kind!.considered).toBe(4);
    expect(kind!.excluded).toBe(1);
    expect(kind!.medianNetClicks).toBe(3);
    expect(kind!.meanNetClicks).toBeCloseTo(2.33, 2);
    expect(kind!.positiveClickShare).toBeCloseTo(0.667, 3);
    expect(kind!.confidence).toBe("low");
    expect(kind!.provenance).toBe("estimated");
    expect(kind!.caveats.some((c) => /small sample/i.test(c))).toBe(true);
  });

  it("includes a kind that had only excluded outcomes", () => {
    const kinds = aggregateByKind(effects, new Map([["meta_description", 3], ["keyword-matrix", 2]]));
    const matrix = kinds.find((k) => k.kind === "keyword-matrix")!;
    expect(matrix.sampleSize).toBe(0);
    expect(matrix.excluded).toBe(2);
    expect(matrix.medianNetClicks).toBeNull();
    expect(matrix.provenance).toBe("estimated");
  });
});

describe("judgeOutcomes", () => {
  it("aggregates only measured, complete changes and reports the exclusions", () => {
    const changes = [change("c1"), change("c2"), change("c3", "keyword-matrix")];
    const outcomes = [
      outcome("c1"),
      outcome("c2", { afterComplete: false }),
      outcome("c3", { provenance: "unavailable" }),
      outcome("c4"), // outcome with no matching change is ignored
    ];
    const report = judgeOutcomes(changes, outcomes, new Date("2026-07-01T00:00:00Z"));

    expect(report.provenance).toBe("estimated");
    expect(report.totalChanges).toBe(3);
    expect(report.qualifyingChanges).toBe(1);

    const meta = report.kinds.find((k) => k.kind === "meta_description")!;
    expect(meta.sampleSize).toBe(1);
    expect(meta.considered).toBe(2); // c1 qualifies, c2 is measured-but-incomplete
    expect(meta.excluded).toBe(1);
    expect(report.notes.some((note) => /difference-in-differences/i.test(note))).toBe(true);
  });

  it("returns an empty report when nothing was measured", () => {
    const report = judgeOutcomes([change("c1")], []);
    expect(report.qualifyingChanges).toBe(0);
    expect(report.kinds).toEqual([]);
  });
});
