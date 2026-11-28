# Platform Runtime, Governance & Operator Console (Phase 5)

Implements the production requirements from
[`ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md`](./ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md)
(§3 *Backend Orchestration Layer* and §7 *Security, Trust & Rollback Safeguards*):
the authenticated, rate-limited, fully-audited control plane that ties
Phases 1–4 together, plus the durable persistence and in-app operator console
delivered in Phase 5.1.

It is **additive** — nothing in Hotel Mode, the exporters or Phases 1–4 changes.

## Layout

```
platform/
├── index.ts                # public barrel
├── types.ts                # principal / permission / audit / history / request contracts
├── errors.ts               # PlatformError + HTTP-mapped helpers
├── rbac.ts                 # Viewer / Specialist / Admin permission matrix
├── audit-log.ts            # append-only SHA-256 hash-chained log
├── rate-limit.ts           # token bucket + exponential backoff + serial queue
├── history.ts              # deployment history + one-click undo
├── patch-store.ts          # reviewed patch retention (for approvals)
├── connector-registry.ts   # target URL → bound CmsConnector
├── credential-store.ts     # vault-sealed credential persistence
├── gateway.ts              # framework-agnostic request router / service
├── durable.ts              # hydrate + write-through persistence wiring
├── worker.ts               # scheduler drain → healing pipeline
├── http.ts                 # node:http adapter + dev authenticator
└── persistence/
    ├── adapter.ts          # PersistenceAdapter contract + collection names
    ├── memory-adapter.ts   # in-memory (tests / ephemeral)
    └── jsonl-adapter.ts    # durable NDJSON files (atomic, locked)
```

The gateway is **HTTP-framework-agnostic**: `handle(request)` takes a normalized
`PlatformRequest` and returns a `PlatformResponse`, so the same code backs the
Next.js route handlers, the `node:http` adapter and unit tests.

## Roles (RBAC)

| Capability | Viewer | Specialist | Admin |
| --- | :---: | :---: | :---: |
| Read audits / patches / history / audit log / connectors | ✅ | ✅ | ✅ |
| Run audits & manage schedules | — | ✅ | ✅ |
| Approve & deploy **low/medium** risk | — | ✅ | ✅ |
| Approve **high** risk | — | — | ✅ |
| One-click undo | — | ✅ | ✅ |
| Connect CMS credentials & targets | read only | read only | ✅ |

`authorize(principal, permission)` throws `401`/`403`; `requireRiskApproval`
enforces the risk ceiling (a specialist cannot approve a canonical/`meta_robots`
change — that needs an admin).

## Immutable audit logging

Every credential change, patch queue/approve/reject, deploy, rollback, audit,
connector registration and undo is appended with actor, role, timestamp and
before/after state. Entries are linked by SHA-256 (`previousHash` + canonical
contents) and **append-only**: there is no update or delete API. `verify()`
recomputes the chain and reports the first broken sequence, so any tampering is
detectable. The canonical form skips `undefined` properties, so the hash is
identical before and after a JSON round-trip (i.e. across a restart).

```
GET /v1/audit-log          → { entries, verification }
GET /v1/audit-log?verify=1 → { verification: { valid, entries, brokenAt } }
```

## Rate limiting & backoff

- `createTokenBucket` / `createRateLimiter` — per-principal and per-CMS-host
  token buckets (burst + sustained), returning `429` with `Retry-After`.
- `withRetry` — capped exponential backoff with jitter for transient CMS
  `429`/`5xx` responses.
- `createSerialQueue` — never runs two writes against the same target at once.

## Deployment history & one-click undo

`POST /v1/deployments` and `POST /v1/heal` record a `DeploymentHistoryEntry`
with the snapshot captured before the write. `POST /v1/history/{id}/undo`
restores that snapshot through the connector, marks the entry undone and writes a
`history.undo` audit event.

