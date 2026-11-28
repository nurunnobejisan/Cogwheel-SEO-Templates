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

## WP11 — Progress Docs & Final Readiness Summary (`ml/wp11-progress-docs`)
- **Changed**:
  - Updated `docs/ml/PROGRESS.md` with Phases 6–12 tracking (`in progress` for pending stacked PRs `WP1`–`WP11`, `not started` for operator GPU training and production rollout; no fabricated score numbers).
  - Finalized `docs/ml/AGENT_LOG.md` with the 5 readiness summary blocks below.

### 1. What Changed Across WP1–WP11
- `ml/wp1-operator-auth`: Edge + Node Web Crypto constant-time bearer auth (`src/lib/security/operator.ts`), middleware protection on all API writes + costly GET routes (`src/middleware.ts`), redacted unauthenticated GET `/api/ai-training`, client + Chrome extension bearer forwarding.
- `ml/wp2-task-routing`: Strict v1 adapter scope (`V1_ADAPTER_TASKS = ["schema_generation", "metadata_generation"]` in `ai/router.ts`), optional `task` wiring in `generateClaudeText` and 7 obvious task callers; Tier 2 and untagged prompts stay off the adapter.
- `ml/wp3-output-gates`: Canonical `schemas/known-schema-types.json` shared between `ml/eval/run_eval.py` and `src/core/ai/output-gates.ts` (`gateOutput`), single retry fallback on standard/free chain, counter metrics without prompt/output logging.
- `ml/wp4-registry-retirement`: Retired Gemini 1.5 Flash entries (`activeModelId: null`, `"status": "retired"` in `data/models/model_registry.json`), enforced non-servable rejection in `ml/serve/registry.py` and `isRegistryModelSelectable` in `src/core/ai/custom-model.ts`.
- `ml/wp5-adapter-modes`: Added `AI_ADAPTER_MODE=off|shadow|canary|on` (default `off`) and `AI_ADAPTER_CANARY_PCT` (default `0`) in `src/core/ai/adapter-mode.ts` and `src/core/claude.ts` (concurrent shadow evaluation, deterministic FNV-1a bucketing by `propertyId`/`requestId`), documented in `.env.example`, `docs/PLATFORM_RUNTIME.md`, and `D-031`.
- `ml/wp6-retrieval-isolation`: Enforced optional `propertyId` tenant scoping across TypeScript (`ai/types.ts`, `ai/rag/knowledge-base.ts`, `src/core/brain/index.ts`, `/api/brain`) and Python (`ml/retrieve/chunk.py`, `ml/retrieve/corpus.py`, `ml/retrieve/store.py` including `PGVECTOR_DDL` + `pgvector_where_clause`).
- `ml/wp7-constrained-decoding`: Added `schemas/ml-v1-outputs.ts` exported to `ml-schema-generation.schema.json` and `ml-metadata-generation.schema.json`, lazy-`outlines` `ml/generate/constrained.py`, and `ml/serve/server.py` `task` integration.
- `ml/wp8-dataset-v2`: Created `ml/train/build_sft.py` producing gitignored `data/build/sft-v2.jsonl` + `data/build/sft-v2.report.json` with source allow-lists per v1 job, D-026 human-review checks, deterministic 90/10 host-hash isolation, golden-host exclusion, `sft.py` default update, and `validate-training-data.mjs` v2 support.
- `ml/wp9-golden-v2`: Preserved frozen v1 golden set; scaffolded `ml/eval/golden_v2/` (`75` schema + `75` metadata target), `scripts/check-golden-v2.ts` (`--allow-partial` / `--strict`), and `ml/eval/propose_golden_v2.py` (`humanReviewed: false` candidate generator).
- `ml/wp10-gpu-runbook`: Updated `docs/ml/GPU_RUNBOOK.md` with Steps 1–7 commands and temperature-0 ship gates.
- `ml/wp11-progress-docs`: Updated `docs/ml/PROGRESS.md` Phases 6–12 and finalized this log.

### 2. Defaults & Architectural Decisions
- Recorded `D-025` through `D-031` in `docs/ml/DECISIONS.md` (strict `V1_ADAPTER_TASKS`, D-026 human review requirement for synthetic rows, Qwen3 0.6B->1.7B->4B progression, Gemini 1.5 Flash retirement, schema-first rollout order, Web Crypto Edge+Node operator guard, and `AI_ADAPTER_MODE=off` safe default).

