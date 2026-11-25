# Platform Runtime, Governance & Operator API — Implementation Notes (Phase 5)

Implements the remaining production requirements from
[`ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md`](./ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md)
(§3 *Backend Orchestration Layer* and §7 *Security, Trust & Rollback Safeguards*):
the authenticated, rate-limited, fully-audited control plane that ties
Phases 1–4 together.

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
├── worker.ts               # scheduler drain → healing pipeline
└── http.ts                 # node:http adapter + dev authenticator
```

The gateway is **HTTP-framework-agnostic**: `handle(request)` takes a normalized
`PlatformRequest` and returns a `PlatformResponse`, so the same code backs
Next.js route handlers, the `node:http` adapter and unit tests.

## Roles (RBAC)

| Capability | Viewer | Specialist | Admin |
| --- | :---: | :---: | :---: |
| Read audits / patches / history / audit log | ✅ | ✅ | ✅ |
| Run audits & manage schedules | — | ✅ | ✅ |
| Approve & deploy **low/medium** risk | — | ✅ | ✅ |
| Approve **high** risk | — | — | ✅ |
| One-click undo | — | ✅ | ✅ |
| Connect CMS write credentials | — | read only | ✅ |

`authorize(principal, permission)` throws `401`/`403`; `requireRiskApproval`
enforces the risk ceiling (a specialist cannot approve a canonical/`meta_robots`
change — that needs an admin).

## Immutable audit logging

Every credential change, patch queue/approve/reject, deploy, rollback and undo is
appended with actor, role, timestamp and before/after state. Entries are linked
by SHA-256 (`previousHash` + canonical contents) and **append-only**: there is no
update or delete API. `verify()` recomputes the chain and reports the first
broken sequence, so any tampering is detectable.

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

## Usage

```ts
import {
  createPlatformGateway,
  createHttpServer,
  createHeaderAuthenticator,
} from "./platform/index.ts";
import { createCredentialVault } from "./cms/index.ts";

const gateway = createPlatformGateway({
  vault: createCredentialVault(process.env.CMS_VAULT_KEY!),
  fetchImpl: fetch,
});

gateway.connectors.register("https://example.com/blog/post", connector);
gateway.scheduler.register({ targetUrl: "https://example.com/blog/post", cron: "0 3 * * *" });

createHttpServer({ gateway, authenticate: createHeaderAuthenticator() }).listen(8080);
```

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

## Contracts

- `schemas/platform-runtime.schema.json` — audit-log entry, history entry and
  gateway request/response envelopes.

## Tests

`tests/platform-runtime.test.ts` (Vitest, **36 tests**) covers the RBAC matrix
and risk ceilings, hash-chained audit log + tamper-sensitive hashing, token
buckets / backoff / serial queue, deployment history and undo (including
conflict/not-found paths), the scan worker (cron drain, retry, non-retryable
errors, healing runner), and every gateway route — auth, credential redaction,
preview, dry-run, deploy, queue→approve (with specialist blocked / admin
allowed)→deploy, reject, history+undo, audit verification, events, schedules,
429 rate limiting, 404 routing and the full self-healing run.

```bash
npx vitest run tests/platform-runtime.test.ts tests/healing-pipeline.test.ts \
  tests/cms-integration.test.ts tests/ai-seo-brain.test.ts tests/universal-mode.test.ts
# 134 passed
```

## Remaining production wiring

- Replace the in-memory stores (audit log, history, credentials, patches,
  rollback snapshots) with PostgreSQL/Redis behind the same interfaces.
- Mount the gateway in Next.js route handlers (`src/app/api/platform/[...path]`)
  and add real JWT/session verification to `Authenticate`.
- Drive `createScanWorker` from Cloud Scheduler / BullMQ and connect CMS publish
  webhooks to `scheduler.onCmsPublish()`.
- Build the side-panel UI against `/v1/approvals`, `/v1/history`, `/v1/events`
  and `/v1/audit-log`.