# SEO-Studio AI SEO Model (v1) — Agent Log

Running work-package log for v1 adapter readiness.

## WP1 — Operator Auth (`ml/wp1-operator-auth`)
- **Changed**:
  - Created `src/lib/security/operator.ts` (`requireOperator`, `hasOperatorToken`, `requiresOperatorAuth`, `PROTECTED_GET_ROUTE_PREFIXES`).
  - Updated `src/middleware.ts` to enforce `requireOperator` on all non-GET/HEAD/OPTIONS `/api/*` requests and costly/crawl/LLM GET routes (`/api/brain`, `/api/full-audit`, `/api/heading-audit`, `/api/image-audit`, `/api/geo/check`), listing every protected route in comments.
  - Updated `src/app/api/ai-training/route.ts`: fail-closed `401` on `POST`/`PATCH`/`DELETE` when `SEO_STUDIO_API_BEARER_TOKEN` is missing in production/test; `GET` returns counts + provider flags only unless authenticated with a valid Bearer token.
  - Added `getOperatorToken`, `setOperatorToken`, `operatorAuthHeaders`, `apiFetch` in `src/lib/api.ts`; wired `src/lib/platform/client.ts`, all 17 `src/components/*.tsx` callers (plus bearer input in `AiTrainingModal.tsx`), and Chrome extension callers (`SidePanelApp.tsx`, `GeoVisibilityCard.tsx` via `loadExtensionOptions().apiToken`).
  - Documented `SEO_STUDIO_API_BEARER_TOKEN` in `.env.example`.
  - Recorded `D-025` through `D-030` in `docs/ml/DECISIONS.md`.
- **Defaults taken**:
  - Web Crypto SHA-256 + constant-time byte XOR instead of `node:crypto` so `requireOperator` runs inside Next.js Edge Middleware as well as Node routes.
  - Only `NODE_ENV === "development"` bypasses unset token with a warning; `test` and `production` both fail closed (`401`).
- **Remaining**: Proceed to WP2 (`ml/wp2-task-routing`).

## WP2 — Route Model Calls Through `ai/router.ts` (`ml/wp2-task-routing`)
- **Changed**:
  - Exported `V1_ADAPTER_TASKS = ["schema_generation", "metadata_generation"]` and `isV1AdapterTask` in `ai/router.ts` (re-exported in `src/core/claude.ts`).
  - Added optional `task?: TaskKind` to `generateClaudeText`; gated custom-model dispatch on `task` being in `V1_ADAPTER_TASKS` and `classifyTask(task) === "tier1"`. Untagged calls and Tier 2 / other Tier 1 calls skip the custom adapter.
  - Tagged 7 obvious call sites: `schema-markup` (`schema_generation`), `title-meta` (`metadata_generation`), `heading-structure` (`metadata_generation`), `image-optimization` (`alt_text_generation`), `brain` (`rag_synthesis`), `seo-baseline-ai-visibility` (`entity_gap_analysis`), and `keyword-research` (`intent_mapping`).
  - Expanded `tests/custom-model-provider.test.ts` to verify untagged, v1 Tier 1, and Tier 2/non-v1 task routing.
- **Defaults taken**:
  - Untyped/legacy callers (content generation, audit explanations, daily-session agents) remain untagged so they stay safely on the standard provider chain.
- **Remaining**: Proceed to WP3 (`ml/wp3-output-gates`).

## WP3 — Validate Adapter Output, Then Fall Back (`ml/wp3-output-gates`)
- **Changed**:
  - Exported the canonical 47-type Schema.org allow-list to `schemas/known-schema-types.json` and loaded it in both `ml/eval/run_eval.py` and TypeScript.
  - Created `src/core/ai/output-gates.ts` (`gateOutput`) validating `schema_generation` (JSON parse, known `@type`, ungrounded phone/address/price and metric checks) and `metadata_generation` (SERP pixel/char budgets via `validators/serpOptimizer.ts` plus brand check).
  - Updated `src/core/claude.ts` (`generateClaudeText`) to run `gateOutput` on adapter completions, retry once on the standard provider chain on failure, record structured counter metrics (`getAdapterGateCounters`), and never log prompts or outputs.
  - Added `tests/output-gates.test.ts` testing gate pass/fail, fallback routing, shared `KNOWN_SCHEMA_TYPES`, and no-prompt-logging.
- **Defaults taken**:
  - Supports both bare JSON-LD objects/`@graph` and task-wrapped `{ jsonLd }` / `{ rows: [{ proposedTitle, proposedMeta }] }` arrays so real task callers pass without translation glue.
- **Remaining**: Proceed to WP4 (`ml/wp4-registry-retirement`).