## API surface

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/v1/health` | public |
| `GET` / `POST` | `/v1/credentials` | `credential:read` / `credential:write` (admin) |
| `GET` / `POST` | `/v1/connectors` | `connector:read` / `connector:write` (admin) |
| `POST` | `/v1/audits` | `audit:run` |
| `POST` | `/v1/patches/preview` | `patch:read` |
| `POST` | `/v1/deployments` | `patch:deploy` |
| `GET` | `/v1/approvals` | `patch:read` |
| `POST` | `/v1/approvals/{id}/approve` | `patch:approve` + risk ceiling |
| `POST` | `/v1/approvals/{id}/reject` | `patch:approve` |
| `POST` | `/v1/heal` | `audit:run` + `patch:deploy` |
| `GET` | `/v1/history` | `history:read` |
| `POST` | `/v1/history/{id}/undo` | `history:undo` |
| `GET` | `/v1/audit-log` | `audit-log:read` |
| `GET` | `/v1/events` | `audit:read` |
| `GET` / `POST` | `/v1/schedules` | `schedule:read` / `schedule:write` |

### Deployment semantics

- `dryRun: true` → returns the diff and touches nothing.
- `autoPilot: true` **and** the patch is all-low-risk → deploys immediately.
- `approveAll: true` → operator approval (risk-ceiling checked) then deploy.
- otherwise → the patch is stored and routed to the approval queue (`202`).

### Targets

`POST /v1/connectors` binds a page URL to a connector:

- with `credentialId` → the Phase 3 credential factory (WordPress / Shopify /
  Webflow),
- without → the universal runtime connector (works on any site by serving a
  client-side patch config).

`POST /v1/audits` fetches the page, runs the Phase 1 rules and returns a
standardized `AuditReport` — the entry point the console uses before healing.

## Durable persistence (Phase 5.1)

`createDurablePlatform()` hydrates the stores from a `PersistenceAdapter`,
attaches write-through hooks, and flushes the write queue after each request:

```
adapter.readAll() ─▶ createAuditLog/createDeploymentHistory/…(initial)
                       │
        every store mutation ─▶ write queue ─▶ adapter.append/put/remove
                       │
        gateway.handle() ─▶ onRequestComplete ─▶ flush()
```

Two adapters ship:

- `createMemoryAdapter()` — ephemeral; the default in tests.
- `createJsonFileAdapter({ dir })` — durable NDJSON, one file per collection,
  atomic rewrites (`temp + rename`) under a per-collection lock. Good for a
  container volume or a single-instance deployment.

```ts
import { createDurablePlatform, createJsonFileAdapter } from "./platform/index.ts";

const platform = await createDurablePlatform({
  adapter: createJsonFileAdapter({ dir: ".platform-data" }),
  vault: createCredentialVault(process.env.CMS_VAULT_KEY!),
});

