# ML agent log

Working log for autonomous ML-platform agent runs on SEO-Studio. Newest
sections last. Score claims live in `docs/ml/PROGRESS.md` (score log) — this
file records what was built, what was found, and what is waiting on a human.

---

## v2 start — 2026-11-29

### Step 0 — what v1 actually finished

The v1 run described by the v2 prompt (branches `ml/wp*`, `AGENT_LOG.md`,
`AI_ADAPTER_MODE`, output gates, `ml/generate/`) does **not exist** in this
repository's history. What exists instead is an earlier, mostly equivalent
programme recorded in `docs/ml/PROGRESS.md` as **Phases 0–5** (branches
`ml/phase-1` … `ml/phase-5`, all merged to `main`), with decisions D-001 …
D-024 in `docs/ml/DECISIONS.md`.

Status table (v1-equivalent = the phase that delivered the matching capability):

| v1 capability (as named in the v2 prompt) | Status | Where |
|---|---|---|
| Task routing through `ai/router.ts` | merged | Phase 2 (`routeTask`, tiers, provider registry) |
| Output gates with fallback (`src/core/ai/output-gates.ts`) | **missing** | no such module; validators exist in `validators/` but no adapter-output gate chain |
| `AI_ADAPTER_MODE` (off / shadow / canary / on) | **missing** | not implemented anywhere |
| Operator auth | merged | Phase 5.1: `src/lib/platform/session.ts`, `src/lib/platform/auth.ts`, `/api/platform/session` (`PLATFORM_OPERATOR_TOKEN` → signed cookie) |
| Per-client retrieval isolation | merged | tenant-scoped retrieval (`ml/retrieve/*`, `tenantId` on triples, `ml/registry.py` consent gate) |
| `ml/generate/` | **missing** | generation scripts live in `scripts/` and `ml/dataset/` instead; no `ml/generate/` package |
| Dataset v2 builder (`ml/train/build_sft.py`) | **partial** | `ml/train/dataset.py` delivers the licence/synthetic/consent/golden-exclusion gates and manifest, but there is no `build_sft.py` CLI entry point with that name |
| Golden v2 scaffolding | merged | Phase 0/2: `ml/eval/golden/cases.jsonl` (52 frozen cases), `scripts/check-golden-set.ts`, `npm run ml:golden:check` |
| GPU runbook | merged | Phase 5: `docs/ml/GPU_RUNBOOK.md` |
| Serving gateway + promotion | merged | Phase 4/5: `ml/serve/server.py`, `ml/serve/register.py` (11-gate promotion chain), `ml/serve/registry.py` |
| Endpoint evaluation | merged | Phase 5: `ml/train/evaluate.py --endpoint`, `ml/eval/run_eval.py` |
| DPO trainer (gates only) | merged | `ml/train/dpo.py` — gates + runner; **no pair builder** (`build_dpo.py` missing) |

Adapter reality:

* No adapter has `status: ready`. Both registry entries are `unverified`
  (retired base `gemini-1.5-flash-002`; stored benchmark numbers are labelled
  `provenance: "lexical-proxy", measured: false`).
* No measured `run_eval.py` scores exist. The score log in
  `docs/ml/PROGRESS.md` has no numeric row — correctly, every phase left it
  untouched until a real run.
* The frozen golden set (52 cases) has **no human-approved v2 additions**;
  the triple store has raw captures awaiting review (raw tier is not
  training-eligible by design).

### Consequences for this run

Per the v2 prompt's step-0 rule ("a v1 WP is missing → do that WP first"), the
missing v1-equivalent pieces are being finished **inside the v2 WPs that need
them**, as follows:

* `AI_ADAPTER_MODE` + adapter output gates → built as part of **WP3**
  (per-task readiness), which is the code path that consumes them.
* `build_sft.py` CLI entry point → built as part of **WP2** (it wraps the
  existing `ml/train/dataset.py` assembly so the runbook command names match
  the runbook).
* `ml/generate/` → not rebuilt; the existing `ml/dataset/` + `scripts/`
  layout already covers dataset generation. Recorded as **D-025** rather than
  recreated for naming's sake.

Base branch: `main` (all phase work is merged; the only unmerged branches are
unrelated UI/CI fixes). Branches are stacked `ml/v2-wpN-*` in prompt order.

### Scoping note (honest)

This run implements WP1, WP2, WP3, WP8, WP9 and WP10 (template form for the
card, since no measured adapter exists). WP4 (Tier 2 slices), WP5 (real
classifier training), WP6 (monitoring + circuit breaker) and WP7 (serving
hardening) are **not started** in this run; they are recorded as missing in
the "v2 end" section with reasons. Nothing was faked to fill those gaps.

---
## WP1 — Human review queue (branch `ml/v2-wp1-review-queue`)

Built this run:

- **Core** `src/core/review/queue.ts` — row/decision types and the pure
  invariants: a decision requires an authenticated reviewer; decisions are
  immutable; a rejected row is never train-eligible; `edit_and_approve` keeps
  the original candidate output as `originalOutput` provenance.
- **Store** `src/lib/review/store.ts` — JSONL store in the app's data
  directory (D-026); idempotent `syncQueue` ingests raw-tier teacher triples
  plus the `ml-review/golden-candidates.jsonl` and
  `ml-review/shadow-disagreements.jsonl` producer files; `recordDecision`
  mirrors an approve into the triple store (`reviewed` tier, D-027);
  `exportApproved` emits the three consumer formats (sft chat rows, dpo
  preference pairs, golden-v2 cases with deterministic 64-hex ids).
- **API** `src/app/api/review-queue` — operator-only GET (snapshot + export)
  and POST (approve / edit-and-approve / reject, optional reason). No auth →
  401 on every handler; only these handlers set `reviewed: true`.
- **Page** `/settings/ai-training/review` (`ReviewQueueClient`) inside the
  Train AI area, linked from the AI Training page for operators.
- **Migration** `supabase/migrations/0006_ml_review_queue.sql` (mirror table,
  D-026).
- **Tests** `tests/review-queue.test.ts` — 17 passing: auth 401s, immutable
  decisions, anonymous refusal, reject-never-trains (all three exports empty,
  triple stays `raw`), edit provenance, format exports, producer sync
  idempotence.

Notes: shadow-disagreement producer rows are consumed here but written by
WP3; until then that queue is empty by design. No review row was approved in
this run — approvals are human actions only.

---