### 3. Human Operator Action Items (Before Shipping v1 Model)
1. Review and merge stacked PRs `ml/wp1`..`ml/wp11` in exact branch order (`main <- wp1 <- wp2 ... <- wp11`).
2. Configure `SEO_STUDIO_API_BEARER_TOKEN` in Vercel production env (and operator browser/extension storage) plus confirm Vercel Deployment Protection settings on preview deployments.
3. Populate and manually review `ml/eval/golden_v2/cases.jsonl` (`humanReviewed: true`, `>= 75` schema + `>= 75` metadata on held-out hosts) and verify with `npx tsx scripts/check-golden-v2.ts --strict`.
4. Follow `docs/ml/GPU_RUNBOOK.md` Steps 1–5 on Kaggle/Colab (`ml.train.build_sft`, baseline `evaluate --endpoint`, QLoRA training `< 9h`, private HF upload, `run_eval.py` ship gates, `ml.serve.register --active`).
5. Enable `CUSTOM_MODEL_*` + start with `AI_ADAPTER_MODE=shadow`, verify gate telemetry, then progress `canary` -> `on` (`schema_generation` first).

### 4. Known Scope Boundaries
- No GPU training (`torch`, `transformers`, `peft`, `trl`, `unsloth`, `outlines`, `psycopg`) ran locally; heavy ML paths remain cleanly gated behind `HeavyDepsError` / `RuntimeError`.
- `ruff` CLI is unavailable in local PATH; Python modules conform to stdlib-only CI constraints (`D-014`).
- Frozen `ml/eval/golden/cases.jsonl` (`52` cases) and `ml/sources.yaml` (`use:` / `feeds:`) remain completely untouched.

### 5. Status
- **Ready for stacked GitHub PR creation (`ml/wp1-operator-auth`..`ml/wp11-progress-docs`) and final full-suite verification.**

---

# SEO-Studio AI SEO Model (v2) — Agent Log

## v2 start — 2026-11-29

### Step 0 — what v1 actually finished

All eleven v1 work packages are **merged to `main`** (see the v1 log above;
branches `ml/wp1`…`ml/wp11` arrived via stacked PRs; PR #78 restored files
dropped during rebases). Verified on `origin/main` at `06ad170`:

| v1 capability | Status | Where |
|---|---|---|
| Operator auth | merged | D-030: `requireOperator` in `src/lib/security/operator.ts`, fail-closed bearer guard |
| Task routing through `ai/router.ts` | merged | `routeTask`, tiers, `V1_ADAPTER_TASKS` scope (D-025) |
| Output gates with fallback | merged | `src/core/ai/output-gates.ts` (`gateOutput`), wired into `generateClaudeText` |
| `AI_ADAPTER_MODE` (off/shadow/canary/on) | merged | D-031: `src/core/ai/adapter-mode.ts` + `src/core/claude.ts`, default `off` |
| Per-client retrieval isolation | merged | `ml/retrieve/*` tenant scoping, `tests/rag-isolation.test.ts` |
| `ml/generate/` | merged | WP7: `ml/generate/constrained.py` (lazy `outlines`), decoding schemas in `schemas/ml-v1-outputs.ts` |
| Dataset v2 builder | merged | WP8: `ml/train/build_sft.py` (host split, source gates, report) |
| Golden v2 scaffolding | merged | WP9: `ml/eval/golden_v2/cases.jsonl` (75+75 candidates, `humanReviewed: false`), `scripts/check-golden-v2.ts` |
| GPU runbook | merged | WP10: `docs/ml/GPU_RUNBOOK.md` (v1 commands, ship gates, rollout) |
| Serving + promotion | merged | `ml/serve/server.py`, `ml/serve/register.py` (11-gate chain), `ml/serve/registry.py` |
| Endpoint evaluation | merged | `ml/train/evaluate.py --endpoint`, `ml/eval/run_eval.py` |
| DPO trainer (gates) | merged | `ml/train/dpo.py` — no pair **builder** yet (v2 WP2 adds it) |

Adapter reality:

* **No adapter has `status: ready`.** Both registry entries are retired
  (D-028); only QLoRA runs promoted via `ml.serve.register` may hold `ready`.
* **No measured scores exist.** The score log has no numeric row — no GPU run
  has happened. Nothing was fabricated.
* Golden v2's 150 candidate cases and the teacher triples have **no
  human-approved rows yet** (`humanReviewed: false` by design until an
  operator decides).

### Consequences for this run

Base branch: `main`. Branches stacked `ml/v2-wp1-*` onward. Every
`[needs measured adapter]` code path ships behind flags defaulting to off,
tested with stubs; no result is faked.

