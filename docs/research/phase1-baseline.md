# Phase 1 — SEO Studio Baseline Report

**Scope:** Read-only inspection of the SEO Studio repository (`nurunnobejisan/SEO-Studio`, branch `main`, HEAD `1afe937`) plus repository discovery of the three research accounts (`rifonix`, `mdrifatcom`, `nurunnobejisan`).

**Purpose:** Establish the current architecture, capabilities, bugs, limitations, and technical debt *before* any change. No application code was modified to produce this report.

**Verification note:** Every claim below is tied to a file path and function. Anything not directly observed is marked "not verified".

---

## 1. Application shape

| Area | Implementation |
| --- | --- |
| Framework | Next.js 14.2.35 App Router, React 18.3.1, TypeScript 5, Tailwind 3 (`package.json`). |
| Pages | `src/app/page.tsx` (home), `templates`, `strategy-matrix`, `architecture`, `platform`. |
| API | 24 route handlers under `src/app/api/**/route.ts` (see §4). |
| Domain engines (outside `src`) | Top-level `rules/`, `validators/`, `schemas/`, `exporters/`, `healing/`, `platform/`, `cms/`, `ai/`, `python/`. This split is deliberate: the DOM/rule engine is framework-independent so the Chrome extension and the server share it. |
| Extension | `chrome-extension/` (Manifest V3, Vite build); packaged to `public/cogwheel-seo-studio.zip` via `npm run extension:pack`. |
| Python | `python/` (analyzer, crawler, generators, scraper, processor, scripts) with `tests/python` (pytest). |
| Persistence | Supabase (SQL migrations in `supabase/migrations`) with in-memory fallback; local JSON/JSONL stores resolved through `src/lib/platform/data-dir.ts`. |
| Deploy | Vercel (project `seo-3114/seo-studio`); CLI deploys recorded in `CHANGELOG.md`. |

---

## 2. SEO audit engine (current state)

### 2.1 Orchestrator — `src/core/full-audit/audit-runner.ts`

`runFullWebsiteAudit(options)` (line 240) produces one `FullWebsiteAuditReport` combining 11 dimensions (see the header comment in `src/core/full-audit/types.ts`):

1. Executive summary & scores
2. Technical health & security (status, HTTPS, response headers, compression)
3. Crawlability & indexability (robots.txt probed, sitemap discovery, canonical)
4. On-page SEO & content quality
5. Heading structure H1–H6
6. Image optimization & previews
7. Google Search Console & cannibalization (only when GSC configured)
8. Keyword intelligence & competitor gaps (only when a data source is connected)
9. Schema.org structured data
10. AI visibility & GEO citations
11. Prioritized action plan (P0–P3)

**Integrity contract (lines 7–14):** every field is derived from a live fetch + parse, or reported as `unavailable`. Dimensions without a connected data source are not populated. The GEO score is labelled an on-page readiness heuristic.

### 2.2 Hard limitation (highest-priority gap)

The file header states plainly (lines 16–17):

> *"This is a single-URL audit: `maxPages` is accepted for API compatibility but a multi-page crawl is not performed (noted in `dataProvenance`)."*

`runFullWebsiteAudit` fetches exactly one HTML page (`egressFetch(targetUrl)` line 282), then probes `robots.txt` (line 323) and llms.txt (line 353). `options.maxPages` is never used to drive a site crawl. `/api/full-audit/route.ts` defaults `maxPages` to 25, which is currently misleading. **This is the single biggest gap against the stated mission.**

### 2.3 Rule engine — `rules/`

- `rules/index.ts` → `runAudit(snapshot)`: resolves mode (hotel vs universal), runs the Universal ruleset, adds the Hotel ruleset in hotel mode, sorts by severity, summarizes.
- Modes: `resolveAuditMode` (`rules/context/detect-mode.ts`) + per-domain override store.
- Issue contract: `rules/types.ts` `AuditIssue` = `{ issueId, category, severity, fixable, cmsTargetField, context: { currentValue, selector, imageSrc?, recommendedAction } }`.
- Scoring: `rules/issues.ts` `summarizeIssues` — `score = clamp(100 - Σ severityWeight)`; weights critical 20 / high 12 / medium 6 / low 3 / info 1.
- Pillars: metadata, content, media, technical (+ accessibility, schema, hospitality).

**Observation:** the issue contract already carries evidence (`currentValue`, `selector`), an explanation (`recommendedAction`) and severity/scores — close to the mission's per-issue requirement. It does **not** yet carry a post-fix "validation status" field.

### 2.4 Crawler — `src/core/crawler/`

