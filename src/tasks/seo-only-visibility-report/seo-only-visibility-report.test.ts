import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runSeoOnlyVisibilityReport } from "./index";
import { seoVisibilityReportInputSchema } from "./schema";
import { runDeterministicReportChecks, validateSeoVisibilityDraft } from "./validator";

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/seo-only-visibility-report.json",
);
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));

describe("seo-only-visibility-report task module", () => {
  it("parses the fixture input and flags missing optional audit PDF deterministically", () => {
    const parsed = seoVisibilityReportInputSchema.parse(fixture);
    const { flags, findings } = runDeterministicReportChecks(parsed.summary, parsed);

    expect(flags.some((f) => f.code === "MISSING_AUDIT_PDF" && f.severity === "warning")).toBe(true);
    expect(findings.some((line) => line.includes("8 keyword(s) currently rank in positions 1-10"))).toBe(true);
  });

  it("flags mismatch when a soft brand with a vanity site omits Slide 5", () => {
    const parsed = seoVisibilityReportInputSchema.parse({
      ...fixture,
      hasVanitySite: true,
      summary: { ...fixture.summary, is_brand_hosted: true, slide_count: 4 },
    });
    const { flags } = runDeterministicReportChecks(parsed.summary, parsed);
    expect(flags.some((f) => f.code === "VANITY_SITE_SLIDE5_MISMATCH")).toBe(true);
  });

  it("rejects placeholder text in executive narrative", () => {
    const parsed = seoVisibilityReportInputSchema.parse(fixture);
    const outcome = validateSeoVisibilityDraft(
      {
        executiveSummary: "Visibility summary for [property name] with TBD traffic.",
        highlights: ["Top 3: 3"],
      },
      parsed.summary,
    );

    expect(outcome.valid).toBe(false);
    expect(outcome.feedback?.length).toBeGreaterThan(0);
    expect(outcome.flags.some((f) => f.code === "PLACEHOLDER_TEXT")).toBe(true);
  });

  it("runs the full pipeline and returns output link + Flag Summary", async () => {
    const result = await runSeoOnlyVisibilityReport(fixture, {
      callClaude: async () =>
        JSON.stringify({
          executiveSummary:
            "The Nines Portland shows 8 top-10 rankings across 6 tracked and 14 ancillary keywords this month.",
          highlights: [
            "3 ancillary keywords rank in the top 3.",
            "5 ancillary keywords rank in positions 4-10.",
          ],
        }),
    });

    expect(result.taskId).toBe("seo-only-visibility-report");
    expect(result.status).toBe("Done");
    expect(result.flags.some((f) => f.code === "MISSING_AUDIT_PDF")).toBe(true);
    expect(result.outputUrl).toBe("download://seo_visibility_report_The_Nines.pptx");
    expect(result.output.propertyName).toBe("The Nines Portland");
    expect(result.output.flagSummary.hasWarnings).toBe(true);
    expect(result.output.highlights).toHaveLength(2);
  });
});
