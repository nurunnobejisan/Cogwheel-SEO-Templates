/**
 * SEO Studio AI SEO Brain — Shared Types (Phase 2)
 *
 * Contracts for the multi-tier model router, the RAG knowledge base, the prompt
 * construction engine and the strict JSON patch pipeline.
 *
 * See docs/ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md (Phase 2).
 */

import type { AuditIssue, AuditMode } from "../rules/types.ts";

/** Cost/latency tier from the roadmap: Tier 1 = fast, Tier 2 = frontier. */
export type ModelTier = "tier1" | "tier2";

/**
 * Fine-grained task kinds used to pick a model tier. Structural tasks stay on
 * Tier 1; reasoning-heavy tasks escalate to Tier 2.
 */
export type TaskKind =
  | "structured_extraction"
  | "metadata_generation"
  | "alt_text_generation"
  | "schema_generation"
  | "semantic_reasoning"
  | "rag_synthesis"
  | "intent_mapping"
  | "entity_gap_analysis"
  /**
   * Page-type classification (Phase 2 job 4). Additive: existing call sites
   * never pass it, so the router's tier map gains one key and nothing else
   * changes. Routed to Tier 1 because it is a labelling task, not a reasoning
   * task.
   */
  | "page_classification";

export interface ProviderDescriptor {
  id: string;
  label: string;
  tier: ModelTier;
  model: string;
  /** True when the relevant env credential is present. */
  configured: boolean;
}

export interface RouteDecision {
  task: TaskKind;
  tier: ModelTier;
  provider: ProviderDescriptor | null;
  rationale: string;
  /** Configured providers to try, in order, if the primary fails. */
  fallback: ProviderDescriptor[];
}

/* ------------------------------------------------------------------ RAG ---- */

export interface RagChunk {
  id: string;
  title: string;
  text: string;
  /** Human-readable origin, e.g. "Google Search Central". */
  source: string;
  url?: string;
  tags: string[];
}

export interface ScoredChunk extends RagChunk {
  score: number;
}

export interface Embedder {
  id: string;
  dimensions: number;
  embed(text: string): number[];
  embedBatch(texts: string[]): number[][];
  /**
   * Optional async path (Phase 2) for network-backed embedders such as
   * `HttpEmbedder`. An embedder that implements these MUST throw from the
   * synchronous pair rather than silently returning vectors from a different
   * space — mixing a hashing query vector with HTTP chunk vectors would
   * corrupt retrieval without any error.
   */
  embedAsync?(text: string): Promise<number[]>;
  embedBatchAsync?(texts: string[]): Promise<number[][]>;
}

export interface KnowledgeBaseSearchOptions {
  topK?: number;
  tags?: string[];
  minScore?: number;
}

export interface KnowledgeBase {
  upsert(chunks: RagChunk[]): void;
  search(query: string, options?: KnowledgeBaseSearchOptions): ScoredChunk[];
  /**
   * Async search (Phase 2): awaits any embeddings still queued by `upsert`,
   * then ranks. For a synchronous embedder it resolves immediately, so call
   * sites can migrate without behaviour change; with an HTTP embedder the
   * synchronous `search` throws instead of returning wrong-space vectors.
   */
  searchAsync(
    query: string,
    options?: KnowledgeBaseSearchOptions,
  ): Promise<ScoredChunk[]>;
  size(): number;
}

/* ------------------------------------------------------------- Patches ---- */

export type MutationAction = "replace" | "inject" | "remove" | "manual_review";

/** Operational risk tier governing the auto-pilot approval gate. */
export type PatchRisk = "low" | "medium" | "high";

export interface PatchMutation {
  /** CMS field / target, e.g. "meta_description". */
  field: string;
  action: MutationAction;
  before: string | Record<string, unknown> | null;
  after: string | Record<string, unknown> | null;
  risk: PatchRisk;
  /** True when the auto-pilot gate may deploy this without human review. */
  autoApply: boolean;
}

/** Standardized fix patch payload (roadmap Phase 2 / Phase 3 contract). */
export interface FixPatch {
  patchId: string;
  auditId: string;
  targetUrl: string;
  mode: AuditMode;
  createdAt: string;
  mutations: PatchMutation[];
}

export interface PatchValidationResult {
  valid: boolean;
  errors: string[];
  patch?: FixPatch;
}

/* -------------------------------------------------------------- Prompts --- */

export interface BuiltPrompt {
  system: string;
  user: string;
  tier: ModelTier;
  task: TaskKind;
  /** Which knowledge chunks were injected, for audit logging. */
  contextIds: string[];
}

export interface ModelInvoker {
  id: string;
  /** Must return a JSON string conforming to the FixPatch schema. */
  invoke(prompt: BuiltPrompt): Promise<string>;
}

/* -------------------------------------------------------- Orchestration --- */

export interface FixPatchOptions {
  knowledgeBase?: KnowledgeBase;
  embedder?: Embedder;
  providers?: ProviderDescriptor[];
  /** Optional LLM. When absent the deterministic synthesizer runs alone. */
  invoker?: ModelInvoker;
  /** Enables one-click auto-pilot for low-risk mutations. */
  autoPilot?: boolean;
  patchId?: string;
  now?: string;
}

export interface DeferredIssue {
  issue: AuditIssue;
  reason: string;
}

export interface FixPatchResult {
  patch: FixPatch;
  validation: PatchValidationResult;
  deferred: DeferredIssue[];
  routeSummary: Partial<Record<TaskKind, RouteDecision>>;
}
