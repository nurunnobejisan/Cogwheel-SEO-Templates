# Repository Audit — Cogwheel SEO & GEO Studio

**Date:** 2026-11-25
**Version audited:** 3.0.0
**Scope:** the whole repository — `src/` (Next.js app, 339 files), `chrome-extension/` (63), `python/` (28), `tests/` (79), `api/` (4, Python), `rules/` (13), `ai/` (13), `cms/` (13), `healing/` (10), `platform/` (18), `validators/` (9), `exporters/` (5), `schemas/` (24), `templates/`, `data/`, `supabase/`, `scripts/`, `.github/`, `docs/`.
**Method:** static inspection by five parallel workstreams + executed quality gates. No product behaviour was changed during the audit; the infrastructure fixes in §4 were applied afterwards.

---

## 1. Executed checks (ground truth)

| Check | Before this session | After remediation |
| --- | --- | --- |
| `npx tsc --noEmit` | 11 errors (legacy test imports) | **0 errors** ✅ |
| `next build` | ❌ failed at type-check | **passes** ✅ (deployed) |
| `npx vitest run` | 355 pass (57 files) | **355 pass** ✅ |
| `npm run lint` (`next lint`) | clean | clean ✅ |
| `npm run lint:seo` | ❌ path + Node flag broken | **10/10 gates PASS** ✅ |
| `npm run test:seo` | ❌ Node flag unsupported | **67 pass** ✅ |
| `npm run test:ts` | ❌ Node flag unsupported | **34 pass** ✅ |
| `pytest tests/python` | ❌ 7 collection errors | **47 pass** ✅ |
| Chrome extension `tsc --noEmit` | ✅ clean | ✅ clean |
| Chrome extension build/pack | ❌ cannot run (no `node_modules`, missing vite plugin) | unchanged |
| GitHub Actions CI | ❌ never actually ran (invalid + wrong paths) | **3 valid jobs** ✅ |

---

## 2. Findings

### 🔴 Critical

**C1 — The primary audit engine emits hardcoded scores and fabricated metrics.**
`src/core/full-audit/audit-runner.ts` returns constants in place of measurements:
- Dimension scores `onPageScore = 88`, `headingsScore = 85`, `imagesScore = 82`, `schemaScore = 90` (`:180-183`), blended into `overallScore` (`:187-195`).
- Crawlability asserted without crawling: `hasRobotsTxt: true`, `isIndexable: true`, `hasNoindex: false`, `totalInternalLinksDiscovered: 48` (`:229-240`).
- On-page/heading/image metrics as constants: `titlePixelWidth: 512`, `wordCount: 1420`, `totalHeadings: 18`, `totalImages: 34`, `optimizationOpportunityBytes: 4200000` (`:241-273`).
- Structured data fabricated: `schemasDetected: ["Hotel","Organization","WebSite","BreadcrumbList"]`, `isValidJsonLd: true` (`:306-312`).
- Security headers all `true` unconditionally (`:218-227`); keyword ranks constant (`top10KeywordsCount: 14`, `:291-304`); invented action-plan impact claims (`"+18-35% CTR recovery"` `:124`, `"+24% citation rate"` `:160`).
*Impact:* every audit reports a confident, identical "healthy" profile regardless of the real page — the single largest trust risk in the product. Violates the audit's own rule "do not invent SEO metrics".

**C2 — AI/GEO visibility data is fabricated.**
`src/core/open-seo/ai-visibility.ts:52-90` hardcodes `isMentioned: true`, invents `quotedSnippet` and `sourceCitations`, and returns fixed `engineRankings { chatgpt: 92, perplexity: 96, google_ai_overview: 78, claude: 88 }` with hardcoded competitor names (`:119-129`). No engine is ever queried. `src/core/open-seo/backlinks.ts:42-80` and `keyword-research.ts:37-153` likewise return hardcoded DR/volume/CPC data. `src/engine/unified-ai-orchestrator.ts:82` advertises "Measure citation share of voice in ChatGPT, Perplexity, Claude and Google AI Overviews" but dispatches to that same hardcoded code.
*Impact:* the flagship GEO claim is not backed by measurement.
*Resolved — see §6: live measurement + `dataProvenance`; unmeasured dimensions report `dataAvailable: false`.

