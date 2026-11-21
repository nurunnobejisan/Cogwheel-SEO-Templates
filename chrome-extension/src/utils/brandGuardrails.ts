/**
 * Cogwheel SEO & GEO Studio - Brand Guardrails Engine
 *
 * Enforces hotel franchise standards, prohibited superlatives,
 * mandatory loyalty suffix structures, and length limits for:
 * - Marriott International (Marriott Bonvoy)
 * - Hilton Worldwide (Hilton Honors)
 * - InterContinental Hotels Group (IHG One Rewards)
 * - Hyatt Hotels Corporation (World of Hyatt)
 * - Independent Luxury Hotels
 */

export type BrandGuardrail = "Marriott" | "Hilton" | "IHG" | "Hyatt" | "Independent";

export interface ForbiddenTermRule {
  term: string;
  reason: string;
  replacement: string;
}

export interface BrandRules {
  name: BrandGuardrail;
  loyaltyProgram: string;
  mandatorySuffix: string;
  maxTitleChars: number;
  maxMetaChars: number;
  maxH1Chars: number;
  brandPillColor: string;
  forbiddenTerms: ForbiddenTermRule[];
}

export const BRAND_GUARDRAILS: Record<BrandGuardrail, BrandRules> = {
  Marriott: {
    name: "Marriott",
    loyaltyProgram: "Marriott Bonvoy",
    mandatorySuffix: "Marriott Bonvoy",
    maxTitleChars: 60,
    maxMetaChars: 155,
    maxH1Chars: 70,
    brandPillColor: "#b91c1c",
    forbiddenTerms: [
      {
        term: "free breakfast",
        reason: "Marriott brand standards require 'Complimentary hot breakfast' or 'Daily breakfast included'.",
        replacement: "Complimentary hot breakfast",
      },
      {
        term: "marriott rewards",
        reason: "Outdated loyalty nomenclature. Must be 'Marriott Bonvoy'.",
        replacement: "Marriott Bonvoy",
      },
      {
        term: "bonvoy rewards",
        reason: "Redundant brand phrasing. Use 'Marriott Bonvoy points' or 'Marriott Bonvoy'.",
        replacement: "Marriott Bonvoy",
      },
      {
        term: "best hotel",
        reason: "Unsubstantiated superlative claim prohibited under Marriott brand compliance.",
        replacement: "Premier beachfront hotel",
      },
      {
        term: "cheapest rate",
        reason: "Prohibited discount terminology. Use 'Best Rate Guarantee'.",
        replacement: "Best Rate Guarantee",
      },
    ],
  },
  Hilton: {
    name: "Hilton",
    loyaltyProgram: "Hilton Honors",
    mandatorySuffix: "Hilton Honors",
    maxTitleChars: 60,
    maxMetaChars: 150,
    maxH1Chars: 65,
    brandPillColor: "#1e40af",
    forbiddenTerms: [
      {
        term: "free wifi",
        reason: "Hilton standards require 'Complimentary Wi-Fi' for Honors guests.",
        replacement: "Complimentary Wi-Fi",
      },
      {
        term: "hilton hhonors",
        reason: "Outdated brand styling with lowercase 'h'. Use 'Hilton Honors'.",
        replacement: "Hilton Honors",
      },
      {
        term: "best rates in town",
        reason: "Unsubstantiated claim. Use 'Hilton Price Match Guarantee'.",
        replacement: "Price Match Guarantee",
      },
      {
        term: "free cancellation",
        reason: "Must specify policy window (e.g. 'Flexible cancellation up to 24h prior').",
        replacement: "Flexible cancellation",
      },
    ],
  },
  IHG: {
    name: "IHG",
    loyaltyProgram: "IHG One Rewards",
    mandatorySuffix: "IHG One Rewards",
    maxTitleChars: 60,
    maxMetaChars: 155,
    maxH1Chars: 70,
    brandPillColor: "#d97706",
    forbiddenTerms: [
      {
        term: "ihg rewards club",
        reason: "Legacy brand name. Must use 'IHG One Rewards'.",
        replacement: "IHG One Rewards",
      },
      {
        term: "best hotel",
        reason: "Superlative claims require verified third-party awards.",
        replacement: "Award-winning hotel",
      },
      {
        term: "free breakfast",
        reason: "Must specify tier standard (e.g. 'Express Start Breakfast' or 'Complimentary breakfast').",
        replacement: "Complimentary breakfast",
      },
    ],
  },
  Hyatt: {
    name: "Hyatt",
    loyaltyProgram: "World of Hyatt",
    mandatorySuffix: "World of Hyatt",
    maxTitleChars: 60,
    maxMetaChars: 155,
    maxH1Chars: 70,
    brandPillColor: "#047857",
    forbiddenTerms: [
      {
        term: "gold passport",
        reason: "Legacy Hyatt program retired in 2017. Must use 'World of Hyatt'.",
        replacement: "World of Hyatt",
      },
      {
        term: "cheapest rooms",
        reason: "Prohibited discount terminology. Use 'Hyatt Standard Rate' or 'Member Rate'.",
        replacement: "Hyatt Member Rate",
      },
      {
        term: "free cancellation",
        reason: "Must specify reservation deadline window.",
        replacement: "Standard cancellation policy applies",
      },
    ],
  },
  Independent: {
    name: "Independent",
    loyaltyProgram: "Direct Booking / Independent",
    mandatorySuffix: "Official Site",
    maxTitleChars: 65,
    maxMetaChars: 160,
    maxH1Chars: 75,
    brandPillColor: "#6366f1",
    forbiddenTerms: [
      {
        term: "cheapest hotel in",
        reason: "Diminishes property positioning. Use 'Best Direct Booking Value'.",
        replacement: "Best Direct Booking Value",
      },
      {
        term: "100% satisfaction guaranteed",
        reason: "Unenforceable legal liability claim.",
        replacement: "Dedicated guest hospitality",
      },
    ],
  },
};

