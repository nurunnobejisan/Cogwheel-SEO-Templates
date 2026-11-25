/**
 * Cogwheel CMS Integration Layer — Entry Point (Phase 3)
 *
 * Secure, guarded publishing of Phase 2 FixPatches to real CMS platforms:
 *
 *   FixPatch ─▶ [approval gate] ─▶ CmsConnector ─▶ snapshot / apply / verify / restore
 *
 * Exposes the encrypted credential vault, OAuth 2.0 state + Shopify flow, the
 * WordPress / Shopify / Webflow / universal-runtime connectors, and the
 * deployment orchestrator.
 */

export * from "./types.ts";
export * from "./vault.ts";
export * from "./credentials.ts";
export * from "./factory.ts";
export * from "./deploy.ts";

export * from "./oauth/state.ts";
export * from "./oauth/shopify.ts";

export * from "./wordpress/connector.ts";
export * from "./shopify/connector.ts";
export * from "./webflow/connector.ts";
export * from "./custom/connector.ts";
export * from "./runtime/seo-autofix.ts";
