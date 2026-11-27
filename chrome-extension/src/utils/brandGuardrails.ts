/**
 * SEO & GEO Studio - Brand Guardrails (extension entry point)
 *
 * The guardrail data and validator now live with the hotel pack they belong
 * to (docs/TASKS.md Task 2.2). This wrapper keeps every existing extension
 * import path working and re-exports the identical functions — there is
 * exactly one copy of the rules.
 */
export * from "../../../src/packs/hotel/brand-guardrails";