| File | Responsibility |
| --- | --- |
| `fetcher.ts` | `RateLimiter` (default 2 req/s), `fetchPageWithRedirects` — manual redirect tracking, 10s timeout, 2 retries on 5xx/network, `MAX_REDIRECTS = 10`. Re-validates SSRF on **every** hop (line 73). |
| `url.ts` | `normalizeCrawlUrl`, tracking-param stripping, `validateTargetUrl`, IPv4/IPv6 private/reserved range detection (`isPrivateOrReservedIp`). |
| `robots.ts` | `parseRobotsTxt` — most-specific UA group (`HiltonSEOStudioCrawler` else `*`), Allow/Disallow, `Sitemap:` directives. |
| `sitemap.ts` | `parseSitemapXml` (index vs urlset), `fetchAndParseSitemaps` with safeFetch. |
| `storage.ts` | `createCrawlRun`/page records; Supabase when configured, else in-memory `Map`. |
| `types.ts` | `CrawlPageRecord` (status, redirectChain, canonical, robotsMeta, h1H6, wordCount, images, hreflang…), `CrawlQueueState`, `SiteCrawlSummary` (`brokenLinks`, `redirectChains`, `orphanPages`, `missingFromSitemap`, `jsRenderedPages`). |
| `index.ts` | `crawlTargetWebsite` — fetch target + sitemap in parallel, extract text/headings, detect hotel services. 15-min cache. |

**Gaps observed here:**
- **No BFS multi-page crawl.** `crawlTargetWebsite` fetches one page + sitemap listing; `orphanPages`/`brokenLinks`/`redirectChains` in `SiteCrawlSummary` are typed but there is no engine that fills them at scale.
- **No redirect-loop detection.** `fetchPageWithRedirects` iterates to `MAX_REDIRECTS` and returns the trailing 3xx + chain; it does not detect or flag an A→B→A loop.
- **No JS rendering.** `jsRenderedPages` is a *recorded observation* (the snapshot flags `js-rendering-required`); there is no headless renderer (no Playwright/Puppeteer/Browser Rendering dependency anywhere in `package.json`). JS-only content is not fetched.
- **No configurable crawl depth/concurrency per run** beyond the fixed `RateLimiter(2)`.
- **Branding debt:** `CRAWLER_USER_AGENT = "HiltonSEOStudioCrawler/1.0 (+https://hilton-seo-studio.vercel.app)"` and `BOT_TOKEN = "hiltonseostudiocrawler"` in `robots.ts`.

### 2.5 SSRF / egress protection — `src/lib/security/egress.ts`

Strong and already matches the mission: `assertEgressAllowed()` resolves the hostname (DNS) and rejects any private/reserved address; `safeFetch()` follows redirects manually and re-validates **every** hop so an attacker `Location:` header cannot escape; `readTextCapped()` bounds body size. Used by fetcher, sitemap, robots, and the audit runner. IPv4 and IPv6 loopback/private/link-local/metadata (169.254.169.254) are covered.

---

## 3. GEO / AI-visibility / AI layers

| Module | Path | State |
| --- | --- | --- |
| GEO rules | `rules/geo/{llms-txt,ai-crawlers,citability,drift}.ts` | llms.txt status (absent/unavailable/invalid), AI-crawler robots analysis (longest-match, Allow-wins), citability 0–100 (explicitly `estimated`, weighted), drift snapshots. |
| GEO runs | `src/core/geo/{run,drift-store}.ts`, `/api/geo/check` | Local-first snapshots; fail threshold default 5 citability points. |
| AI visibility | `src/core/visibility/{prompts,adapters,analysis,tracker,store,gap-detector}.ts`, `/api/visibility` | Hotel + universal buyer prompts; BYOK adapters ChatGPT/Claude/Perplexity/Gemini; AI Overviews permanently `unavailable`; deterministic mention/citation matching; daily call/cost caps (60/$3). |
| Brain | `src/core/brain/{index,tools,corpus,metering,usage}.ts`, `/api/brain` | Tool-calling orchestrator with 10 tools (5 SEO + 5 GEO); retrieval over indexed `docs/ templates/ rules/ data/ schemas/ shared/`; **claim-to-field provenance gate** with deterministic fallback and 422 on unmapped claims. |
| Training | `src/core/training/dataset.ts`, `/api/training-triples` (+`/review`) | PII stripping, dedupe, tiers `raw`/`reviewed`/`gold`; LoRA export gated at 2,000 reviewed pairs (`scripts/export-lora-dataset.ts`). |
| Healing | `healing/{triage,pipeline,approval,rollback-store,scheduler,gap-plans}.ts` | Approval-gated patch plans (`pending_approval`, `autoApply: false`). |

All AI data from unconnected sources is reported `unavailable`; no fabricated volumes/rankings/citations (verified in `docs/REPOSITORY_AUDIT.md` and the provenance gate).

---

## 4. API surface (`src/app/api/**`)

`ai-training`, `audit-report`, `brain`, `bucket`, `client-email`, `crawl-property`, `drive-sync`, `export-doc`, `full-audit`, `generate-hc`, `generate-kr`, `heading-audit`, `image-audit`, `ingest`, `property-autofill`, `runs`, `select-kw`, `semrush-pull`, `seo-visibility-report`, `sitemap-audit`, `training-triples` (+ `/review`), `usage`, `visibility`, `visibility-suite`, `geo/check`, `platform/session`.

