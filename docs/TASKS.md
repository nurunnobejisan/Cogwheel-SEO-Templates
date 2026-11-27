# MASTER RUN: SEO Studio to Universal SEO & GEO Studio — Backlog & Task Registry

## Run: Put every useful piece of SEO-Studio to work (Phase 0 → H)

Order is fixed; one phase = one PR; PR links land in `docs/PROGRESS.md`.

- [x] **Phase 0 — vendor `xlsx`** (PR #21): `file:vendor/xlsx-0.20.3.tgz` + `tests/vendor-dependencies.test.ts`.
- [x] **Phase A — trust fixes** (PR #30): batch audits call the real `/api/full-audit` (no `Math.random()` scores, `unavailable` on failure), `ENABLE_FREE_ONLINE_AI` is opt-in with a UI warning, auto-fix writes only page/profile-sourced copy (blank + flagged otherwise), in-memory stores are labelled ephemeral with client/property-scoped crawl cache keys, and the model-registry benchmark is labelled a lexical proxy.
- [x] **Phase B — shared TS package and dedupe** (PR #32): `shared/ts/` (`training-vault`, `dataset-builder`, `training-capture`) is now the single source for both trees; the extension keeps a thin consent-gate wrapper at its old vault path, the dead app copies of `background/auto-updater.ts`/`types/updater.types.ts` are deleted (extension survivors unchanged), parity tests assert function identity, and `tests/shared-ts-single-source.test.ts` + gate/PII suites guard the split.
- [x] **Phase C — packs + universal engine** (PR #33): hotel matrix → `src/packs/hotel/keywords.json` (illustrative CPCs + provenance notes), hotel pack extracted to `src/packs/hotel/`, five universal packs (`ecommerce`, `local-business`, `saas`, `publisher`, `finance`) with 78-row matrices and shared `GENERIC_BRAND_GUARDRAILS`, pack selector + `suggestPack()` in the extension, pack-weighted `calculateSeoScores` at every call site, rule-based page-type confidence pill, pack-driven `/strategy-matrix?pack=` with target-page cluster view + dataset disclaimer + template `noindex`, and universal suite branding (hotel as Pack #1).
- [x] **Phase D — Python service (FastAPI `api/server.py`, HTTP bridges)**: `api/server.py` serves the `api/` libraries over HTTP (`GET /health`, `POST /v1/content/similarity`, `POST /v1/content/link-graph`, `POST /v1/reports/seo-visibility`) behind fail-closed auth (bearer when `SEO_PY_SERVICE_TOKEN` is set, loopback-only otherwise — HTTP 403 for non-loopback peers, CLI refuses a non-loopback bind without token + `SEO_PY_SERVICE_ALLOW_REMOTE=1`) and strict payload/upload caps; `src/lib/python/service.ts` is the env-only, timeout-bounded Node client; `POST /api/content-similarity` bridges the content engine with zod caps mirroring the Python side; `/api/seo-visibility-report` now prefers the HTTP bridge (configured `PYTHON_SERVICE_URL` = operator opt-in), then the local `execFile` path behind `COGWHEEL_ALLOW_LOCAL_PYTHON=1`, then 501 — nothing runs by default.
- [ ] **Phase E — one template renderer + validators wired**
- [ ] **Phase F — AI/ops layer**
- [ ] **Phase G — legacy Python/CI scripts/GSC MCP docs**
- [ ] **Phase H — orphaned UI/e2e/docs sync**
- [ ] **Final — `scripts/find-orphans.py` + CI gate on unreachable product modules**

## Backlog

### Phase 1: Safety Net (Tests First)
- [x] **Task 1.1: Vitest Sanitizer Suite** (Est: 15m)
  - *Done-Criterion*: Comprehensive negative (prices, years, ZIP codes, order numbers) and positive (phones with separators/+, emails, JWTs, API keys, card-like numbers) tests passing 100% in `tests/sanitizer.test.ts`.
- [x] **Task 1.2: Training-Capture Extractor Tests with Local Fixtures** (Est: 20m)
  - *Done-Criterion*: HTML fixtures for static page, shadow DOM, same-origin iframe, SPA route change, cookie banner, and password field (must not capture) passing in `tests/training-capture-fixtures.test.ts`.
- [x] **Task 1.3: Vault Migration, ContentHash Dedupe, and Sync Client Resilience Tests** (Est: 20m)
  - *Done-Criterion*: Unit tests verifying v1/v2/v3 vault migrations, contentHash versioning & dedupe, and mock API client exponential backoff and idempotency passing in `tests/vault-sync-resilience.test.ts`.
- [ ] **Task 1.4: Fix Real Bugs Exposed by Phase 1 Tests** (Est: 15m)
  - *Done-Criterion*: Any edge cases or regressions found in extractors/sanitizers fixed, verified, and logged in `PROGRESS.md`.

### Phase 2: Core Plus Vertical Packs
- [x] **Task 2.1: Create Packs Core Interface & Registry (`packs/`)** (Est: 20m)
  - *Done-Criterion*: Typed `Pack` interface defined (`id`, `name`, `pageTypes`, `scoringWeights`, `checklist`, `schemaRules`, `keywordMatrix`, `brandGuardrails`, `aiPrompts`) in `src/packs/types.ts` and exported via `src/packs/index.ts`.
- [x] **Task 2.2: Extract Hotel Pack (`packs/hotel/`)** (Est: 20m)
  - *Done-Criterion*: Hotel brand guardrails, schema rules, OTA config, and templates modularized into `src/packs/hotel/`. All existing hotel tests pass without regression.
- [x] **Task 2.3: Implement Universal Vertical Packs** (Est: 30m)
  - *Done-Criterion*: Real checklists, schema rules, scoring weights, and 6-group x 13 keyword matrices (78 keywords with placeholders like `{{brandName}}`, `{{cityName}}`, `{{productName}}`) implemented for: `ecommerce`, `local-business`, `saas`, `publisher`, `finance`.
- [x] **Task 2.4: Pack Selector & Auto-Suggestion Engine** (Est: 20m)
  - *Done-Criterion*: Side panel and options UI allow manual pack selection, stored in extension settings; heuristics auto-suggest pack based on schema types, URL patterns, and keywords.

### Phase 3: Page-Type Detection and Scoring
- [x] **Task 3.1: Rule-Based Page-Type Classifier with Confidence** (Est: 20m)
  - *Done-Criterion*: Page-type classifier categorizes `home`, `product`, `category`, `article`, `location`, `booking/checkout`, `contact`, `other` with numerical confidence (0-100) and unit test verification.
- [x] **Task 3.2: Per-Page-Type Dynamic Scoring** (Est: 20m)
  - *Done-Criterion*: Audit scores calculated dynamically using selected pack's page-type weights. UI displays detected page type and confidence pill.
- [x] **Task 3.3: Contextual Schema Validation Rules** (Est: 20m)
  - *Done-Criterion*: Category/listing pages validate and recommend `CollectionPage`/`ItemList`; standalone `Offer` validates parent entity attachment (`Product`/`Hotel`/`Service`).

### Phase 4: Strategy Matrix as Data
- [x] **Task 4.1: Convert 78-Keyword Matrices to JSON Datasets** (Est: 20m)
  - *Done-Criterion*: Structured keyword matrix JSON generated for all packs (`src/packs/<pack>/keywords.json`) adhering to schema with `cpcEstimate` marked with `source: "illustrative"`.
- [x] **Task 4.2: Dynamic Pack-Driven `/strategy-matrix` Route** (Est: 25m)
  - *Done-Criterion*: `/strategy-matrix` route dynamically renders from active pack data; page titles, meta descriptions, and brand badges adapt to the selected vertical.
- [x] **Task 4.3: Cluster & Target-Page View** (Est: 20m)
  - *Done-Criterion*: UI view grouping keywords by target page with 1 primary keyword per cluster, highlighting overlapping variants.
- [x] **Task 4.4: Explanatory Disclaimer & Template Noindex Guardrails** (Est: 15m)
  - *Done-Criterion*: Clear notice clarifying template placeholders vs live content; `noindex` robots meta added for non-ranking customization templates.

### Phase 5: Training Data Quality & SFT Automation
- [x] **Task 5.1: Pack & Page-Type Provenance Tagging** (Est: 15m)
  - *Done-Criterion*: Every captured web sample, vault record, and JSONL export record includes `pack` and `pageType`.
- [ ] **Task 5.2: Review Status Gate for Training Exports** (Est: 20m)
  - *Done-Criterion*: Samples track `reviewStatus: "pending" | "approved" | "rejected"`; dataset exporters strictly filter for `approved` samples with `qualityScore >= 70`.
- [ ] **Task 5.3: Python Pipeline & Pydantic Model Alignment** (Est: 25m)
  - *Done-Criterion*: Pydantic models in `python/scripts/models.py` and `fine_tune_pipeline.py` updated with new provenance and status fields; ruff, mypy, and pytest tests pass 100%.
- [ ] **Task 5.4: 25-Page Benchmark Suite & Evaluator CLI** (Est: 25m)
  - *Done-Criterion*: 25 HTML fixture pages with expected audit goldens created; automated evaluation script benchmarks model or rule engine accuracy.

### Phase 6: Universal Naming & Documentation
- [x] **Task 6.1: Universal Studio Branding & Manifest Update** (Est: 15m)
  - *Done-Criterion*: User-facing text updated from hotel-only to Universal SEO & GEO Studio with hotel as Pack #1. Extension manifest name & description updated.
- [x] **Task 6.2: Comprehensive Documentation & Pack Guide** (Est: 20m)
  - *Done-Criterion*: `README.md`, `docs/ARCHITECTURE.md`, `docs/assets/system-architecture.svg` updated, and new `docs/PACKS.md` created detailing how to author a custom vertical pack.
