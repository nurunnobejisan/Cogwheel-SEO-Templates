import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runSeoBaselineAiVisibility } from "./index";
import { seoBaselineInputSchema } from "./schema";
import { runDeterministicBaselineChecks, validateSeoBaselineDraft } from "./validator";

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/seo-baseline-ai-visibility.json",
);
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));

describe("seo-baseline-ai-visibility task module", () => {
  it("runs deterministic checks and flags AI visibility below 30% target", () => {
    const parsed = seoBaselineInputSchema.parse(fixture);
    const result = runDeterministicBaselineChecks(parsed);

    expect(result.reconciledTotalKeywords).toBe(678);
    expect(result.flags.some((f) => f.code === "LOW_AI_VISIBILITY")).toBe(true);
    expect(result.findings.some((line) => line.includes("14200 organic traffic"))).toBe(true);
  });

  it("enforces max 2 sentences on compSetTakeaway and rejects placeholder text", () => {
    const tooLong = validateSeoBaselineDraft({
      mobileTrafficSummary: "Mobile traffic is steady.",
      mobileKeywordsSummary: "678 ranking keywords.",
      mobileAnalysis: "Focus on core pages.",
      desktopTrafficSummary: "Desktop traffic is steady.",
      desktopKeywordsSummary: "579 non-brand keywords.",
      desktopAnalysis: "Expand amenity pages.",
      compSetTakeaway: "Sentence one. Sentence two. Sentence three.",
      aiVisibilityTakeaway: "AI visibility is 24% with positive sentiment.",
    });
    expect(tooLong.valid).toBe(false);
    expect(tooLong.feedback?.some((f) => f.includes("2 sentences MAX"))).toBe(true);

    const withPlaceholder = validateSeoBaselineDraft({
      mobileTrafficSummary: "Mobile traffic is steady.",
      mobileKeywordsSummary: "678 ranking keywords.",
      mobileAnalysis: "[EXAMPLE ANALYSIS] here.",
      desktopTrafficSummary: "Desktop traffic is steady.",
      desktopKeywordsSummary: "579 non-brand keywords.",
      desktopAnalysis: "Expand amenity pages.",
      compSetTakeaway: "Prioritize non-brand luxury terms to close the comp set gap.",
      aiVisibilityTakeaway: "AI visibility is 24% with positive sentiment.",
    });
    expect(withPlaceholder.valid).toBe(false);
    expect(withPlaceholder.flags.some((f) => f.code === "PLACEHOLDER_TEXT")).toBe(true);
  });

  it("runs the full pipeline and returns structured slides + Flag Summary", async () => {
    const result = await runSeoBaselineAiVisibility(fixture, {
      callClaude: async () =>
        JSON.stringify({
          mobileTrafficSummary: "Mobile organic traffic held steady at 14,200 estimated visits.",
          mobileKeywordsSummary: "Site ranks for 678 total keywords across mobile.",
          mobileAnalysis: "Core revenue-driving terms held despite seasonal informational fluctuations.",
          desktopTrafficSummary: "Desktop organic traffic remains anchored by branded demand.",
          desktopKeywordsSummary: "579 non-brand and 99 brand keywords are currently indexed.",
          desktopAnalysis: "Expanding non-brand room and dining content will lift desktop reach.",
          compSetTakeaway:
            "Closing non-brand luxury keyword gaps against the local comp set will drive incremental direct bookings. Prioritizing amenity and location content is our immediate focus.",
          aiVisibilityTakeaway:
            "AI visibility sits at 24% with positive sentiment (68/100) across 19 brand mentions. Strengthening citations on owned and editorial pages will help surpass the 30% target.",
        }),
    });

    expect(result.taskId).toBe("seo-baseline-ai-visibility");
    expect(result.status).toBe("Done");
    expect(result.output.propertyName).toBe("The Nines, a Luxury Collection Hotel, Portland");
    expect(result.output.slides.length).toBeGreaterThanOrEqual(7);
    expect(result.output.flagSummary.hasWarnings).toBe(true);
  });
});