**C3 — No application-level authentication or middleware.**
26 route handlers under `src/app/api/**`; **no `middleware.ts`**. Auth exists only where `COGWHEEL_API_BEARER_TOKEN` happens to be set (`ai-training` POST), and `src/lib/platform/auth.ts:44-52` derives identity from spoofable `x-actor-role`/cookie headers defaulting to `viewer` with no JWT/session verification.
*Impact:* anyone can invoke paid AI providers (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`) and the Supabase **service-role** key (`src/lib/supabase.ts:13`).
*Resolved — see §6: signed sessions, fail-closed platform API, middleware rate limits and CSRF origin checks.*

**C4 — Command execution endpoints reachable without auth.**
`src/app/api/client-email/route.ts` uses `child_process.exec` with an interpolated recipient (`:62`) and an absolute local path `/Users/jisanjomadder/.gemini/antigravity/bin/gmail` (`:47`) plus a personal address (`:73,103`). `src/app/api/seo-visibility-report/route.ts` shells out to local `python3` via `execFile` (`~:160-360`) with no auth.
*Impact:* unauthenticated command execution / injection surface and environment coupling.
*Resolved — see §6: argument-array `execFile` behind opt-in env flags, explicit `501` by default, no shell interpolation, no hardcoded personal account.*

**C5 — The shipped Chrome extension content script is broken.**
`chrome-extension`'s Vite build (`vite.config.ts:10-27`) emits a code-split ES-module bundle, but `chrome-extension/public/manifest.json:50-55` registers `content.js` as a classic MV3 content script. Verified in the committed `public/cogwheel-chrome-extension.zip`: `content.js` begins `import{...}from"./assets/pixelCalculator-…js"`, which Chrome cannot load. The core DOM-audit feature fails on every page.

**C6 — CI was non-functional (no automated gate).**
`.github/workflows/ci.yml` began with a `//` line (not valid YAML comment → stray top-level key), referenced a missing `python/requirements.txt`, called `ruff`/`mypy`/`ts-node` which are not dependencies, ran `pytest -q python` (tests live in `tests/python/`), and even ran `scripts/git-auto-push.ts` in CI. `seo-integrity.yml` pointed at `tests/seoLinter.ts` (does not exist). *Resolved — see §4.*

### 🟠 High

**H1 — Fabricated data embedded in the product.**
UI presents randomized/invented values as real: `src/components/CompsetRankingMatrix.tsx:108-112` uses `Math.random()` for ranking positions; `src/components/LabsView.tsx:518-522,714` hardcodes "Score 4.9", "(342 reviews)", "From $219/night", "94% Citation Readiness". `src/app/api/visibility-suite/route.ts:156-162` returns fallback score `82` and engine breakdown `85/88/74` when no report exists. Python side: `python/scraper/hotel_extractor.py:385-451` invents room counts, restaurants, fees; `python/processor/template_processor.py:150,224-227` injects placeholder phone/Place-ID/lat-long/Wikidata; `python/scripts/batch_portfolio_audit.py:187-235` never fetches the URL; `python/scripts/train_unified_model.py:49-126` reports a simulated 100% benchmark and writes a "model checkpoint".

**H2 — SSRF: server-side fetch of caller-supplied URLs without validation.**
`src/app/api/sitemap-audit/route.ts:77,88,124`, `seo-visibility-report/route.ts:200`, `property-autofill`, `crawl-property`, `tasks/site-crawl/run` fetch user URLs. The only guard (`src/core/crawler/url.ts:50-86`) does literal hostname checks with no DNS resolution or redirect re-validation; `docs/audit/SECURITY-REPORT.md:12` claims a non-existent `src/core/crawler/ssrf.ts`.

**H3 — The Phase 1–5 platform is siloed from the product.**
The app's audit path is `@/core/full-audit` (`src/app/api/full-audit/route.ts:2`). `rules/`, `ai/`, `cms/`, `healing/`, `platform/` are imported only by `src/lib/platform/*` and the `/api/platform` catch-all, so the real self-healing/audit engine is unreachable from the main dashboard.

**H4 — Duplicate engines and contracts.**
Two SEO stacks (`rules/` vs `validators/`), TS vs Python thin-content engines (`validators/uniquenessGate.ts` vs `api/content_engine.py`), three GEO scorers (`python/analyzer/geo_scorer.py`, `src/lib/engine/geo-seo.ts`, `src/core/open-seo/ai-visibility.ts`), and two schema systems (`schemas/*.json` vs Zod in `src/schemas`/`rules`/`validators`). `shared/schemas/` is referenced but does not exist.

**H5 — Broken script/Python layers (resolved, §4).**
`--experimental-strip-types` on Node 20 (needs ≥22.6); `lint:seo`/`test:seo` pointed at a non-existent file; four Python **source** modules imported a non-existent `scripts.python.*` package; the Python suite could not collect without a `sys.path` bootstrap.

**H6 — No PDF/PPTX exporter despite advertising them.**
`exporters/index.ts:11-14` exports HTML/Shopify/WordPress/Webflow only; `src/lib/download-manager.ts:5` advertises `pdf`/`pptx`.

**H7 — Pre-commit hooks and docs referenced missing paths (resolved, §4).**

**H8 — Extension build cannot run in this checkout.**
No `chrome-extension/node_modules`/`dist`; root `node_modules` lacks `@vitejs/plugin-react`; `vite.config.ts:2` imports it.

**H9 — Version/artifact drift.**
Root `manifest.json` = `2.0.0` (stale orphan pointing at non-existent `dist/` files); `chrome-extension/public/manifest.json` = `3.0.0`; lockfile `2.0.0`; update artifact names diverge (`cogwheel-chrome-extension.zip` vs `cogwheel-seo-studio.zip`); `scripts/build-extension.js:117` copies a root `updates.xml` naming the wrong zip.

**H10 — Installed default secret.**
`src/lib/platform/runtime.ts:70` falls back to a known constant vault key when `CMS_VAULT_KEY` is unset.

### 🟡 Medium

- **M1** No route-level `loading`/`error`/`not-found` boundaries (resolved, §4); `/platform` and internal tool pages were crawlable.
- **M2** `PropertyDashboard.tsx` is a 1,761-line god component owning all app state and 20 `dynamic()` imports; 38/41 components are `"use client"`.
- **M3** Orphan components (`HotelHealthScoreCard.tsx`, `GoogleSerpPreview.tsx`), four near-duplicate audit modals, dead extension module trees (`src/core/**`, `src/modules/**`).
- **M4** API routes: rate limiting absent; input validation inconsistent (zod in ~12/26 routes); internal error strings echoed on 500s; process-local caches unsafe under serverless scaling.
- **M5** Dependency hygiene: `xlsx` from a CDN tarball URL (`package.json:32`); `playwright` unused/orphaned (`tests/e2e/extension-verification.mjs` has no script); `husky` inactive (no `prepare`); `@typescript-eslint/*` used but undeclared; `flask`/`flask-cors`/`werkzeug` unused Python deps; used-but-undeclared Python deps (`platformdirs`, `google-auth*`, `mcp`).
- **M6** Docs drift: `README.md` documents the legacy layout, wrong build instructions, and a CI description that never matched; `docs/**` repeatedly reference the inverted `scripts/python/` path; `docs/SECURITY.md` lists `2.7.x` versions; `docs/PROGRESS.md` shows a stale branch; audit docs contain false claims (non-existent `ssrf.ts`, "CSP configured", table counts).
- **M7** Hotel/universal leakage: Marriott/Hilton defaults hardcoded in "universal" flows (`src/engine/custom-model-client.ts:427-428`, `chrome-extension/src/engine/custom-model-client.ts:426-428`, extension sidepanel/QuickWins).
- **M8** Brand coverage gap: guardrails cover 5 brands (`schemas/brand-guardrails.schema.json:14-20`) while the scorer handles 7 loyalty programs (`python/analyzer/geo_scorer.py:20-28`); hotel rules contain no brand-specific branch.
- **M9** Invented brand policy in templates: `templates/direct-booking-ota-displacement.md:67,149,174` assert specific rate-match discounts/points; `templates/hotel-geo-ai-visibility.md:88,198` and `templates/hotel-gbp-unap-audit.md:97` claim "100% Policy-Safe" — no cited source.
- **M10** `data/ota-config.json:14` `brandGuardrailsUrl` points at `ota-config.json` itself (no brand-guardrails data file exists); `data/models/model_registry.json` reports a perfect 100%/0% hallucination benchmark.
- **M11** Extension: content script injected twice without an idempotency guard; over-broad permissions (`<all_urls>`, unused `api.github.com`, `unlimitedStorage`); OTA config fetched but never read; API keys in URL query strings and stored unencrypted; theme toggle non-functional.
- **M12** `tests/python/run_tests.py` imports only 6 modules and reports "27/27" while 20 of 47 tests never run.

### 🟢 Enhancement

- Premium dashboard redesign + shared Modal primitive (collapses the duplicated audit modals).
- Enterprise reporting: real executive summaries, historical comparison, polished PDF/HTML/CSV.
- Transparent GEO framework separating measured checks from estimated content scores.
- Accessibility pass (focus traps, Escape, labels, contrast) across modals/components.
- Consolidate AI providers (Anthropic/OpenRouter/Groq/Google/Gemini) behind one documented router.
- README + screenshots + architecture diagram + contributor docs; retitle/relocate internal tool pages.
- Activate husky after fixing hook paths, or rely on the (now real) CI gate.

---

## 3. Strengths (preserve)

- Clean domain modules (`rules/`, `ai/`, `cms/`, `healing/`, `platform/`) with zod contracts and JSON Schemas.
- Genuinely engineered system: hash-chained audit log, RBAC, retries/backoff, snapshot rollback, durable persistence.
- Zero `TODO/FIXME/HACK` markers in the core source trees.
- Real test coverage once unblocked: 355 Vitest + 67 + 34 `node:test` + 47 pytest.
- MIT license, CoC, contribution guide, PR/issue templates, CHANGELOG discipline.

---

## 4. Fixes applied in this session (infrastructure only)

| Area | File(s) | Change |
| --- | --- | --- |
| Scripts | `package.json` | `--experimental-strip-types` → `tsx`; repaired `lint:seo`/`test:seo`/`test:ts`/`preview:seo`/`export:*` paths |
| Python | `python/scripts/*.py` (4), `tests/python/*.py` (4), `conftest.py` (new) | fixed `scripts.python.*` → `python.scripts.*`; root `sys.path` bootstrap; aligned a stale `_repair_meta_length` call |
| CI | `.github/workflows/{ci,auto-release}.yml`, removed `seo-integrity.yml` | valid workflows; correct Node/Python jobs; version-guarded release; secret scan |
| Hooks/docs | `.husky/pre-commit`, `scripts/pre-commit.sh`, `.github/pull_request_template.md`, `CONTRIBUTING.md`, `docs/{ARCHITECTURE,GEMINI,TASKS,SEO_EXPERT_GUIDE}.md`, `CHANGELOG.md`, SVGs | fixed linter/python paths; corrected documented commands |
| App robustness | `src/app/{error,global-error,loading,not-found}.tsx` (new) | route error/loading/404 boundaries |
| SEO hygiene | `src/app/robots.ts`, `src/app/platform/page.tsx` | disallow `/platform`; `noindex` operator console |
| Security docs | `src/lib/platform/runtime.ts`, `.env.example` | loud warning when `CMS_VAULT_KEY` unset; documented platform env vars |

All changes are additive/non-destructive to product logic. **Verified:** the 7-command gate passes end-to-end.

---

## 5. Recommended remediation sequence

Ordered by risk, aligned to the product prompts (and deliberately putting *integrity* before *polish*):

1. **Integrity (C1, C2, H1)** — stop presenting fabricated metrics. Either wire the real `rules/` + `rules/html-snapshot.ts` engine into `full-audit` (measure, don't guess), or relabel every unmeasured field as `estimated`/`sample` and remove invented constants. This must precede any UI work (a beautiful dashboard on fake data is worse than an ugly one on real data).
2. **Security (C3, C4, H2, H10, M4)** — add `middleware.ts` + real session/JWT auth; require `CMS_VAULT_KEY`; remove OS-exec from request handlers; validate URLs against an egress allow-list with DNS/redirect checks; add rate limiting.
3. **Extension (C5, H8, H9, M11)** — fix the content-script module format, wire a reproducible build, reconcile versions/update artifacts.
4. **UI/UX (M2, M3, M6, Enhancement)** — redesign on top of honest data; add the shared Modal primitive; split the dashboard monolith; surface the platform/self-heal capability in the main UI.
5. **Reporting (H6)** — real PDF/PPTX/HTML/CSV with executive summaries and historical comparison.
6. **GEO framework (C2)** — measured-vs-estimated separation, entity/credibility signals.
7. **Docs/presentation (M6)** — README rewrite, screenshots, architecture diagram.
8. **Data↔contract** — materialize `shared/schemas/`, add a TS↔Python parity test, reconcile brand guardrails coverage.

---

## 6. Remediation status

### Completed — integrity (C1, C2, H1)

- `src/core/full-audit/audit-runner.ts` now measures the live page with `rules/` + `rules/html-snapshot.ts`; every dimension is derived from the fetch or reported unavailable. GEO is an explicitly labelled on-page readiness heuristic.
- Synthetic GSC rows, keyword volumes, backlink profiles and AI citations are gated behind `ALLOW_SIMULATED_DATA` (default off) in `src/core/{gsc,open-seo}`.
- Reports carry `dataProvenance` (measured / unavailable / methodology); UI shows a provenance banner.
- Python: `hotel_extractor.py` no longer invents rooms, venues, meeting-space numbers, policies, airports, convention centres or landmarks; `template_processor.py` emits `Not provided` / `Not measured` gaps instead of defaults; `batch_portfolio_audit.py` audits real fetched pages; `train_unified_model.py` no longer inflates benchmark adherence.
- `CompsetRankingMatrix` requires operator-entered ranks (no random seeds); Labs GEO simulator and rich-snippet mockup are labelled illustrative instead of presenting invented scores.

### Completed — security (C3, C4, H2, H10, M4)

- `src/middleware.ts`: per-IP API rate limits (read/write/crawl tiers), cross-origin write rejection, security headers, `noindex` for `/api/*` and `/platform`.
- `src/lib/platform/session.ts` + `src/app/api/platform/session/route.ts`: HMAC-signed `cw_session` tokens, `PLATFORM_OPERATOR_TOKEN` sign-in, `PLATFORM_SESSION_SECRET` signing key; platform API fails closed (`401`) except `GET /health`; spoofable `x-actor-role` only honoured under explicit local `PLATFORM_DEV_AUTH=1`.
- `src/lib/security/egress.ts`: DNS-aware SSRF validation + redirect-revalidating `safeFetch`, applied to full audit, sitemap audit, property autofill, visibility report, site crawl, heading audit and image audit.
- OS-exec removed from request paths: Gmail CLI and python-pptx builder are opt-in (`COGWHEEL_ALLOW_LOCAL_*`), use `execFile` argument arrays, and return `501` by default.
- Tests: `tests/security.test.ts` covers IP classification, egress rejection, rate-limit windows, session signing/tampering/expiry and header-spoofing rejection.

### Remaining

- C5 (extension content script module format), H6 (real PDF/PPTX exporter), H8/H9/M11 (extension build/version reconciliation), `shared/schemas/` materialization, duplicate SEO engines (`rules/` vs `validators/`).

---

## 7. Known limitations of this audit

- Findings were produced by parallel static inspection plus executed gates; business-logic depth (template content, scoring thresholds) was sampled, not exhaustively enumerated.
- Python was validated on macOS Python 3.9 locally; CI targets 3.11.
- The extension's runtime behaviour was inferred from the built artifact and source (the build could not be executed here).
- Legacy API routes could not be exercised end-to-end (no auth layer exists — see C3).