export interface BrandViolation {
  field: "title" | "meta" | "h1";
  type: "forbidden_term" | "max_chars" | "missing_suffix";
  term?: string;
  reason: string;
  replacement?: string;
}

export interface BrandValidationResult {
  valid: boolean;
  brand: BrandGuardrail;
  violations: BrandViolation[];
}

/**
 * Validates a hotel title, meta description, and H1 against strict brand standards.
 */
export function validateBrandCompliance(
  brand: BrandGuardrail,
  input: {
    title?: string;
    metaDesc?: string;
    h1?: string;
    requireSuffix?: boolean;
  }
): BrandValidationResult {
  const rules = BRAND_GUARDRAILS[brand];
  const violations: BrandViolation[] = [];

  const title = input.title || "";
  const meta = input.metaDesc || "";
  const h1 = input.h1 || "";

  // 1. Length Limits
  if (title.length > rules.maxTitleChars) {
    violations.push({
      field: "title",
      type: "max_chars",
      reason: `Title length (${title.length} chars) exceeds ${brand} limit of ${rules.maxTitleChars} characters.`,
    });
  }

  if (meta.length > rules.maxMetaChars) {
    violations.push({
      field: "meta",
      type: "max_chars",
      reason: `Meta description length (${meta.length} chars) exceeds ${brand} limit of ${rules.maxMetaChars} characters.`,
    });
  }

  if (h1.length > rules.maxH1Chars) {
    violations.push({
      field: "h1",
      type: "max_chars",
      reason: `H1 heading length (${h1.length} chars) exceeds ${brand} limit of ${rules.maxH1Chars} characters.`,
    });
  }

  // 2. Forbidden Terms Scan (Case-insensitive)
  const fieldsToCheck: Array<{ field: "title" | "meta" | "h1"; text: string }> = [
    { field: "title", text: title.toLowerCase() },
    { field: "meta", text: meta.toLowerCase() },
    { field: "h1", text: h1.toLowerCase() },
  ];

  for (const check of fieldsToCheck) {
    for (const forbidden of rules.forbiddenTerms) {
      if (check.text.includes(forbidden.term.toLowerCase())) {
        violations.push({
          field: check.field,
          type: "forbidden_term",
          term: forbidden.term,
          reason: forbidden.reason,
          replacement: forbidden.replacement,
        });
      }
    }
  }

  // 3. Mandatory Loyalty / Official Suffix Check (if enabled)
  if (input.requireSuffix && title.trim().length > 0) {
    const hasSuffix = title.toLowerCase().includes(rules.mandatorySuffix.toLowerCase());
    if (!hasSuffix) {
      violations.push({
        field: "title",
        type: "missing_suffix",
        reason: `Title lacks mandatory ${brand} brand suffix '${rules.mandatorySuffix}'.`,
        replacement: `${title.trim()} | ${rules.mandatorySuffix}`,
      });
    }
  }

  return {
    valid: violations.length === 0,
    brand,
    violations,
  };
}