## WP4 — Registry Hygiene (`ml/wp4-registry-retirement`)
- **Changed**:
  - Updated `data/models/model_registry.json`: set `"activeModelId": null` and marked both legacy `gemini-1.5-flash-002` entries `"status": "retired"` under D-028.
  - Updated `ml/serve/registry.py` (`REGISTRY_STATUSES`, explicit refusal of `"retired"` even when `--allow-unverified` is passed).
  - Added `isRegistryModelSelectable` to `src/core/ai/custom-model.ts`, blocking retired Gemini 1.5 Flash IDs and any registry entry whose status is not `"ready"` in both `isCustomModelConfigured` and `callCustomModel`.
  - Updated `tests/python/test_model_registry_benchmark_labels.py`, `tests/python/test_ml_serve.py`, and `tests/custom-model-provider.test.ts` with retirement & non-ready refusal tests.
- **Defaults taken**:
  - Custom model IDs not listed in `data/models/model_registry.json` (excluding `gemini-1.5-flash*`) remain allowed when explicitly configured by env vars so pre-registration smoke tests keep working.
- **Remaining**: Proceed to WP5 (`ml/wp5-adapter-modes`).

## WP5 — Adapter Mode Flag & Shadow/Canary Modes (`ml/wp5-adapter-modes`)
- **Changed**:
  - Created `src/core/ai/adapter-mode.ts` (`AdapterMode = "off" | "shadow" | "canary" | "on"`, defaulting to `"off"`, plus `getAdapterCanaryPct`, FNV-1a `computeCanaryBucket`, and `shouldRouteCanary`).
  - Updated `src/core/claude.ts` (`generateClaudeText` accepting optional `propertyId` and `requestId`): implements `off`, `shadow` (concurrent adapter + standard execution via `Promise.allSettled`, always returns standard response, records gate & latency metrics without prompt/output logging), `canary` (deterministic split on `propertyId || requestId || "anonymous"`), and `on`. Updated `isClaudeConfigured` / `getActiveAiProviderLabel` accordingly.
  - Updated `schema-markup`, `title-meta`, and `heading-structure` tasks to pass `propertyId` and `brand` into `callClaude`.
  - Documented `AI_ADAPTER_MODE` and `AI_ADAPTER_CANARY_PCT` in `.env.example`, `docs/PLATFORM_RUNTIME.md`, and `D-031` in `docs/ml/DECISIONS.md`.
  - Updated `tests/custom-model-provider.test.ts` and `tests/output-gates.test.ts` for explicit `AI_ADAPTER_MODE=on` and added full rollout mode coverage (`off`, `shadow`, `canary`, `on`).
- **Defaults taken**:
  - Unset/unknown `AI_ADAPTER_MODE` fails conservatively to `"off"` (`D-031`), and missing seed falls back to `"anonymous"` so canary bucketing remains deterministic.
- **Remaining**: Proceed to WP6 (`ml/wp6-retrieval-isolation`).

## WP6 — Per-Client Retrieval Isolation (`ml/wp6-retrieval-isolation`)
- **Changed**:
  - Added optional `propertyId?: string` to `RagChunk`, `KnowledgeBaseSearchOptions`, and `ChunkDocumentInput` (`ai/types.ts`, `ai/rag/knowledge-base.ts`). Queries scoped to `propertyId` see only shared docs + that client's chunks; unscoped queries see shared docs only.
  - Updated `BrainRequest` / `runBrain` (`src/core/brain/index.ts`) and `/api/brain` (`src/app/api/brain/route.ts`) to forward optional `propertyId` into RAG lookup cleanly.
  - Added matching `property_id` isolation in `ml/retrieve/chunk.py` (`chunk_document`), `ml/retrieve/corpus.py` (`build_from_html`), and `ml/retrieve/store.py` (`VectorStore.search`/`search_text`, `PGVECTOR_DDL` `property_id` column + index, `export_rows`, `write_pgvector`, `pgvector_where_clause`).
  - Added `tests/rag-isolation.test.ts` and Python isolation tests in `tests/python/test_ml_retrieve.py`.
- **Defaults taken**:
  - Chunks with missing/empty `propertyId` are treated as shared public docs (`Google Search Central`, `schema.org`), while any non-empty `propertyId` stays strictly tenant-scoped.
- **Remaining**: Proceed to WP7 (`ml/wp7-constrained-decoding`).

## WP7 — Constrained Decoding Schema & `ml/generate/` (`ml/wp7-constrained-decoding`)
- **Changed**:
  - Defined `SchemaGenerationAnswerSchema` and `MetadataGenerationAnswerSchema` in `schemas/ml-v1-outputs.ts` reusing `schemas/known-schema-types.json` and `schemaMarkupItemSchema`.
  - Updated `scripts/export-json-schemas.ts` to export self-contained Draft-07 JSON Schemas (`schemas/ml-schema-generation.schema.json` and `schemas/ml-metadata-generation.schema.json`).
  - Created `ml/generate/` (`constrained.py`, `__init__.py`) loading the exported JSON Schemas directly (`load_task_json_schema`, `build_json_schema_response_format`, `generate_structured`) with lazy `outlines` import raising `HeavyDepsError` when absent.
  - Wired optional `task` support (`schema_generation`, `metadata_generation`) into `ml/serve/server.py` (`ModelGateway.chat`) to constrain local adapter generation via `ml/generate` and attach OpenAI-compatible `response_format` when forwarding to `--upstream`.
  - Added `tests/python/test_ml_generate.py` and `tests/ml-schema-exports.test.ts`.
