/**
 * SEO Studio — Unified ML example record (Phase 0)
 *
 * One contract for every row in every split. `ml/build/to_chat.py` converts
 * these rows into the repository's 3-role system/user/assistant format so
 * `scripts/validate-training-data.mjs` and `scripts/export-lora-dataset.ts`
 * keep working unchanged on the chat form.
 *
 * Exported to `schemas/ml-example.schema.json` by `npm run export:json-schemas`.
 *
 * Governance this encodes (see docs/ml/DECISIONS.md):
 *  - `provenance` must be "measured" for any row whose output states a value
 *    the rules engine measured; "estimated" rows (including everything built
 *    with ALLOW_SIMULATED_DATA=1) carry `synthetic: true` and never enter a
 *    train split.
 *  - `source` is an id from ml/sources.yaml; `licence` is copied from it.
 *  - `domainHash` groups splits so one domain never appears in two splits.
 */

import { z } from "zod";

/* -------------------------------------------------------------- page types -- */

/**
 * Forward-looking page-type vocabulary for ML rows. This is a SUPERSET of
 * `PageTypeLabel` in `shared/ts/training-vault.ts`: the seven additive
 * labels (dining, spa, offers, meetings_events, faq, gallery, contact) land in
 * the vault in Phase 4 (rule 9 — additive, backward-compatible on read), at
 * which point the two lists converge. Old IndexedDB records keep their
 * original values either way.
 */
export const MlPageTypeLabels = [
  // existing PageTypeLabel values — never remove
  "hotel_homepage",
  "room_details",
  "amenities",
  "booking",
  "location",
  "article",
  "landing_page",
  "other",
  // additive (Phase 4)
  "dining",
  "spa",
  "offers",
  "meetings_events",
  "faq",
  "gallery",
  "contact",
] as const;

export const MlPageTypeLabelSchema = z.enum(MlPageTypeLabels);
export type MlPageTypeLabel = z.infer<typeof MlPageTypeLabelSchema>;

/* ------------------------------------------------------------------ tasks -- */

/** The five jobs. Mirrors `TaskKind` in ai/types.ts plus page_classification. */
export const MlTaskSchema = z.enum([
  "schema_generation",
  "metadata_generation",
  "rag_synthesis",
  "page_classification",
  "entity_gap_analysis",
]);
export type MlTask = z.infer<typeof MlTaskSchema>;

/**
 * Evaluation checks from docs/ml/PROGRESS.md section 9. A golden case declares
 * which of them apply; `ml/eval/run_eval.py` refuses to run an unknown check.
 */
export const MlCheckSchema = z.enum([
  "jsonld_valid",
  "grounding",
  "invented_metrics",
  "title_budget",
  "classifier_macro_f1",
  "explainer_citation",
  "human_review",
]);
export type MlCheck = z.infer<typeof MlCheckSchema>;

export const MlProvenanceSchema = z.enum(["measured", "estimated", "unavailable"]);
export type MlProvenance = z.infer<typeof MlProvenanceSchema>;

export const MlSplitSchema = z.enum(["train", "eval", "test"]);
export type MlSplit = z.infer<typeof MlSplitSchema>;

/* --------------------------------------------------------------- findings -- */

/**
 * One measured rule finding. This is the Zod mirror of `AuditIssue` in
 * `rules/types.ts` (the repository has no `RuleFinding` type — see
 * docs/ml/DECISIONS.md). The shape is intentionally identical so a finding can
 * be copied between the audit report and an example row without adaptation.
 */
export const RuleFindingSchema = z.object({
  issueId: z.string().min(1),
  category: z.enum([
    "metadata",
    "content",
    "media",
    "technical",
    "accessibility",
    "schema",
    "hospitality",
  ]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  fixable: z.boolean(),
  cmsTargetField: z.string().nullable(),
  context: z.object({
    currentValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    selector: z.string(),
    imageSrc: z.string().optional(),
    recommendedAction: z.string(),
  }),
});
export type RuleFinding = z.infer<typeof RuleFindingSchema>;

/* ----------------------------------------------------------------- record -- */

export const MlExampleInputSchema = z.object({
  /** Omitted for synthetic rows. */
  url: z.string().url().optional(),
  /** Split grouping key. Never the raw domain. */
  domainHash: z.string().min(1),
  pageType: MlPageTypeLabelSchema.optional(),
  /** trafilatura output, truncated to the token budget at sentence boundaries. */
  text: z.string().optional(),
  /** Only values the rules engine measured. */
  measured: z.record(z.unknown()),
  findings: z.array(RuleFindingSchema).optional(),
  retrieved: z.array(z.object({ url: z.string().min(1), passage: z.string() })).optional(),
});

export const MlExampleSchema = z.object({
  /** sha256 of task + canonical input. */
  id: z.string().regex(/^[0-9a-f]{64}$/, "id must be a lowercase sha256 hex digest"),
  task: MlTaskSchema,
  input: MlExampleInputSchema,
  /** JSON-LD object, meta object, explanation, label, … */
  output: z.unknown(),
  provenance: MlProvenanceSchema,
  /** Id from ml/sources.yaml. */
  source: z.string().min(1),
  /** Licence string copied from ml/sources.yaml. */
  licence: z.string().min(1),
  synthetic: z.boolean(),
  tenantId: z.string().min(1).optional(),
  /** Present only on first-party rows. */
  consent: z.literal(true).optional(),
  split: MlSplitSchema,
  createdAt: z.string().min(1),
});

export type MlExample = z.infer<typeof MlExampleSchema>;
export type MlExampleInput = z.infer<typeof MlExampleInputSchema>;

/* ------------------------------------------------------------ golden set -- */

/**
 * A hand-checked evaluation case. Same shape as an example plus the list of
 * section-9 checks to apply. Frozen with a content hash in
 * docs/ml/DATA_CARD.md.
 */
export const MlGoldenCaseSchema = MlExampleSchema.extend({
  split: z.literal("eval"),
  checks: z.array(MlCheckSchema).min(1),
  /** Operator note: what makes this case right or wrong. */
  note: z.string().min(1),
});

export type MlGoldenCase = z.infer<typeof MlGoldenCaseSchema>;

/** Task -> job name used in docs and the golden-set index. */
export const ML_TASK_LABELS: Record<MlTask, string> = {
  schema_generation: "Schema writer",
  metadata_generation: "Meta & heading writer",
  rag_synthesis: "Audit explainer",
  page_classification: "Page classifier",
  entity_gap_analysis: "GEO gap finder",
};
