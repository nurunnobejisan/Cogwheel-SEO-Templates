# Repository Audit — Cogwheel SEO & GEO Studio

**Date:** 2026-11-25
**Scope:** full repository (`src/`, `chrome-extension/`, `python/`, `validators/`, `exporters/`, `schemas/`, `templates/`, `data/`, `api/`, `rules/`, `ai/`, `cms/`, `healing/`, `platform/`, `tests/`, `scripts/`, `.github/`, `docs/`, docs & config)
**Method:** static inspection + executed quality gates. No product behaviour was changed during the audit; the fixes listed in §4 were made after the findings were recorded.

---

## 1. Executed checks (ground truth)

| Check | Before this session | After remediation |
| --- | --- | --- |
| `npx tsc --noEmit` | 11 errors (legacy test imports) | **0 errors** ✅ |
| `next build` | ❌ failed at type-check | **passes** ✅ |
| `npx vitest run` | 355 passed (57 files) | 355 passed ✅ |
| `npm run lint:seo` | ❌ path + Node flag broken | **10/10 gates PASS** ✅ |
| `npm run test:seo` | ❌ Node flag unsupported | **67 passed** ✅ |
| `npm run test:ts` | ❌ Node flag unsupported | **34 passed** ✅ |
| `pytest tests/python` | ❌ 7 collection errors | **47 passed** ✅ |
| `npm run lint` (`next lint`) | clean | clean ✅ |
| GitHub Actions CI | ❌ invalid/never ran | **3 valid jobs** ✅ |

---

## 2. Findings

### 🔴 Critical

