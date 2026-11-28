# API Reference

HTTP surface of SEO Studio: **40 Next.js App Router routes** under `src/app/api/`,
plus the FastAPI Python service (`api/server.py`) and the remaining Python modules in
`api/` (library code and an MCP server).

Base path for all routes: `/api/…` — served by the Next.js app (`npm run dev`, port 3000),
or production on Vercel.

Request and response bodies are validated by the shared zod schemas in
`src/schemas/validation.ts` and `validators/schemas/`. This document describes the
contract at the route level; the schemas are the source of truth for field shapes.

---

## Authentication

| Mechanism | Where | Env var |
| --- | --- | --- |
| Platform principal (`principalFromRequest` → RBAC, rate limit, audit log) | 10 routes: `/platform/*`, `/outcomes`, `/usage*`, `/brain`, `/geo/check`, `/visibility*`, `/training-triples*` | `PLATFORM_OPERATOR_TOKEN` |
| Bearer token | `/api/ai-training` | `SEO_STUDIO_API_BEARER_TOKEN` |
| None (local/dev tooling) | remaining routes | — |

`/api/platform/session` reports which of these are configured:

```
GET /api/platform/session → { authenticated, principal, devAuth, signInConfigured }
```

Routes without auth are intended for local operator use. Do not expose the deployment
publicly without putting the platform principal in front of them.

### Optional feature env vars

| Var | Enables |
| --- | --- |
| `SEMRUSH_API_KEY` | direct Semrush Analytics pull (`/semrush-pull`) |
| `SEO_STUDIO_ALLOW_LOCAL_PYTHON` | routes that shell out to local Python |
| `PYTHON_SERVICE_URL` + `SEO_PY_SERVICE_TOKEN` | HTTP bridge to the Python service (`api/server.py`) — enables `/api/content-similarity` and HTTP report generation for `/api/seo-visibility-report` |
| `SEO_STUDIO_ALLOW_LOCAL_MAIL_CLI` + `SEO_STUDIO_MAIL_CLI_PATH` + `SEO_STUDIO_MAIL_ACCOUNT` | local mail send for `/client-email` |
| `SEO_STUDIO_DATA_DIR` | override the local data directory |
| `VERCEL` | set automatically; routes behave differently on serverless (see `/training-triples`) |

---

## Routes

### Audit & scoring

| Method(s) | Route | Purpose |
| --- | --- | --- |
| `POST`, `GET` | `/api/full-audit` | Full-site audit run and result retrieval. |
| `POST` | `/api/audit-report` | Export the rendered report as HTML, PDF, CSV or PPTX. The browser posts back the report it already rendered, so the download matches what the operator saw. |
| `POST`, `GET` | `/api/heading-audit` | Heading structure audit (H1–H6 order, multiple-H1, depth). |
| `POST`, `GET` | `/api/image-audit` | Image audit — alt text, lazy loading, dimensions, formats. |
| `POST` | `/api/sitemap-audit` | Sitemap coverage and indexability audit. |
| `POST`, `GET` | `/api/geo/check` | GEO/AI-engine checks; provenance is embedded per check and mirrored in the summary for clients. |

### Keywords & content

| Method(s) | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/bucket` | Deterministic keyword bucketing + 78-keyword quota allocation. |
| `POST` | `/api/select-kw` | Page-to-keyword matcher (KD < 45 rule, with a high-volume exception flag). |
| `POST` | `/api/generate-hc` | Headline/content generation — thin wrapper over the registered `usp-headline-optimization` task. |
| `POST` | `/api/generate-kr` | Keyword research — thin wrapper over the registered `keyword-research` task. |
| `POST` | `/api/templates/inspect` | Inspect a template for placeholders and guardrail violations. |
| `POST` | `/api/content-similarity` | Thin-content / duplicate audit via the Python service (`TF-IDF`/`Jaccard`). zod-capped like `api/server.py`; `501` when `PYTHON_SERVICE_URL` is unset. |
| `POST` | `/api/semrush-pull` | Direct Semrush Analytics API pull (requires `SEMRUSH_API_KEY`). |
| `POST` | `/api/drive-sync` | Import Semrush CSV/XLSX from a property's Google Drive folder (`01-semrush/`). |

### Property & client

| Method(s) | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/crawl-property` | Auto-discover property details (city/state, pet policy, active sitemap pages) from a URL. |
| `POST` | `/api/property-autofill` | Prefill property metadata from a URL. |
| `POST` | `/api/client-email` | Client email composer. Side-effect free by default: returns Gmail compose and `mailto:` links the operator opens themselves; an optional local mail CLI sends only when explicitly enabled. |
| `GET` | `/api/export-doc` | Document export download. |

