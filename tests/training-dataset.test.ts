import { describe, expect, it } from "vitest";
import {
  MIN_REVIEWED_PAIRS_FOR_TRAINING,
  buildLoraExample,
  contentHash,
  hasDuplicateContent,
  isTrainingEligible,
  stripPii,
  type TrainingTriple,
} from "../src/core/training/dataset";

function triple(overrides: Partial<TrainingTriple> = {}): TrainingTriple {
  return {
    id: "t1",
    url: "https://example.com/",
    audit: { overallScore: 59 },
    expertFix: { title: "New title" },
    quality: "reviewed",
    capturedAt: "2026-11-26T00:00:00.000Z",
    contentHash: "hash",
    consent: true,
    provenance: "measured",
    pack: "hotel",
    pageType: "hotel_homepage",
    ...overrides,
  };
}

describe("training dataset gates", () => {
  it("only allows reviewed and gold tiers into training", () => {
    expect(isTrainingEligible("raw")).toBe(false);
    expect(isTrainingEligible("reviewed")).toBe(true);
    expect(isTrainingEligible("gold")).toBe(true);
    expect(MIN_REVIEWED_PAIRS_FOR_TRAINING).toBe(2000);
  });

  it("strips emails, phones and provider secrets before storage", () => {
    const clean = stripPii({
      note: "Call +1 415 555 0199 or email guest@example.com",
      nested: ["Bearer sk-live-abcdef1234567890abcdef"],
      count: 3,
    }) as { note: string; nested: string[]; count: number };
    expect(clean.note).not.toContain("guest@example.com");
    expect(clean.note).not.toContain("415 555 0199");
    expect(clean.nested[0]).not.toContain("sk-live-abcdef");
    expect(clean.count).toBe(3);
  });

  it("redacts parenthesized phone numbers (regression: leading \\b cannot match before '(')", () => {
    const clean = stripPii({
      note: "tel (503) 555-0123 or (212) 555 0100",
    }) as { note: string };
    expect(clean.note).not.toContain("555-0123");
    expect(clean.note).not.toContain("555 0100");
    expect(clean.note).toContain("[REDACTED_PHONE]");
  });

  it("hashes content deterministically regardless of key order", () => {
    const a = contentHash({ b: 2, a: 1 }, { fix: "x" });
    const b = contentHash({ a: 1, b: 2 }, { fix: "x" });
    expect(a).toBe(b);
    expect(contentHash({ a: 1 }, { fix: "x" })).not.toBe(a);
  });

  it("treats only identical audit+fix content as a duplicate (the same URL may repeat)", () => {
    const existing = [{ contentHash: "a" }, { contentHash: "b" }];
    expect(hasDuplicateContent(existing, "b")).toBe(true);
    expect(hasDuplicateContent(existing, "c")).toBe(false);
    expect(hasDuplicateContent([], "a")).toBe(false);
  });

  it("builds ChatML-style LoRA examples with the measured-fix guardrail", () => {
    const example = buildLoraExample(triple());
    expect(example.messages).toHaveLength(3);
    expect(example.messages[0]?.role).toBe("system");
    expect(example.messages[0]?.content).toMatch(/Never invent rankings/);
    expect(example.messages[1]?.content).toContain("overallScore");
    expect(example.metadata.quality).toBe("reviewed");
    // consent must survive the export — the licence gate downstream refuses
    // first-party rows whose metadata lost it (ml/train/dataset.py).
    expect(example.metadata.consent).toBe(true);
  });
});
