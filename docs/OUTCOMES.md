# Outcome logging

Outcome logging is how SEO Studio answers the only question that matters after a fix:
**did the page actually do better?** It records every change, then measures the
page's Google Search Console performance over matched **before/after** windows and
compares it with a set of **unchanged control pages**.

It exists so no "impact" number is ever attributed to a change by assertion. An
outcome is either **measured** (real Search Console rows), or **unavailable** with a
reason (Search Console not connected, no rows, or the after-window is still filling).
It is never estimated, and never invented.

## Model

| Concept | Type | Notes |
|---|---|---|
| Change | `ChangeEvent` (`src/core/outcomes/types.ts`) | One changed page: `pageUrl`, `appliedAt`, `kind`, `fixRef`, `tenantId`, `provenance`. |
| Windows | `WindowPlan` (`windows.ts`) | `before` = the `windowDays` days ending the day before the change; `after` starts `leadDays` after it. |
| Measurement | `OutcomeRecord` | Measured `before`/`after`/`delta` for the changed page, plus the control set's `before`/`after`/`delta`. |

Defaults: `windowDays = 28`, `leadDays = 3` (Search Console's reporting lag). The
after-window is clamped to today and flagged `afterComplete: false` while it is
still filling, so a partial window is never presented as a result.

### Control pages

`selectControlPages` picks the highest-impression pages in the **before** window,
excluding the changed page, deterministically (path is the tie-break). The control
delta is a naive baseline: it absorbs site-wide movement (seasonality, a core
update) so a change is only interesting when it moves the page *relative to* the
controls. Matching controls by template and traffic band is a planned refinement.

## Honesty rules

- **No Search Console → `unavailable`.** `measureChange` returns early with a reason;
  it never falls back to simulated numbers (`ALLOW_SIMULATED_DATA` cannot produce a
  `measured` outcome, because the not-configured check runs first).
- **No rows → `unavailable`.** Empty windows are reported, not zero-filled.
- **Incomplete window → flagged.** `afterComplete: false` plus a reason; the `after`
  numbers are withheld from any delta only when a side is missing entirely.

## Data flow

```
deployment (POST /api/platform/v1/deployments, status "deployed")
        │  platform/[...path]/route.ts  (best-effort, never blocks the deploy)
        ▼
recordChange()  ──►  data/outcome-changes.jsonl      (idempotent by deterministic id)
        │
        │  POST /api/outcomes { action: "measure" }
        ▼
measureChange()  ──►  getGscSearchAnalytics(page rows × before/after)
        │
        ▼
data/outcomes.jsonl   (upserted by id; re-measuring replaces)
```

Storage honours `COGWHEEL_DATA_DIR` (see `src/lib/platform/data-dir.ts`): repo
`data/` locally, temp dir on serverless, a real volume in production.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/outcomes` | List changes + outcomes with counts (`measured`, `unavailable`, `tracked`). |
| `POST` | `/api/outcomes` | `{ action: "record", pageUrl, appliedAt?, siteUrl?, ... }` records a change; `{ action: "measure", changeId? }` measures one change (or all). |

Both require an authenticated principal.

## Not yet done

- **Auto-measurement cadence.** Measuring is on-demand (or "Measure all" in the
  console); a scheduled pass should re-measure tracked changes as the after-window
  fills.
- **Control matching** by template/traffic band rather than raw impressions.