await platform.close(); // flush + release handles
```

To move to PostgreSQL/Redis, implement the four-method `PersistenceAdapter`
(`readAll`, `append`, `put`, `remove`) and pass it in — no gateway changes.

## Next.js mount

`src/app/api/platform/[...path]/route.ts` forwards every verb to the gateway at
`/api/platform/v1/*`:

- `src/lib/platform/runtime.ts` — memoized singleton that builds the durable
  platform (NDJSON on disk, `/tmp` on Vercel, or in-memory with
  `PLATFORM_STORAGE=memory`).
- `src/lib/platform/auth.ts` — maps the request to a `Principal`. **Replace
  `principalFromRequest()` with real JWT/session verification before
  production**; the dev implementation reads `x-actor-*` headers or the
  `cw_actor_*` cookies the console sets.
- `src/lib/platform/client.ts` — typed browser client used by the console.

| Env var | Purpose |
| --- | --- |
| `CMS_VAULT_KEY` | AES-256-GCM key for stored CMS secrets (**required** in prod) |
| `PLATFORM_DATA_DIR` | NDJSON directory (default `.platform-data`) |
| `PLATFORM_STORAGE` | `memory` to disable disk persistence |
| `VERCEL` | auto-detected; defaults storage to `/tmp` |

## Operator console

`/platform` renders `src/components/OperatorConsole.tsx`:

- **Overview** — pending approvals, undoable changes, audit integrity, recent
  activity, runtime health.
- **Approvals** — review queued patches; approve/reject with the role's risk
  ceiling enforced (a specialist sees high-risk approvals disabled).
- **History** — every deployment with a snapshot-backed **Undo**.
- **Audit log** — the hash-chained entries plus a **Verify chain** action.
- **Targets** — register page URLs, store CMS credentials (admin), schedule
  scans.
- **Self-heal** — enter a URL, scan it, inspect the issues, then auto-heal
  (low/medium), force-approve (admin) or queue for review; the pipeline result
  shows the applied mutations and post-fix verification.

A role switcher (viewer / specialist / admin) drives the dev identity so the
RBAC behaviour is demonstrable end-to-end.

### Connector-aware verification

A connector declares how a deploy should be verified via `verificationMode`:

- `"live-dom"` (default) — the pipeline fetches the public URL and compares the
  rendered DOM / JSON-LD against the expected values.
- `"connector"` — the fix is applied **client-side** (the universal runtime
  connector), so the server HTML is intentionally unchanged. Comparing it would
  always fail; the pipeline trusts the connector's own `verify()` instead.

Connectors may also implement `supportsField(field)`. The pipeline filters
unsupported fields out of the deploy (the run reports `queued` rather than
rolling back) so a platform that cannot express, say, `image_alt_text` degrades
gracefully instead of failing.

## Scan worker

```ts
import { createScanWorker, createHealingRunner, createScanScheduler } from "./platform/index.ts";

const worker = createScanWorker({
  scheduler,
  runner: createHealingRunner({ resolveConnector, resolveReport, policy: { enabled: true, maxRisk: "low" } }),
});
await worker.tick();   // drain due jobs now (cron route / queue worker)
worker.start();        // or poll on an interval
```

## ML runtime environment (Phase 0)

Optional knobs for the tuned-model and embedding path. All five are empty in
`.env.example` and none of them is required: with them unset the router keeps
using the existing providers and RAG keeps the offline hashing embedder, so CI
and the extension continue to work with no model server and no network.

| Variable | Consumed by | When unset |
|---|---|---|
| `CUSTOM_MODEL_ENDPOINT` | `ai/router.ts` → the existing `seo-studio-tuned` provider | provider reports `configured: false`, route falls back |
| `CUSTOM_MODEL_ID` | same | model id from `src/core/ai/models.ts` |
| `CUSTOM_MODEL_API_KEY` | same (optional bearer) | request sent without an `Authorization` header |
| `SERVE_UPSTREAM` / `--upstream` | `ml/serve/server.py` (gateway in front of the adapter) | gateway answers `503 upstream_not_configured` — never a fabricated completion (D-022) |
| `SERVE_API_KEY` / `--api-key` | same | `/v1/*` accepts requests without a bearer |
| `UPSTREAM_API_KEY` | same | upstream called without an `Authorization` header |
| `EMBEDDINGS_ENDPOINT` | `ai/rag/embedder.ts` → `HttpEmbedder` | deterministic hashing embedder is used |
| `ML_PRIVATE_DATASET_REPO` | `ml/build`, `ml/train` | datasets are written to `data/build/` only, never pushed |

Rules that apply to this path:

- **SSRF guard** — `CUSTOM_MODEL_ENDPOINT` and `EMBEDDINGS_ENDPOINT` are
  resolved through the same DNS-aware SSRF guard as every crawl target
  (docs/SECURITY.md). They are never accepted from a request body.
- **Fail-closed** — any endpoint this path calls requires the signed `cw_session`
  and RBAC from `platform/rbac.ts`, and is rate-limited by
  `platform/rate-limit.ts`.
- **No prompt logging** — only ids, providers, latency and outcomes are logged;
  never prompts, page text or client data.
- **No weights in this repo** — `ML_PRIVATE_DATASET_REPO` must point at a
  *private* Hugging Face repo. `.gitignore` already excludes
  `*.safetensors`, `*.gguf`, `*.bin`, `data/raw/` and `data/build/`.

## Contracts

- `schemas/platform-runtime.schema.json` — audit-log entry, history entry and
  gateway request/response envelopes.

## Tests

`tests/platform-runtime.test.ts` (**36 tests**) covers the RBAC matrix and risk
ceilings, hash-chained audit log + tamper-sensitive hashing, token buckets /
backoff / serial queue, deployment history and undo (including conflict /
not-found paths), the scan worker (cron drain, retry, non-retryable errors,
healing runner), and every gateway route.

`tests/platform-durable.test.ts` (**9 tests**) covers both persistence adapters
(including concurrent appends), write-queue ordering and error surfacing,
restart hydration (audit chain, history, snapshots, redacted credentials), the
`/v1/audits` scan route and `/v1/connectors` registration + RBAC.

`tests/healing-pipeline.test.ts` (**31 tests**) additionally covers the
connector-aware deployment path: the universal runtime advertises
`verificationMode: "connector"` and `supportsField`, a runtime patch deploys and
verifies through the connector (not the live DOM), and unsupported fields are
deferred instead of failing.

```bash
npx vitest run tests/platform-runtime.test.ts tests/platform-durable.test.ts \
  tests/healing-pipeline.test.ts tests/cms-integration.test.ts \
  tests/ai-seo-brain.test.ts tests/universal-mode.test.ts
# 146 passed
```

## Remaining production wiring

- Swap the NDJSON adapter for PostgreSQL/Redis for multi-instance deployments.
- Replace the development principal reader with real JWT/session verification.
- Drive `createScanWorker` from Cloud Scheduler / BullMQ and connect CMS publish
  webhooks to `scheduler.onCmsPublish()`.
- Add PostgreSQL row-level tenancy once `organizationId` scoping is enforced in
  the stores (the field is already carried end-to-end).