- **Defaults taken**:
  - Inline `$refStrategy: "none"` for the two v1 decoding schemas so downstream constrained generators receive self-contained schemas without local `$ref` resolution.
- **Remaining**: Proceed to WP8 (`ml/wp8-dataset-v2`).

## WP8 — Host-Split Dataset Builder v2 (`ml/wp8-dataset-v2`)
- **Changed**:
  - Created `ml/train/build_sft.py` writing gitignored `data/build/sft-v2.jsonl` + `data/build/sft-v2.report.json`.
  - Restricted jobs strictly to `schema_generation` (`wdc-2024`, `wdc-tables-2023`, `vault`, `patches`, `triples` passing `jsonld_valid` and `scripts/ml-label-cli.ts` clean validation when HTML is present) and `metadata_generation` (`vault`, `patches`, `triples` only — no Common Crawl or Lighthouse).
  - Refuses `synthetic: true` and `repo-synthetic` rows lacking explicit human review marks (`D-026`), strips PII, enforces 90/10 deterministic host-hash splits with zero host overlap, and excludes frozen golden-set hosts.
  - Updated `ml/train/sft.py` `DEFAULT_DATA` to `data/build/sft-v2.jsonl` and extended `scripts/validate-training-data.mjs` (`npm run train:validate`) to validate `data/build/sft-v2.jsonl` automatically when present.
  - Added `tests/python/test_ml_build_sft.py` verifying source gates, synthetic/review rejection, host isolation, golden exclusion, report counts, and JS validator roundtrip.
- **Defaults taken**:
  - Normalized registrable hosts collapse `www.` and multi-label subdomains (handling common 2-level public suffixes) into one `hostHash` per domain so subpages share the same split.
- **Remaining**: Proceed to WP9 (`ml/wp9-golden-v2`).

## WP9 — Golden Set v2 Scaffolding & Candidate CLI (`ml/wp9-golden-v2`)
- **Changed**:
  - Kept the frozen 52-case `ml/eval/golden/cases.jsonl` and its `docs/ml/DATA_CARD.md` hash untouched.
  - Created `ml/eval/golden_v2/README.md` + `ml/eval/golden_v2/cases.jsonl` targeting `>= 75` `schema_generation` and `>= 75` `metadata_generation` human-reviewed cases on held-out hosts.
  - Created `scripts/check-golden-v2.ts` (`evaluateGoldenV2`) enforcing `MlGoldenCaseSchema`, `humanReviewed: true`, licence/registry parity, zero host/hash overlap with train split, and `--strict` 75/75 coverage (wired `--allow-partial` into `npm run train:validate` and added `ml:golden-v2:check` / `ml:golden-v2:propose` scripts to `package.json`).
  - Created `ml/eval/propose_golden_v2.py` to generate unreviewed (`humanReviewed: false`) candidates strictly excluding training & frozen golden hosts.
  - Added `tests/golden-v2-check.test.ts` and `tests/python/test_ml_golden_v2.py`.
- **Defaults taken**:
  - Scaffolding starts `ml/eval/golden_v2/cases.jsonl` empty (`--allow-partial` in CI `train:validate`) rather than committing unreviewed or fabricated rows, while `--strict` blocks promotion until `75` schema + `75` metadata human-reviewed cases exist.
- **Remaining**: Proceed to WP10 (`ml/wp10-gpu-runbook`).

## WP10 — Update `docs/ml/GPU_RUNBOOK.md` (`ml/wp10-gpu-runbook`)
- **Changed**:
  - Updated `docs/ml/GPU_RUNBOOK.md` with exact copy-paste v1 commands across Steps 1–7 (`ml.train.build_sft`, baseline `ml.train.evaluate --endpoint` comparisons against untuned `Qwen/Qwen3-1.7B` and current free provider at temperature 0, QLoRA `0.6B -> 1.7B -> 4B` `< 9h` runs, private HF upload via `ML_PRIVATE_DATASET_REPO`, 11-gate `ml.serve.register` promotion, `shadow -> canary -> on` progressive app rollout via `AI_ADAPTER_MODE`/`AI_ADAPTER_CANARY_PCT`, and instant rollback).
  - Documented mandatory v1 ship gates (`schema`: `jsonld_valid >= 95%`, `invented_metrics = 0`; `metadata`: `title_budget >= 90%`; beat both untuned base and free provider).
- **Defaults taken**:
  - Aligned config paths cleanly to `ml/train/config.py`'s real defaults (`ml/train/outputs/<runId>/adapter`, `data/build/sft-v2.jsonl`, `data/build/sft-v2.report.json`).
- **Remaining**: Proceed to WP11 (`ml/wp11-progress-docs`).
