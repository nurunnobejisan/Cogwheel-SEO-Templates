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
