import { describe, expect, it } from "vitest";
import { verifyClaimProvenance, verifyProvenance } from "../src/core/brain";
import type { FullWebsiteAuditReport } from "../src/core/full-audit";

function audit(): FullWebsiteAuditReport {
  return {
    targetUrl: "https://example.com/",
    domain: "example.com",
    overallScore: 59,
    scores: { technical: 75, onPage: 47 },
    actionPlan: [
      { priority: "P0", title: "Add a single descriptive <h1>.", category: "headings" },
      { priority: "P2", title: "Publish /llms.txt", category: "geo" },
    ],
    geoAudit: {
      citability: { score: 62, formula: "weighted components", components: [] },
      aiCrawlers: { status: "present", blockedBots: ["GPTBot"], allowedBots: [], unmentionedBots: [] },
      llmsTxt: { status: "absent", score: 0 },
      drift: { status: "no_baseline", scoreDelta: null, regressions: [] },
    },
    dataProvenance: {
      measured: ["headings"],
      estimated: ["citability"],
      unavailable: ["searchConsole"],
    },
  } as unknown as FullWebsiteAuditReport;
}

const retrieved = [{ id: "kc-title-tag", title: "Title tag best practice", text: "Keep titles within 40-60 characters." }];

describe("claim-to-field provenance", () => {
  it("accepts claims and numbers traced to the audit", () => {
    const text = "Overall score 59/100. Citability 62/100; GPTBot is blocked. Add a single descriptive <h1>.";
    const result = verifyClaimProvenance(text, audit(), retrieved);
    expect(result.ok).toBe(true);
    expect(result.unmappedClaims).toEqual([]);
    expect(result.checkedClaims).toBeGreaterThan(0);
  });

  it("accepts a sentence backed by a known retrieved chunk id", () => {
    const result = verifyClaimProvenance(
      "Keep titles within 40-60 characters [kc-title-tag].",
      audit(),
      retrieved
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a citation id that was never retrieved", () => {
    const result = verifyClaimProvenance(
      "The page needs a clearer answer block [kc-imaginary-source].",
      audit(),
      retrieved
    );
    expect(result.ok).toBe(false);
    expect(result.unmappedClaims.length).toBeGreaterThan(0);
  });

  it("rejects fabricated numbers", () => {
    const text = "This page ranks #3 for 12,000 monthly searches and earns $4,200 revenue.";
    const result = verifyClaimProvenance(text, audit(), []);
    expect(result.ok).toBe(false);
    expect(result.untracedNumbers).toEqual(expect.arrayContaining(["3", "12", "000", "4", "200"]));
  });

  it("rejects an unsupported qualitative claim", () => {
    const result = verifyClaimProvenance(
      "The hotel is the most recommended choice among luxury travellers in Europe.",
      audit(),
      []
    );
    expect(result.ok).toBe(false);
  });

  it("allows explicit unavailability statements", () => {
    const text = "Search Console data is unavailable. Dimensions not measured are reported as unavailable.";
    const result = verifyClaimProvenance(text, audit(), []);
    expect(result.ok).toBe(true);
  });

  it("keeps the numeric-only gate working for existing callers", () => {
    const text = "Overall score 59/100. Title 40-60 characters.";
    expect(verifyProvenance(text, audit(), retrieved).ok).toBe(true);
    expect(verifyProvenance("Ranks #3 for 12,000 searches.", audit(), retrieved).ok).toBe(false);
  });
});