**C1 — No application-level authentication or middleware.**
26 route handlers exist under `src/app/api/**`; there is **no `middleware.ts`** and only `src/app/api/visibility-suite/route.ts` and `src/app/api/semrush-pull/route.ts` reference any token check. Every other endpoint (AI generation, crawls, Supabase reads/writes, exports) is callable by anyone who knows the URL.
*Impact:* unauthorized use of paid AI providers (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`) and the Supabase **service-role** key (`src/lib/supabase.ts:13`).
*Evidence:* `src/app/api/**` (26 `route.ts`), no `middleware.ts`, grep for auth references.

**C2 — Server-side URL fetching without egress validation (SSRF).**
Several routes fetch a caller-supplied URL server-side with no allow-list, scheme check or private-IP blocking: `src/app/api/sitemap-audit/route.ts`, `src/app/api/seo-visibility-report/route.ts`, `src/app/api/property-autofill/route.ts`, `src/app/api/crawl-property/route.ts`, `src/app/api/tasks/site-crawl/run/route.ts`.
*Impact:* internal network probing / cloud metadata access; amplified by C1 (unauthenticated).
*Note:* the newer platform layer already rate-limits and audits, but these legacy routes do not.

**C3 — PHP-side of the SEO ops is not the issue; the CI pipeline was non-functional.**
`.github/workflows/ci.yml` began with a `//` line (not a YAML comment), yielding a stray top-level key GitHub's schema rejects, and it referenced a missing `python/requirements.txt`, and called `ruff`, `mypy` and `ts-node` which are not dependencies. `seo-integrity.yml` pointed at `tests/seoLinter.ts` (does not exist) and `pytest tests/python/` (broken), so **no automated gate was actually enforcing quality**. *Resolved — see §4.*

### 🟠 High

**H1 — AI-search / GEO "citation" metrics are not measured.**
The AI-visibility product surfaces ChatGPT / Google AI Overviews / Perplexity / Copilot / Gemini data (`src/tasks/ai-seo-visibility-report/schema.ts:4`), but the values are produced by LLM task prompts from operator-supplied inputs (`…/prompt.ts:11,36`) and summarised as if measured (`src/tasks/seo-baseline-ai-visibility/validator.ts:91-100`, `…/index.ts:54`). There is no integration that queries those engines.
*Impact:* risks exactly the "fabricated AI citation" problem; enterprise buyers cannot trust scores presented as measured. Must be relabelled as **operator-provided / estimated**, or backed by a real data source.

**H2 — Broken script & Python layers (now fixed).**
`package.json` used `--experimental-strip-types` (needs Node ≥ 22.6; repo runs Node 20) and `lint:seo`/`test:seo` targeted a non-existent file. Four **source** modules imported a non-existent `scripts.python.*` package (`python/scripts/{validate_schemas,batch_portfolio_audit,sync_ota_rules,train_unified_model}.py`) and the Python suite could not collect without a `sys.path` bootstrap and two missing deps. *Resolved — see §4.*

**H3 — The new platform capability is siloed from the product.**
The Next.js app's audit path is `@/core/full-audit` (`src/app/api/full-audit/route.ts:2`). The roadmap modules (`rules/`, `ai/`, `cms/`, `healing/`, `platform/`) are imported **only** by `src/lib/platform/*` and `src/app/api/platform/[...path]/route.ts`. So the self-healing/CMS/audit engine is reachable only via `/api/platform/*` and the `/platform` console — the main dashboard does not use it.
*Impact:* duplicated bodies of logic and a capability users can't reach from the primary UI.

**H4 — Broad Chrome extension permissions.**
`chrome-extension/public/manifest.json` requests `host_permissions: ["<all_urls>", …]` plus `tabs`, `webNavigation`, `unlimitedStorage`, `scripting`.
*Impact:* Chrome Web Store review friction and user trust; needs per-purpose justification and narrowing where possible.

**H5 — Significant parts of the product are placeholders.**
Many tasks are "Coming Soon": `src/components/ComingSoonModal.tsx:69`, `src/components/PropertyDashboard.tsx:1055,1323,1410,1498` render roadmap/upcoming modules.
*Impact:* the marketed surface exceeds the working surface; a professional product should separate "available" from "roadmap" clearly.

**H6 — Risky CI automation (fixed).**
`ci.yml` ran `scripts/git-auto-push.ts` in CI (commits + pushes using `GITHUB_TOKEN`), and `auto-release.yml` published a GitHub Release on **every** push to `main`. *Resolved — see §4.*

### 🟡 Medium

**M1 — Two parallel, unwired SEO stacks.** Legacy `src/core` + root `validators/` + `src/engine/` versus the newer `rules/` + `ai/` + `healing/`. Also two schema systems: `schemas/*.json` and Zod schemas in `schemas/`/`validators/`/`rules/`. Consolidation would remove drift. *(See H3.)*

**M2 — Environment/dependency sprawl.** Five AI providers (`ANTHROPIC`, `OPENROUTER`, `GROQ`, `GOOGLE_AI`, `GEMINI`) with an `ENABLE_FREE_ONLINE_AI` toggle; precedence/fallback undocumented. `xlsx` is installed from a CDN tarball URL (`package.json:32`) — a supply-chain risk worth replacing with a pinned registry version.

**M3 — Documentation drift.** `README.md` (210 lines) documents the legacy layout and does not cover the newer `platform/`, `healing/`, `cms/`, `ai/`, `rules/`, the `/platform` console, or the new infra scripts; no screenshots and no architecture diagram of the new modules. `docs/` has 27 files but no single index.

**M4 — Duplicate manifests / version sync.** Root `manifest.json` + `updates.xml` + `chrome-extension/public/manifest.json` must be kept in sync manually (all report `3.0.0`).

**M5 — Secret hygiene is mostly good but unenforced.** `.env.local` is untracked and `.env.example` is tracked (good), and no client `.tsx` reads server keys (verified). But nothing prevents a future leak; the new CI secret-scan step is the guard.

### 🟢 Enhancement

- **E1** Premium dashboard redesign (Prompt 02) and consistent component system.
- **E2** Client-ready reporting with real executive summaries, historical comparison, polished PDF/HTML/CSV (Prompt 05).
- **E3** Transparent GEO framework that separates measured technical checks from estimated content-quality scores (Prompt 04).
- **E4** Accessibility pass (labels, focus, contrast) across `src/components/**`.
- **E5** Consolidate AI providers behind one router with documented fallback.
- **E6** Add screenshots + architecture diagram + contributor docs (Prompt 09).

---

## 3. Strengths (preserve)

- Strong, readable domain module boundaries (`rules/`, `ai/`, `cms/`, `healing/`, `platform/`) with zod contracts and JSON Schemas.
- Real, non-fabricated engineering: hash-chained audit log, RBAC, retries/backoff, snapshot rollback, durable persistence.
- No `TODO/FIXME/HACK` markers in `src/`, `python/`, `rules/`, `ai/`, `cms/`, `healing/`, `platform/`, `validators/` (0 found).
- Healthy test coverage once unblocked (355 Vitest + 67 + 34 node:test + 47 pytest).
- MIT license, CoC, contribution guide, PR/issue templates present.

---

## 4. Fixes applied in this session (infrastructure only)

| File(s) | Change |
| --- | --- |
| `package.json` | `--experimental-strip-types` → `tsx`; fixed `lint:seo`/`test:seo`/`test:ts`/`preview:seo`/`export:*` paths |
| `tests/ts/seoLinter.ts`, `tests/training-capture-fixtures.test.ts` | corrected wrong relative imports |
| `conftest.py` *(new)* | put repo root on `sys.path` for `python.*` / `api.*` |
| `python/scripts/*.py` (4) | `scripts.python.*` → `python.scripts.*` |
| `tests/python/*.py` (4) | fixed package imports + aligned a stale call to `_repair_meta_length` |
| `.github/workflows/ci.yml` | rewritten: valid syntax; Node job (`typecheck`, `lint`, `vitest`, `lint:seo`, `test:seo`, `test:ts`, `build`), Python job (`pytest tests/python`), secret scan |
| `.github/workflows/auto-release.yml` | version-guarded; no CI push-back to `main` |
| `.github/workflows/seo-integrity.yml` | removed (redundant/broken; secret scan folded into `ci.yml`) |

All changes are additive/non-destructive to product logic. **Verified:** the 7-command gate above passes end-to-end.

---

## 5. Recommended next priorities (mapped to your prompts)

1. **Prompt 02 — UI/UX**: redesign the dashboard; surface the platform/self-heal capability in the main UI (resolves H3/H5 presentation).
2. **Prompt 03 — SEO engine**: unify the two stacks (M1) on a single `rules/`-based engine; add evidence-backed checks only.
3. **Prompt 04 — GEO**: relabel estimated AI metrics, build the measured-vs-estimated framework (H1).
4. **Prompt 05 — Reporting**: enterprise deliverables + historical comparison.
5. **Prompt 06 — Production readiness**: auth/middleware (C1), SSRF guard (C2), permission narrowing (H4).
6. **Prompt 09 — Docs/presentation**: README rewrite, screenshots, architecture diagram (M3/E6).

---

## 6. Known limitations of this audit

- Product-UX and template-library depth were sampled, not exhaustively enumerated; a screen-by-screen pass belongs to Prompt 02.
- Python was validated on macOS Python 3.9 locally; CI targets 3.11.
- Authenticated behaviour of the legacy API routes could not be exercised (no running auth layer exists — see C1).