### Scoping note (honest)

This run implements WP1 (review queue), WP2 (DPO builder), WP3 (readyTasks),
WP8 (extension guard), WP9 (weekly refresh) and WP10 (model card template +
proposal). WP4 (Tier 2 slices), WP5 (classifier training), WP6 (monitoring +
circuit breaker) and WP7 (serving hardening) are **not started** here; the
"v2 end" section records them as missing with reasons.

---

## WP1 — Human review queue (branch `ml/v2-wp1-review-queue`, PR #79)

Built this run:

- **Core** `src/core/review/queue.ts` — row/decision types and the pure
  invariants: a decision requires an authenticated reviewer; decisions are
  immutable; a rejected row is never train-eligible; `edit_and_approve` keeps
  the original candidate output as `originalOutput` provenance.
- **Store** `src/lib/review/store.ts` — JSONL store in the app's data
  directory (D-033); idempotent `syncQueue` ingests raw-tier teacher triples
  plus the `ml-review/golden-candidates.jsonl` and
  `ml-review/shadow-disagreements.jsonl` producer files; `recordDecision`
  mirrors an approve into the triple store (`reviewed` tier, D-034);
  `exportApproved` emits the three consumer formats (sft chat rows, dpo
  preference pairs, golden-v2 cases with deterministic 64-hex ids).
- **API** `src/app/api/review-queue` — operator-only GET (snapshot + export)
  and POST (approve / edit-and-approve / reject, optional reason). No auth →
  401 on every handler; only these handlers set `reviewed: true`.
- **Page** `/settings/ai-training/review` (`ReviewQueueClient`) inside the
  Train AI area, linked from the AI Training page for operators.
- **Migration** `supabase/migrations/0006_ml_review_queue.sql` (mirror table,
  D-033).
- **Tests** `tests/review-queue.test.ts` — 17 passing: auth 401s, immutable
  decisions, anonymous refusal, reject-never-trains (all three exports empty,
  triple stays `raw`), edit provenance, format exports, producer sync
  idempotence.

Notes: shadow-disagreement producer rows are consumed here but written by
WP3; until then that queue is empty by design. No review row was approved in
this run — approvals are human actions only.

---
## WP2 — DPO data + feedback loop (branch `ml/v2-wp2-dpo-builder`)

Built this run:

- **`ml/train/build_dpo.py`** — builds gitignored `data/build/dpo-v2.jsonl` +
  `data/build/dpo-v2.report.json` from three first-party sources:
  1. healing approved-vs-rejected patches (`data/ml-review/healing-decisions.jsonl` → source `patches`);
  2. vault approve/reject pairs (`data/ml-review/vault-decisions.jsonl` → source `vault`);
  3. WP1 review-queue decisions on shadow-mode disagreements
     (`data/ml-review-queue.jsonl` → source `triples`; chosen = the approved
     output, rejected = the original candidate). A **rejected review row never
     becomes a pair** (structurally excluded at load).
  Producer decision records are grouped by input fingerprint; an input with
  only one decision kind is counted, never paired (a single outcome is not a
  preference signal).
- **Gates** (same family as `build_sft.py`/`dpo.py`): licence registry per
  source, first-party consent + tenantId, synthetic ban, `chosen == rejected`
  refused before *and after* PII stripping, golden-content refusal, golden
  host exclusion, deterministic 90/10 host split via
  `build_sft.assign_host_split`, PII stripping, counts report
  (`refusedByReason`, `byOrigin`, `bySplit`, `piiStripped`, output sha).
- **`ml/train/dpo.py`** — `--pairs` now defaults to the builder output; rows
  are gated by their **own** declared `metadata.source` (patches/vault/triples
  mixed files work); the 2000-pair client gate applies when client-derived
  rows are in scope.
- **Runbook** — new Step 1b with build + train commands and the DPO ship gate
  ("DPO beats SFT on golden, no gate regresses"). `npm run ml:dpo:build` added.
- **Tests** — `tests/python/test_ml_build_dpo.py` (9 passing): three-source
  load, reject-never-pairs, consent gate, golden-host refusal, chosen==rejected
  before/after PII, host split + report counts, `dpo.py` default path +
  per-row gating, missing producers report zero, missing pair file raises.
  Existing `test_ml_train.py` (58) unchanged and green.

Data reality: with no healing/vault producer exports and no approved review
rows yet, a builder run today writes 0 pairs and a truthful zero report. The
feedback loop fills as operators use the WP1 queue and the healing/vault
exports land.
