# Self-Healing & Automated Fixing Pipeline — Implementation Notes (Phase 4)

Implements **Phase 4** of [`ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md`](./ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md):
the closed loop that turns an audit into a verified, safely-rolled-back fix.

```
┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
│ 1. Scan &  │──▶│ 2. Triage &│──▶│ 3. Staging │──▶│ 4. Atomic  │──▶│ 5. Post-Fix│──▶│ 6. Rollback│
│   Detect   │   │ Synthesize │   │ & Approval │   │ CMS Deploy │   │   Verify   │   │ (if failed)│
└────────────┘   └────────────┘   └────────────┘   └────────────┘   └────────────┘   └────────────┘
```

The layer **composes** the earlier phases rather than replacing them: it runs the
Phase 1 audit engine, the Phase 2 AI patch generator and the Phase 3 CMS
connectors, then adds triage, an approval gate, a versioned rollback store,
micro-crawler verification and an operator event log. Nothing in Hotel Mode or
the existing exporters changes.

## Layout

```
healing/
├── index.ts           # public barrel
├── types.ts           # triage / approval / snapshot / verification / event contracts
├── triage.ts          # issue + patch risk classification (roadmap step 2)
├── approval.ts        # Auto-Pilot policy, approval gate + queue (step 3)
├── rollback-store.ts  # versioned pre-change snapshots (step 4/6)
├── jsonld-linter.ts   # structured-data validation
├── micro-crawler.ts   # live DOM fetch + expectation checks (step 5)
├── events.ts          # HealingEventBus feeding the operator dashboard
├── scheduler.ts       # cron / webhook / manual scan triggers (step 1)
└── pipeline.ts        # runHealingPipeline orchestrator
```

## One run, end to end

```ts
import { runHealingPipeline } from "./healing/index.ts";

const result = await runHealingPipeline({
  report,                 // Phase 1 AuditReport
  connector,              // Phase 3 CmsConnector bound to a credential + target
  policy: { enabled: true, maxRisk: "low" },
  fetchImpl: fetch,       // injectable for tests/edge
});

result.status;              // "deployed" | "rolled_back" | "queued" | "failed"
result.approval.status;     // "pending" | "auto_approved" | "approved" | "rejected"
result.verification;        // live HTTP / DOM / JSON-LD report
result.snapshotId;          // id in the rollback store
result.events;              // timeline for the side-panel dashboard
```

## 1 · Continuous / scheduled scan (`scheduler.ts`)

- `createScanScheduler()` holds cron schedules and a job queue.
- Triggers: `takeDue()` (cron), `onCmsPublish()` (CMS webhook), `manual()` (extension UI).
- `matchesCron()` is a dependency-free 5-field matcher supporting `*`, lists,
  ranges and steps; a schedule fires at most once per minute.

## 2 · Triage & synthesis (`triage.ts`)

Operational risk follows the roadmap exactly:

| Tier | Examples |
| --- | --- |
| **Low** | missing image alt text, missing meta descriptions, missing basic JSON-LD |
| **Medium** | title tag changes, H1 changes, internal link edits |
| **High** | canonical changes, redirects, main body-copy edits, `meta_robots` |

Per-mutation risk is the **most conservative** of the roadmap field tier and the
tier the AI layer assigned, so a model can never downgrade a canonical edit to
auto-apply. A patch is `autoDeployable` only when every deployable mutation is
low risk and none needs manual review.

## 3 · Approval gate & Auto-Pilot (`approval.ts`)

- **Auto-Pilot off (default)** → every patch is `pending` in the queue; the CMS is
  never written.
- **Auto-Pilot on** → mutations at or below `maxRisk` are `auto_approved`; higher
  ones stay queued. `manual_review` mutations are never deployed.
- Operators can `decide(id, "approved" | "rejected", note)` on queued requests.

## 4 · Atomic deploy + versioned rollback (`pipeline.ts`, `rollback-store.ts`)

Before any write the connector's `readSnapshot()` is persisted with a
monotonically increasing **version per target URL**. On apply failure, a thrown
error, or a failed live verification, the snapshot is restored and the run is
marked `rolled_back` with an operator alert.

## 5 · Post-fix verification (`micro-crawler.ts`, `jsonld-linter.ts`)

Within seconds of deployment the live public URL is fetched and checked for:

- HTTP 200,
- the target DOM values (title, meta description, canonical, OG/Twitter, H1, viewport) matching the approved patch,
- injected JSON-LD parsing **and** passing the structured-data linter
  (`Organization` needs `name`, `Product` needs `name` + `offers`, `LocalBusiness`
  /`Hotel` need `name` + `address`, …).

Only fields the crawler can actually read back are asserted, so alt-text and
schema-only fixes don't produce false failures.

### Connector-aware verification

A connector can override how its deploy is verified through `verificationMode`:

- `"live-dom"` (default) — fetch the public URL and compare the rendered DOM /
  JSON-LD, as described above.
- `"connector"` — the fix is applied **client-side** (the universal runtime
  connector serves a patch config the browser applies), so the server HTML never
  changes. A DOM comparison would always fail; the pipeline defers to the
  connector's own `verify()` instead.

A connector may also implement `supportsField(field)`. Fields the connector
cannot express are filtered out of the deploy before it runs, so the run reports
`queued` (nothing auto-applied) rather than deploying a partial patch and
rolling back.

> The roadmap mentions a ~15s settle delay; `settleMs` defaults to 0 and is
> injectable (`sleep`) so tests run instantly and production can wait for caches.

## 6 · Rollback (`pipeline.ts`)

Restores the most recent snapshot for the target and emits `rolled_back` +
`alert` events, both of which surface in `HealingEventBus.alerts()` for the
dashboard.

## Contracts

- `schemas/healing-run.schema.json` — the `HealingRunResult` payload.

## Tests

`tests/healing-pipeline.test.ts` (Vitest, **31 tests**) covers cron matching and
schedule queueing, field/issue/patch triage, the Auto-Pilot approval gate and
queue decisions, rollback-store versioning, the JSON-LD linter, micro-crawler
verification (match, mismatch, HTTP error, network error), the event bus, the
scan scheduler, connector-aware deployment (runtime connector mode, unsupported
fields deferred), and the full pipeline (queued with no write, deploy→verify,
JSON-LD verification, rollback on DOM mismatch, rollback on CMS rejection,
early failure on snapshot error, injected bus/store).

```bash
npx vitest run tests/healing-pipeline.test.ts tests/cms-integration.test.ts tests/ai-seo-brain.test.ts tests/universal-mode.test.ts
# 101 passed
```

## Remaining Phase 4 items

- Host the scheduler worker (BullMQ / Cloud Scheduler) that drains due jobs and
  calls `runHealingPipeline`, wired to CMS publish webhooks.
- Back `RollbackStore` with PostgreSQL/Redis instead of memory.
- Wire the Chrome-extension side panel to `HealingEventBus` and the approval
  queue (approve/reject + live diff preview; the diff is already produced by
  `previewPatchDiff`).
- Surface `HealingRunResult` as a dashboard with before/after diffs, per-run
  timeline and one-click manual rollback.
