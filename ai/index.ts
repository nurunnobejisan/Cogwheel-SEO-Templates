/**
 * Cogwheel AI SEO Brain — Entry Point (Phase 2)
 *
 * The AI layer that sits between the Universal Audit Engine (`rules/`) and the
 * CMS deployment gateway (Phase 3):
 *
 *   AuditReport ─▶ AI SEO Brain ─▶ FixPatch (strict JSON)
 *
 * Exposes the multi-tier model router, the RAG knowledge base, the prompt
 * engine, the deterministic synthesizer and the strict patch validator.
 */

export * from "./types.ts";
export * from "./router.ts";
export * from "./prompt.ts";
export * from "./orchestrator.ts";
export * from "./rag/index.ts";
export * from "./patch/index.ts";
