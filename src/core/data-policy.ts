/**
 * Data-provenance policy.
 *
 * SEO Studio must never present fabricated metrics as measured results. Several
 * integrations — Google Search Console, keyword volume/CPC, backlink authority
 * and AI-engine citation tracking — cannot run without credentials or a paid
 * data provider. When those sources are absent, callers must return empty or
 * explicitly-labelled estimated results rather than inventing plausible numbers.
 *
 * Synthetic demo data is therefore opt-in. Set `ALLOW_SIMULATED_DATA=1` only in
 * local demos or tests; it must never be enabled in a deployed environment.
 */

export function isSimulatedDataAllowed(): boolean {
  const value = (process.env.ALLOW_SIMULATED_DATA || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** Human-readable provenance tag attached to report sections. */
export type DataProvenance = "measured" | "estimated" | "unavailable" | "simulated";
