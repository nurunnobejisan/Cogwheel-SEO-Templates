import { describe, it, expect } from "vitest";
import { verifyProvenance } from "../src/core/brain";
import type { FullWebsiteAuditReport } from "../src/core/full-audit";

describe("Brain provenance gate", () => {
  it("accepts claims that trace to the measured audit", () => {
    const audit = {
      targetUrl: "https://example.com/",
      domain: "example.com",
      overallScore: 59,
      scores: { technical: 75, onPage: 47 },
      actionPlan: [{ priority: "P0", title: "Add a single descriptive <h1>.", category: "headings" }],
      dataProvenance: { measured: ["headings"], estimated: [], unavailable: [] },
    } as unknown as FullWebsiteAuditReport;
    const retrieved = [{ title: "Title tag best practice", text: "40-60 characters" }];
    const text = "Overall score 59/100. Add a single descriptive <h1>. Title 40-60 characters.";
    const result = verifyProvenance(text, audit, retrieved);
    expect(result.ok).toBe(true);
    expect(result.untracedNumbers).toEqual([]);
  });

  it("rejects fabricated numeric claims", () => {
    const audit = {
      targetUrl: "https://example.com/",
      domain: "example.com",
      overallScore: 59,
      scores: { technical: 75, onPage: 47 },
      actionPlan: [],
      dataProvenance: { measured: [], estimated: [], unavailable: [] },
    } as unknown as FullWebsiteAuditReport;
    const text = "This page ranks #3 for 12,000 monthly searches and earns $4,200 revenue.";
    const result = verifyProvenance(text, audit, []);
    expect(result.ok).toBe(false);
    expect(result.untracedNumbers.length).toBeGreaterThan(0);
  });
});
