/**
 * Universal brand guardrails shared by every non-franchise pack
 * (docs/TASKS.md Task 2.3).
 *
 * Hotel brands have franchise standards in `hotel/brand-guardrails.ts`; the
 * five universal packs have no franchise rulebook, so they declare one
 * `Generic` entry covering claims every vertical must substantiate. These
 * are editorial guardrails (flagged for operator review with a suggested
 * replacement), not automatic edits — and they are not measurements of
 * anything.
 */
import type { AllBrandGuardrails } from "../schemas/validation";

export const GENERIC_BRAND_GUARDRAILS: AllBrandGuardrails = {
  Generic: {
    name: "Generic",
    loyaltyProgram: "",
    maxTitleChars: 60,
    maxMetaChars: 160,
    maxH1Chars: 70,
    brandPillColor: "#64748b",
    forbiddenTerms: [
      {
        term: "#1",
        reason:
          "Unverifiable ranking claim: no source in this repo substantiates a numbered #1 position.",
        replacement: "top-rated (with a cited source)",
      },
      {
        term: "best in class",
        reason:
          "Superlative without evidence; advertising standards require substantiation for superiority claims.",
        replacement: "purpose-built",
      },
      {
        term: "guaranteed results",
        reason:
          "Promise of outcomes no SEO program can guarantee; erodes trust in audit copy.",
        replacement: "designed to improve",
      },
      {
        term: "limited time only",
        reason:
          "Fake-urgency pattern that review engines flag and readers discount.",
        replacement: "currently offered",
      },
      {
        term: "cheapest",
        reason:
          "Unsubstantiated price superlative that invites competitive challenge.",
        replacement: "competitively priced",
      },
    ],
  },
};