### AI, brain & training data

| Method(s) | Route | Purpose |
| --- | --- | --- |
| `POST`, `GET` | `/api/brain` | Brain/provenance endpoint — provenance anchors for generated claims. |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/ai-training` | Extension batch sync: full CRUD over training records. Bearer-authenticated. |
| `POST`, `GET` | `/api/training-triples` | Triple export. Writes go to a temp dir — on serverless that storage is ephemeral, and the route surfaces that honestly rather than pretending durability. |
| `GET`, `POST` | `/api/training-triples/review` | Review queue for captured triples. |
| `POST` | `/api/ingest` | `multipart/form-data` ingest: `files[]` (≤50 CSV/XLSX), `property` (JSON), `rules?` (JSON). |

### Tasks & runs

| Method(s) | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks/summary` | Summary of registered tasks and their state. |
| `POST` | `/api/tasks/site-crawl/run` | Start a site crawl, or advance the next batch for an existing `crawlRunId`. |
| `GET` | `/api/tasks/site-crawl/runs` | List site-crawl runs. |
| `POST` | `/api/tasks/[taskId]/run` | Run a task by id. |
| `GET` | `/api/tasks/[taskId]/runs` | List runs for a task. |
| `POST` | `/api/runs` | Persist a run (property upsert, 78-KW pool, approval matrix) to Supabase. |

### Visibility & reporting

| Method(s) | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/visibility` | Visibility state. Reviewable only — nothing is applied without operator approval. |
| `GET`, `POST` | `/api/visibility/gaps` | Keyword gap analysis. |
| `POST` | `/api/visibility-suite` | Suite actions (`export_payload` \| `sync_api` \| `import_report`). |
| `POST` | `/api/seo-visibility-report` | Monthly visibility report (15-minute in-memory cache). Generation chain: HTTP bridge to `api/server.py` when `PYTHON_SERVICE_URL` is set → local `execFile` builder behind `SEO_STUDIO_ALLOW_LOCAL_PYTHON=1` → `501` with instructions. Nothing runs by default. |

### Platform gateway

| Method(s) | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/platform/[...path]` | Catch-all mounting the framework-agnostic gateway at `/api/platform/v1/*`. Every verb is forwarded to `gateway.handle()` after the principal is resolved, so gateway RBAC, rate limiting, audit log, history and rollback apply unchanged. E.g. `POST /api/platform/v1/deployments`, `GET /api/platform/v1/audit-log`. Returns `405` for unsupported methods. |
| `GET`, `POST`, `DELETE` | `/api/platform/session` | Operator session: read auth state, exchange `PLATFORM_OPERATOR_TOKEN`, sign out. |
| `GET`, `POST` | `/api/outcomes` | Outcome records (written through `core/outcomes/record.ts`). |
| `GET` | `/api/usage` | Usage for the current principal. |
| `GET` | `/api/usage/all` | Aggregate usage across principals (platform-authenticated). |

---

## Python side (`api/`)

`api/server.py` is a **FastAPI HTTP service**; the rest of the directory holds
library modules and one MCP server:

