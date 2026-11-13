import type { HiltonSectionId } from "@/config/hilton-rules";
import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { validateSection, type SectionValidationResult } from "@/lib/hilton-validator";

export interface GeneratedSectionsDraft {
  sections: Record<string, string>;
  validation: Record<string, SectionValidationResult>;
  retries: Record<string, number>;
}

export function validateSingleSection(opts: {
  sectionId: HiltonSectionId;
  text: string;
  keyword?: string;
  usps?: string[];
  brand?: string;
  grandfathered?: boolean;
  requiresAdaLegal?: boolean;
  requiresJsNote?: boolean;
}): SectionValidationResult {
  return validateSection({
    sectionId: opts.sectionId,
    text: opts.text,
    keyword: opts.keyword,
    usps: opts.usps,
    brand: opts.brand,
    grandfathered: opts.grandfathered,
    adaLegalIncluded: opts.requiresAdaLegal ? /ada|accessible|accessibility/i.test(opts.text) : undefined,
    jsNoteIncluded: opts.requiresJsNote ? /js|javascript/i.test(opts.text) : undefined,
  });
}

export function collectSectionFlags(draft: GeneratedSectionsDraft): ValidationOutcome<GeneratedSectionsDraft> {
  const flags: TaskRunFlag[] = [];
  for (const [sectionId, result] of Object.entries(draft.validation)) {
    if (!result.valid) {
      for (const violation of result.violations) {
        flags.push({
          code: "hilton-rule-violation",
          message: `${sectionId}: ${violation}`,
          severity: "warning",
          section: sectionId,
        });
      }
    }
  }
  return {
    valid: true, // per-section retries already ran; remaining violations are surfaced as flags
    flags,
  };
}
