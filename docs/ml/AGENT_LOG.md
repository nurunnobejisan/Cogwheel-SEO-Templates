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
