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
