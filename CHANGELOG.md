# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Six vertical packs** (`src/packs/`): Hotel & Hospitality extracted into `src/packs/hotel/` (brand guardrails, templates, schema rules, derived checklist; the extension keeps a re-export wrapper at its old guardrails path) plus five universal packs — `ecommerce`, `local-business`, `saas`, `publisher`, `finance` — each with a 78-row, 6-category × 13 keyword matrix (`cpcEstimate.source: "illustrative"` and a provenance note stating the bands are planning aids, not measured data), six contextual schema rules with operator-facing rationales, a real audit checklist and scoring weights read from the pack catalog. All non-hotel packs share one `GENERIC_BRAND_GUARDRAILS` object; hotel carries its five franchise rulebooks plus that same `Generic` rule. The light `src/packs/catalog.ts` (identity/weights/signals only) serves the extension, `src/packs/all.ts` serves server and tests, and `tests/packs-parity.test.ts` fails the moment the two views drift.
- **Pack selector and auto-suggestion** (extension settings + sidepanel + options page): `activePack` lives in `ExtensionOptions` (defaults to hotel; pre-Phase-C settings back-compat-merge), and a deterministic `suggestPack()` heuristic over schema types, URL patterns and topic keywords offers a one-click switch that never overrides the operator by itself. Covered by `tests/pack-extension-settings.test.ts` and `tests/pack-suggest.test.ts`.
- **Pack-weighted scoring and page-type confidence pill (Task 3.2)**: `calculateSeoScores(data, weights?)` composites with the active pack's `{onPage, schema, geoAi}` weights at every call site (background badge, side panel fetch/render, popup, competitor compare — storage-fresh reads, no stale closures), and the content script attaches a rule-based `pageType` / `pageTypeConfidence` / `pageTypeSignals` classification that the side panel renders as a pill, explicitly labelled a heuristic rather than a measurement.
- **Pack-driven `/strategy-matrix` route (Tasks 4.2–4.4)**: `?pack=` renders any pack's dataset through `generateMetadata` (per-pack titles 50–60 chars and descriptions 145–155 chars, unique across packs and every other route), with a pack switcher, a target-page cluster view (exactly one primary keyword per cluster, deterministic illustrative-tier ordering, schema/intent overlap flags), a dataset disclaimer clarifying that `{{placeholders}}` are template-engine variables rather than live content and that volume/CPC figures are illustrative, and `robots: noindex` on template detail pages. Covered by `tests/strategy-matrix-route.test.ts`.
- **Universal suite branding (Task 6.1)**: root/home/templates metadata, the README tagline and overview, and the extension manifest description now frame the product as the universal SEO & GEO Studio with six vertical packs (hotel as Pack #1); options consent copy is vertical-neutral. Covered by `tests/branding-universal.test.ts`.
- **Python FastAPI service and Node HTTP bridges (Phase D)**: `api/server.py` serves the `api/` libraries over HTTP — `GET /health`, `POST /v1/content/similarity` (TF-IDF/Jaccard thin-content + duplicate audit), `POST /v1/content/link-graph`, and `POST /v1/reports/seo-visibility` (multipart template/xlsx/pdf → built pptx) — behind fail-closed security: optional `SEO_PY_SERVICE_TOKEN` bearer with constant-time compare, loopback-only access when no token is set (HTTP 403 for non-loopback peers on `/v1/*`, CLI refuses non-loopback binds without token + `SEO_PY_SERVICE_ALLOW_REMOTE=1`), strict payload/upload caps rejected before any work, extension-allow-listed uploads spooled under server-generated names, and no shell or module-level mutable state anywhere. On the Node side, `src/lib/python/service.ts` is an env-only, timeout-bounded client (server env is never request-derived, so the bridge cannot be steered), `POST /api/content-similarity` exposes the content engine with zod caps mirroring the Python side (`501` when `PYTHON_SERVICE_URL` is unset), and `/api/seo-visibility-report` now prefers the HTTP bridge, then the existing local `execFile` opt-in, then `501` — nothing runs by default. `requirements.txt` gains `fastapi`, `uvicorn`, `httpx`, `python-multipart`. Covered by `tests/python/test_api_server.py` (13, including a real end-to-end deck build with zero network) and `tests/python-service-bridge.test.ts` (21).

### Changed
- **One shared TS source for the training stack** (`shared/ts/`, `chrome-extension/src/storage/training-vault.ts`): the app and extension copies of `training-vault.ts`, `dataset-builder.ts` and `training-capture.ts` are merged into `shared/ts/` (the vault merge keeps the extension superset — `stripTrainingPii` plus an exported `migrateRecordToV3`). The extension keeps a thin wrapper at its old vault path that only registers the consent/allow-list persistence gate, so extension behaviour is unchanged; the app now also strips PII before persisting. The dead byte-identical app copies of `background/auto-updater.ts` and `types/updater.types.ts` were deleted (the extension copies survive unchanged) and both old extension copies of the moved modules are gone — no module exists in both trees any more. The two copy-parity suites now assert function identity through the wrapper instead of comparing forks; new coverage in `tests/shared-ts-single-source.test.ts` (single-source + source guards + deleted-copy check), `tests/training-vault-gate.test.ts` (3) and `tests/training-vault-pii.test.ts` (2).

### Fixed
- **Batch audits stopped fabricating scores** (`chrome-extension/src/components/AutomationBulkRunner.tsx`, `chrome-extension/src/engine/full-audit-client.ts`): the multi-property runner now POSTs every URL to the live `/api/full-audit` endpoint (3 audits in flight, cancellable with Stop and on unmount) instead of filling rows from `Math.random()`. A failed or cancelled row shows `unavailable` with the reason, blanks sort last and export as empty (never `0`), and grades/colour come from one measured-score function. Covered by `tests/full-audit-client.test.ts` (15 tests).
- **Keyless AI is now opt-in** (`src/core/claude.ts`, `.env.example`): the Pollinations fallback runs only when `ENABLE_FREE_ONLINE_AI` is the literal string `true` (`1`, `0`, `false`, unset all mean off), so an accidental value can no longer route traffic to an unvetted endpoint. `/api/ai-training` returns `providerIsFreeOnline`, and the dashboard and suite show an amber warning while it is on. **Ops note: set `ENABLE_FREE_ONLINE_AI=true` in Vercel to keep keyless AI.** Covered by `tests/free-online-ai-gate.test.ts`.
- **Auto-fix no longer writes invented copy** (`chrome-extension/src/sidepanel/SidePanelApp.tsx`, `chrome-extension/src/engine/auto-fix-copy.ts`): title, meta description, H1, Open Graph tags and JSON-LD are built only from the page itself or the saved client profile — a missing value stays blank, is listed in the drawer ("Not populated (no verified source)"), and rules-engine output is labelled as a template suggestion. The hardcoded SpringHill FAQ answers, stock photo, invented address/phone/coordinates/amenities and the "Premier hospitality destination" description are gone; FAQ schema is never injected without verified answers. Covered by `tests/auto-fix-copy.test.ts` (12 tests, including a source guard).
- **Ephemeral storage is labelled and cache keys are scoped** (`src/core/storage.ts`, `src/core/property.ts`, `src/core/crawler/*`, `/api/crawl-property`, `src/components/Studio.tsx`): every in-memory store reports a `StorageDescriptor` (`persistent: false` → "in-memory (ephemeral — this server instance only)"), the crawl response carries it, and the Studio shows an ephemeral-storage notice instead of implying durability. Crawl cache keys now lead with the client/property `scopeKey`, so two owners can never share a cached result. Covered by `tests/ephemeral-storage.test.ts` (11 tests, including the SSRF fail-closed case).
- **Model-registry benchmark numbers are labelled, not presented as results** (`data/models/model_registry.json`, `python/scripts/train_unified_model.py`): each `evaluationBenchmark` carries `provenance: "lexical-proxy"`, `measured: false` and a note pointing at `ml/eval/run_eval.py`, and the training script prints "lexical-proxy score" instead of "Model Readiness Score". Covered by `tests/python/test_model_registry_benchmark_labels.py`.
- **`xlsx` no longer installs from a CDN** (`package.json`, `vendor/xlsx-0.20.3.tgz`): the dependency now points at a vendored Apache-2.0 tarball committed to the repo (`file:vendor/xlsx-0.20.3.tgz`), so a clean clone and any sandbox without access to `cdn.sheetjs.com` install and build green. `tests/vendor-dependencies.test.ts` locks the manifests, the tarball's sha512 and the installed version together.

### Added
- **Operator console · Outcomes tab** (`src/components/PlatformPanels.tsx`, `OperatorConsole.tsx`): surfaces the outcome log and L2 judgment. Shows tracked changes with their latest Search Console before/after (clicks/impressions/position + control delta, each tagged `measured`/`unavailable`), and per-change-kind effect estimates with confidence, sample size, positive share and caveats. "Measure all" and "Recompute" act through `/api/outcomes`. Read-only evidence — nothing is fabricated or attributed to a page.
- **Free-first, centralized AI model config** (`src/core/ai/models.ts`): one env-overridable table for every provider/model, defaulting to free tiers and never requiring a paid key. `claude.ts`, `ai/router.ts` and the visibility adapters now read from it; stale ids (`claude-sonnet-4-5`, `gemini-2.0-flash`) refreshed to current ones (`gemini-3.8-flash`, etc.). `.env.example` documents the free provider chain (Gemini → Groq → OpenRouter → Pollinations).
- **L2 judgment — effect estimates from outcomes** (`src/core/judgment/`, `docs/JUDGMENT.md`): turns measured `OutcomeRecord`s into per-change-kind, control-adjusted effect estimates via difference-in-differences (counterfactual from the control group's trend). Reports sample size, exclusions, median/mean net clicks, positive share and position gain, with confidence capped by sample size. Additive to the audited P0–P3 `actionPlan` (no re-prioritization) and `provenance: "estimated"` throughout — correlational, never a per-page prediction. Exposed as `POST /api/outcomes { action: "judge" }`; it is the deterministic baseline a trained L2 model must later beat.
- **Outcome logging** (`src/core/outcomes/`, `docs/OUTCOMES.md`): every deployed fix is recorded as a `ChangeEvent`, then measured against Google Search Console over matched before/after windows (28 days, 3-day data lag) with a control set of unchanged high-impression pages. Records are `measured` (real rows) or `unavailable` with a reason (no Search Console, no rows, still-filling window) — never estimated, never invented. Storage is idempotent JSONL (`COGWHEEL_DATA_DIR`-aware); `/api/outcomes` records/measures, and successful `/api/platform/v1/deployments` record a change automatically (best-effort, never blocking the deploy).
- **GEO audit engine** (`rules/geo/`, `src/rules/geo/`): measured llms.txt presence/validity, AI-crawler rules in `robots.txt` (longest-match/Allow-wins), a documented 0–100 citability heuristic with formula and inputs, local-first drift snapshots, and a CI-friendly 5-point fail threshold. Every check carries `measured`, `estimated`, or `unavailable` provenance.
- **AI visibility tracker** (`src/core/visibility/`): hotel and universal buyer-prompt generation; BYOK adapters for ChatGPT, Claude, Perplexity and Gemini; Google AI Overviews always `unavailable` (no official API, no scraping); deterministic mention/citation analysis; local JSONL run history; per-provider daily call/cost caps.
- **Gap detector and healing plans**: prompts with a measured answer but no brand mention become prioritized gaps, then `healing/` patch plans with `status: "pending_approval"` and `autoApply: false`. Human approval is required.
- **GEO tools in the SEO brain**: `llms_check`, `citability`, `drift`, `visibility_tracker` and `gap_detector` are registered in `src/core/brain/tools.ts` and included in every brain run.
- **Claim-to-field provenance gate**: every brain sentence must trace to a measured audit/tool field or a retrieved chunk. LLM output that fails is replaced by the deterministic summary; if that also fails, `/api/brain` returns 422 instead of serving an unsupported claim.
- **GEO knowledge for RAG** (`ai/rag/geo-knowledge.ts`, `docs/geo/`): GEO paper findings, tool-review notes and playbooks with source citations; hybrid retrieval recall@6 test with 40 questions (currently 97.5%).
- **Training-data tiers and LoRA export**: `raw`/`reviewed`/`gold` tiers, consent + robots/ToS gates, PII stripping, content-hash dedupe, operator review endpoint, and `npm run brain:export-lora` JSONL export gated at 2,000 reviewed/gold pairs. Training is not started automatically.
- **Upgraded brain eval** (`npm run brain:eval`): fabrication rate (blocks CI when > 0), finding accuracy against hand-verified action titles, and an estimated fix-quality heuristic. Added `data/brain-gold-prompts.template.json` for hand-labelled GEO-bench-style prompts.
- **Training-data governance gate** (`npm run train:validate`, enforced by CI): fails on unresolved `{{placeholders}}`, invented metrics (currency / CPC / volume / authority / rank / counts) that are not traceable to the user-supplied text, missing `meta.category` / `meta.provenance`, or duplicate rows. The baseline keyword rows were cleaned with `scripts/clean-training-data.py` (placeholders instantiated from coherent hotel profiles, fabricated `Benchmark CPC` / `Search Volume Tier` lines replaced with an explicit “unavailable” line). `TrainingTriple` now carries `tenantId` (from the operator's organisation) and `provenance` (`measured` | `estimated` | `unavailable`).
- **Extension GEO card**: the side panel now shows citability, llms.txt, AI-crawler and drift status for the live page, each with a provenance badge, plus the existing “Ask the brain” flow. New training captures are tagged `tier: "raw"` and remain consent-gated and PII-stripped.
- **Studio expert-in-the-loop capture** (`src/lib/training-capture.ts`, `src/components/TrainingCaptureCard.tsx`): the SEO/GEO Studio now lets an operator review AI output and contribute their accepted/edited result to the training set through one consent + robots/ToS gate. In the **Content Studio** (step 4) each generated section can be accepted/rejected and edited (accepted, edited copy → `expertFix`; per-section checks + AI draft → `audit`). In the **page-to-keyword Approval Matrix** (step 3) the approved map and the operator's edits to the allocator's proposal are captured (proposal + alternatives + flags → `audit`; approved assignments → `expertFix`). Capture is never automatic, and provenance is `estimated` (operator-supplied data, not a live crawl). The pure `buildStudioCapture` / `buildMatrixCapture` builders are unit-tested.

### Fixed
- **Operator console could never authenticate** (`src/lib/platform/client.ts`): the session calls used the platform gateway base (`/api/platform/v1`), so they hit `/api/platform/v1/session` — a path the gateway does not serve (404). They now use the real route at `/api/platform/session`, so sign-in and the `PLATFORM_DEV_AUTH=1` fallback activate and the console (including the new Outcomes tab) loads real data. Covered by `tests/platform-client-outcomes.test.ts`.
- **Runtime stores are no longer committable**: the local outcome log (`data/outcomes.jsonl`, `data/outcome-changes.jsonl`) and the AI usage meters (`data/brain-usage.json`, `data/usage-meter.json`) are now git-ignored, so a dev run cannot be swept into a commit by `git add -A`.

### Changed
- **Training-capture dedupe is content-based**: `POST /api/training-triples` no longer rejects a repeated URL; it rejects only byte-identical `audit` + `expertFix` content (`hasDuplicateContent`). An operator can now re-capture the same page after further expert edits, while exact duplicates are still blocked.
- **Custom Fine-Tuned Model Inference Engine & Fallback Router** (`src/engine/custom-model-client.ts`):
  - Multi-provider inference support for Tuned Google Gemini (Vertex AI / Google AI Studio), custom REST API endpoints (vLLM / HuggingFace TGI), and local open-weight instances (Ollama / LoRA).
  - Zero-latency 3-tier automatic fallback to SEO Studio's local deterministic rules engine on network failure or rate limits.
  - Dedicated inference settings interface in **Settings** tab with model endpoint configuration, API keys, temperature parameters, and live latency connection testing.
- **Python Supervised Fine-Tuning (SFT) & LoRA Pipeline** (`python/scripts/fine_tune_pipeline.py`):
  - End-to-end dataset ingestion with strict Pydantic token and schema validation.
  - Deterministic 90/10 train-validation dataset split.
  - Automated generation of 4-bit Unsloth / PEFT LoRA training scripts (Llama 3, Mistral 7B) and Google Cloud Vertex AI Gemini tuning job scripts.
  - Benchmarking evaluation module comparing base vs. tuned model accuracy against 580px/920px SERP budgets and Schema.org graph syntax.
- **Dataset Tab & SFT Dataset Builder** (`src/components/DatasetVaultManager.tsx`, `src/engine/dataset-builder.ts`):
  - Full-featured **Dataset** tab in the Chrome Side Panel for reviewing, filtering, approving, or rejecting harvested training pairs.
  - Multi-format SFT dataset export supporting Google Gemini SFT (.jsonl), ChatML / OpenAI / Unsloth (.jsonl), and Alpaca (.jsonl).
  - Direct Web App API synchronization via HTTP POST with Bearer token authentication and batch progress reporting.
- **Universal DOM Training Capture & PII Sanitizer** (`src/content/training-capture.ts`, `src/storage/training-vault.ts`):
  - Read-only DOM capture extracting page structure, headings, OpenGraph metadata, and body text.
  - Automated PII redaction engine scrubbing emails, telephone numbers, and sensitive URL query credentials.
  - IndexedDB storage vault (`CogwheelTrainingVaultDB` v2) with SHA-256 canonical URL hash deduplication and multi-factor quality scoring (0-100).
- **Comprehensive System Architecture Guide Overhaul** (`docs/ARCHITECTURE.md`):
  - Detailed architectural specifications for Manifest V3 extension, ML harvesting vault, multi-provider inference ladder, SFT pipeline, and CSP/privacy governance.

## [3.0.0] - 2026-11-24

### Added
- Complete source code integration of `claude-seo`, `open-seo`, and `mcp-gsc` into SEO Studio's unified architecture.
- FastMCP Google Search Console Server and Unified TypeScript Client with query cannibalization detection and URL inspection.
- 20 specialized autonomous SEO agents and 66-entry Google algorithm updates dataset with volatility risk checker.
- Open-SEO audit issues catalog, Generative Engine Optimization (GEO) AI visibility tracker, backlinks, and keyword research.
- Unified AI Tool Orchestrator dispatching 9 registered tools with strict schema validation.
- Full Website SEO Audit Engine with 11-dimension reporting and Next.js `/api/full-audit` route handler.
- SFT training data preparation pipeline (`unified_seo_train.jsonl` & `unified_seo_eval.jsonl`) and unified model evaluation benchmark engine with checkpoint registry.
- Unified SEO Suite dashboard view with multi-tool interactive assistant and model training monitor.
- Reusable Heading Structure Optimization CLI (`outputs/site_heading_audit.py`) and Image Optimization CLI (`outputs/site_image_audit.py`).
- 13-test integration suite in `tests/unified-seo-platform.test.ts` passing 100%.

## [2.7.0] - 2026-11-21

### Added
- Professional "Export Audit" dropdown in the Chrome Side Panel header providing:
  - Executive HTML Audit Report: Print-ready, white-label report with KPI scores and remediation roadmap.
  - Copy-Ready JSON-LD Package: Serialized Schema.org `@graph` for hotel web developers.
  - Portfolio CSV Export: Tabular export for monthly visibility decks and BI tracking.
- Comprehensive Vitest unit test suite covering exact SERP pixel calculations, 5 hotel brand guardrails, JSON-LD schema integrity, and SemVer comparisons.
- Single Source of Truth data validation architecture with TypeScript Zod schemas (`src/schemas/`) and JSON Schema Draft-7 exports (`schemas/`).
- Python 3.11+ Pydantic models (`python/scripts/models.py`), schema validation CLI, and batch portfolio auditor.
- Automated two-layer free update engine: Layer A silent Over-The-Air (OTA) rule sync and Layer B binary update notification banner.
- Unified CI workflow (`.github/workflows/ci.yml`) running TypeScript typecheck, Vitest tests, Next.js build, Python ruff/mypy checks, and JSON dataset validation.

### Changed
- Replaced oversized glowing radial gauges with precision tabular micro-gauges inspired by Linear and Vercel design aesthetics.
- Removed all raw emojis from user interface components in favor of crisp 16px Lucide icons.
- Updated pixel budget triggers for Google Title (580px ceiling) and Meta Description (920px ceiling).

### Fixed
- Narrow character pixel estimation for characters like `i`, `l`, `|`, and punctuation marks.
- Localization text artifacts in audit status readouts.

## [2.6.1] - 2026-11-20

### Added
- Live SERP and Social Open Graph preview cards supporting Desktop, Mobile, and Social OG modes.
- Hotel brand guardrail checks for prohibited superlatives and discount nomenclature.

### Fixed
- DOM inspector alt tag counting and oversized image detection.

## [2.6.0] - 2026-11-16

### Added
- Initial Chrome Extension Manifest V3 side panel implementation.
- Multi-CMS export adapters for HTML, WordPress, Shopify, and Webflow.
- 78-keyword hospitality strategy matrix dataset.
