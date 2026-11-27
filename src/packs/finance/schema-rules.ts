/**
 * Finance pack — contextual JSON-LD requirements (docs/PACKS.md).
 *
 * Declarative rules layered on top of the runtime ruleset. Each rule names
 * the page types where it applies so a product rule can fire on `product`
 * without penalising an `article`. `rationale` is surfaced verbatim in audit
 * output — write it for the operator who has to act on it.
 *
 * YMYL angle: financial rich results and AI citations carry regulatory
 * exposure, so every product-family rule demands that fee and term
 * disclosures travel with the markup — a FinancialProduct or Loan that
 * claims pricing without its conditions is treated as an incomplete claim,
 * not a formatting nit.
 */
import type { PackSchemaRule } from "../types";

export const FINANCE_SCHEMA_RULES: PackSchemaRule[] = [
  {
    jsonLdType: "FinancialProduct",
    pageTypes: ["product", "home"],
    required: ["name", "description", "url", "provider"],
    recommended: ["category", "image", "feesAndCommissions"],
    rationale:
      "FinancialProduct markup tells crawlers and AI engines which institution stands behind the offer; without name, description, url and provider the entity is anonymous and gets dropped from product understanding. Add the fee and terms fields wherever the type asserts pricing, because a product claim published without its cost disclosure is both a rich-result gap and a regulatory risk.",
  },
  {
    jsonLdType: "Loan",
    pageTypes: ["product"],
    required: ["name", "amount", "annualPercentageRate", "loanTerm"],
    recommended: ["interestRate", "provider", "feesAndCommissions"],
    rationale:
      "A Loan node that omits amount, APR or loanTerm cannot be priced, so engines fall back to third-party rate tables instead of your page. Publish the APR and term alongside the headline amount and keep origination fees and repayment conditions next to them — the disclosure has to sit inside the same claim the markup makes, not two clicks away.",
  },
  {
    jsonLdType: "CreditCard",
    pageTypes: ["product"],
    required: ["name", "description", "provider"],
    recommended: ["annualPercentageRate", "category", "offers"],
    rationale:
      "CreditCard results are dominated by comparison sites, so a bare name and provider is the minimum needed for the issuer's own page to compete for the entity. When the markup advertises rates or balance-transfer terms, pair them with the fee schedule and eligibility conditions on the same page — YMYL reviewers and ad standards both expect the cost of credit to travel with the offer.",
  },
  {
    jsonLdType: "FAQPage",
    pageTypes: ["article", "other", "contact"],
    required: ["mainEntity"],
    recommended: ["lastReviewed"],
    rationale:
      "FAQPage without Question/mainEntity pairs cannot be cited in AI answers; drop the markup instead of shipping an empty shell. Because finance questions cover fees, eligibility and complaints, each answer must reflect the current published terms — stale FAQ markup that contradicts the fee schedule is worse than no markup at all.",
  },
  {
    jsonLdType: "Article",
    pageTypes: ["article"],
    required: ["headline", "author", "datePublished", "publisher"],
    recommended: ["dateModified", "image", "description"],
    rationale:
      "Money content is judged as YMYL, so author, publisher and dates are the E-E-A-T signals both reviewers and generative engines look for when deciding whether to cite. Carry a visible reviewer or adviser credential and a last-reviewed date on any piece that quotes rates or fees, so the structured claim can be reconciled with the disclosure on the page.",
  },
  {
    jsonLdType: "BreadcrumbList",
    pageTypes: ["product", "category", "article"],
    required: ["itemListElement"],
    recommended: ["position", "name", "item"],
    rationale:
      "Breadcrumbs replace the raw URL as the display path in results and in AI citations; itemListElement drives that path, and a wrong trail mislabels the page's topic. Keep the trail consistent with the site's product taxonomy so a rate page is presented as a product page rather than an article.",
  },
];