| File | What it is |
| --- | --- |
| `api/server.py` | **FastAPI service** — HTTP bridges over the libraries below. Run from the repo root: `uvicorn api.server:app --host 127.0.0.1 --port 8077` (or `python3 api/server.py`). |
| `api/content_engine.py` | Library — batch thin-content detection, TF-IDF / Jaccard similarity (>70% duplicate blocker), internal-link graph manifest generator. Served at `POST /v1/content/similarity` and `POST /v1/content/link-graph`. |
| `api/models.py` | Library — Pydantic models mirroring the TypeScript schemas in `validators/schemas/index.ts` and `shared/schemas/`. Served at `POST /v1/content/validate`. |
| `api/seo_visibility_report.py` | CLI/library — builds the monthly SEO visibility PowerPoint from a template plus Semrush PDF/XLSX. Served at `POST /v1/reports/seo-visibility` (multipart uploads in, pptx bytes out). |
| `api/gsc_server.py` | **MCP server** (`FastMCP("gsc-server")`) exposing Google Search Console tools to MCP clients such as Claude Desktop. Requires Python 3.11+ and exits loudly on older versions (issue #19). Run from the repo root after `pip install -r requirements.txt`: `npm run gsc:mcp` (i.e. `python3 api/gsc_server.py`); `MCP_TRANSPORT=stdio` (default) or `MCP_TRANSPORT=sse` with `MCP_HOST`/`MCP_PORT` (the SSE path is localhost-bound by default). Credentials come from a service-account JSON on disk (`GSC_CREDENTIALS_PATH` or `service_account_credentials.json` beside the script — never committed); OAuth flow files come from `GSC_OAUTH_CLIENT_SECRETS_FILE`. Tool/config state lives in `GSC_CONFIG_DIR` (default: user config dir `mcp-gsc`), and `GSC_SKIP_OAUTH=1` / `GSC_ALLOW_DESTRUCTIVE=1` gate OAuth and write tools. Covered by `tests/python/test_legacy_scripts.py`. |

### Python service contract

```
GET  /health                      liveness probe (no auth, status only)
POST /v1/content/similarity       { pages[{id,url?,content}], max_similarity?, min_words? }
POST /v1/content/link-graph       { items[{url,parentPage?,primaryKeyword?,...}], max_links_per_page? }
POST /v1/content/validate         { kind, payload } → 200 { valid, data } | 413 field cap | 422 { detail: { valid: false, errors } }
POST /v1/reports/seo-visibility   multipart: template (.pptx), xlsx (.xlsx), pdf? (.pdf) → pptx bytes
```

Security (fail-closed): with `SEO_PY_SERVICE_TOKEN` set, every `/v1/*` call must
send `Authorization: Bearer <token>` (constant-time compare). Without a token the
service only answers loopback peers — the HTTP layer 403s non-loopback peers on
`/v1/*`, and the CLI refuses a non-loopback bind unless `SEO_PY_SERVICE_TOKEN`
and `SEO_PY_SERVICE_ALLOW_REMOTE=1` are both set. Payload caps (50 pages,
200k chars/document, 500 manifest items, 25MB uploads, extension allow-list)
reject oversized input with 413/422 before any work starts; uploads land under
server-generated names; no shell is involved anywhere; the service is stateless
(env read per request, no module-level mutable state).

The Node bridges read `PYTHON_SERVICE_URL` (base URL) and `SEO_PY_SERVICE_TOKEN`
from server env only — never from a request — so a caller cannot steer those
fetches. Unset `PYTHON_SERVICE_URL` disables the bridge entirely: `/api/content-similarity`
answers `501` and report generation falls through to the local `execFile` path
(behind `SEO_STUDIO_ALLOW_LOCAL_PYTHON=1`), then `501`.

---

## Error shape

Route handlers return JSON errors with an `error` object:

```json
{ "error": { "code": "method_not_allowed", "message": "PUT" } }
```

`code` is a stable machine-readable string; `message` is human-readable. Status codes
follow the usual semantics (`400` validation, `401`/`403` auth, `404` unknown route,
`405` wrong method, `429` rate limit, `5xx` upstream).

## Adding a route

1. Create `src/app/api/<name>/route.ts` exporting `GET`/`POST`/`PATCH`/`DELETE`.
2. Export `const runtime = "nodejs"` and `const dynamic = "force-dynamic"` for anything
   touching the filesystem, env vars or auth — static optimization must not cache it.
3. Validate input with the shared zod schemas; never trust raw `request.json()`.
4. If the route mutates state or reads operator data, resolve the principal with
   `principalFromRequest` from `src/lib/platform/auth.ts`.
5. Document it in the table above in the same PR.