Auth: `src/lib/platform/auth.ts` (`isAuthenticatedPrincipal`, `principalFromRequest`) + session cookie via `/api/platform/session` (operator token). Middleware (`src/middleware.ts`) applies API rate limiting, a cross-origin write guard (CSRF), `noindex` on `/platform` and all `/api/*`, and security headers (HSTS, nosniff, X-Frame-Options DENY, COOP).

---

## 5. Security posture (SEO Studio)

**Present and verified:**
- SSRF defense with DNS resolution + per-hop redirect re-validation (`egress.ts`, `crawler/url.ts`).
- Body-size caps (`readTextCapped`), fetch timeouts, redirect caps, retry caps.
- Rate limiting + CSRF origin check + security headers (`middleware.ts`).
- Session-gated API routes; `401` on unsigned.
- Secrets only via env; `.env*` git-ignored (`.gitignore:108`); no secrets committed.
- Provenance gate prevents unsupported AI claims; `ALLOW_SIMULATED_DATA` must never be set in production (`src/core/data-policy.ts`).
- CMS fixes are approval-gated (`healing/approval.ts`, `cms/runtime/seo-autofix.ts`).

**Gaps / debt:**
- Crawler identifies as `HiltonSEOStudioCrawler` (stale branding).
- On Vercel the writable data dir falls back to temp (ephemeral); durable history needs `COGWHEEL_DATA_DIR`/Supabase (`src/lib/platform/data-dir.ts`, documented in `CHANGELOG.md`).
- No background job/queue: all audits run synchronously inside route handlers (serverless duration limits).
- No redirect-loop detection; no multi-page crawl; no JS rendering.

---

## 6. Tests & checks (baseline, as observed)

- Vitest: **66 files / 426 tests** (`npx vitest run`).
- Node test-runner suites: `npm run test:seo`, `npm run test:ts`.
- Python: **52 passed** (`python3 -m pytest tests/python -q`).
- `npx tsc --noEmit`, `npx next lint`, `npm run build`, extension build + `npm run extension:pack`.

---

## 7. Capability summary vs. mission requirements

| Mission requirement | Current state |
| --- | --- |
| HTTP status & broken links | Status measured per fetch; broken-link *sweep* not implemented (needs multi-page crawl). |
| Redirect chains | Chain captured per fetch; **loops not detected**. |
| Canonical validation | Present (`isCanonicalSelfReferencing`). |
| robots.txt + sitemap analysis | Present (probed, parsed, sitemap discovery). |
| Indexability/crawlability | Present. |
| Meta titles/descriptions | Present, incl. pixel width. |
| Duplicate content/metadata | Partial (uniqueness gate exists in `validators/uniquenessGate.ts`); not run site-wide. |
| Heading hierarchy | Present. |
| Internal linking / orphan pages | Sampled; no full site graph. |
| HTTPS / mixed content | HTTPS + security headers; mixed-content not explicitly flagged. |
| Structured data validation | Present (`rules/schema.ts`, `healing/jsonld-linter.ts`). |
| Image alt text & optimization | Present (`rules/universal/media.ts`, `image-audit`). |
| Mobile usability / rendered-page | Viewport check; **no rendered-page inspection**. |
| Core Web Vitals | Not implemented as measured CWV (documented as unavailable). |
| Multi-page crawl w/ limits | **Missing (single-URL).** |
| Sitemap- + link-based discovery | Sitemap present; link BFS missing. |
| Pagination & URL normalization | Normalization present; pagination handling not implemented. |
| Duplicate URL avoidance | Partial (cache + canonical). |
| Respect robots.txt | Parser present; enforcement in a crawl loop not yet wired (fetcher honors crawler UA but no disallow gate). |
| Configurable depth/concurrency/rate | Rate fixed; depth/concurrency not configurable. |
| Infinite-loop prevention | Redirect cap only; no visited-set dedupe (no BFS). |
| Crawl coverage / failed requests | Types exist; not aggregated. |
| JS-rendered pages | **Not supported.** |
| Per-issue id/url/category/severity/evidence/impact/fix/validation | All present except post-fix **validation status**. |
| Evidence-based AI assistant | Present (brain + provenance gate + measured/unavailable labelling). |
| Human approval before live changes | Present. |

---

## 8. Conclusion

SEO Studio already has a disciplined, evidence-first single-page audit engine and strong SSRF/security controls. The material gaps — all confirmed in code — are: **multi-page crawling with coverage tracking, redirect-loop detection, configurable depth/concurrency/rate limits, robots-enforced crawl loop, JS-rendered page support, and asynchronous/background execution.** These align exactly with the user's stated top priority, and none of the three external accounts provides a drop-in crawler, so the work is in-repo, incrementally, on top of existing code.
