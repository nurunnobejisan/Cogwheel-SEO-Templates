# ML plan — progress

One row per phase. A phase is **done** only when its PR is merged with green CI.
Status values: `not started` · `in progress` · `done`.

| Phase | Title | Status | PR |
|---|---|---|---|
| 0 | Foundations | done | [#3](https://github.com/nurunnobejisan/SEO-Studio/pull/3) |
| 1 | Data registry & datasets | done | [#4](https://github.com/nurunnobejisan/SEO-Studio/pull/4) |
| 2 | Retrieval explainer + classifier | done | [#5](https://github.com/nurunnobejisan/SEO-Studio/pull/5) |
| 3 | LoRA fine-tunes | done | [#7](https://github.com/nurunnobejisan/SEO-Studio/pull/7) |
| 4 | Ship to app & extension | done | [#10](https://github.com/nurunnobejisan/SEO-Studio/pull/10) |
| 5 | First adapter run (playbook, promotion, endpoint eval) | done | [#20](https://github.com/nurunnobejisan/SEO-Studio/pull/20) |

---

## Phase 0 — Foundations

**Goal.** A licence registry, an isolated dependency set, a frozen evaluation
set, a record schema, and a validator that fails the build when any of those
drift.

### Deliverables

- [x] `ml/sources.yaml` — licence registry, 17 sources, four `use` values
- [x] `ml/requirements-ml.txt` — pinned, isolated, documented as unverified
- [x] `ml/README.md` — what lives where and the five rules `ml/` obeys
- [x] `schemas/ml-example.ts` + `MlGoldenCaseSchema`, exported to
      `schemas/ml-example.schema.json` / `ml-golden-case.schema.json`
- [x] `scripts/validate-training-data.mjs` extended: ML-task categories,
      `meta.source` / `meta.licence` / `meta.synthetic` required, `avoid` and
      `eval_only` sources rejected from train files, licence disagreement and
      synthetic-measured conflicts rejected
- [x] `scripts/validate-ml-examples.ts` — schema + registry + split rules for
      the structured form
- [x] `ml/eval/golden/cases.jsonl` — **52 cases**, hash-frozen in
      `docs/ml/DATA_CARD.md`, checked by `npm run ml:golden:check`
- [x] `scripts/check-golden-set.ts` — hash, schema, registry, coverage ≥50 and
      all five jobs
- [x] `scripts/ml-label-cli.ts` — runs `rules/` on HTML, emits findings as JSON
      (`provenance: "measured"`); the bridge Python calls
- [x] five env placeholders in `.env.example` and documented in
      `docs/PLATFORM_RUNTIME.md` (SSRF-guarded, fail-closed, no prompt logging)
- [x] `.gitignore` — `data/raw/`, `data/build/`, `ml/**/outputs/`,
      `ml/**/checkpoints/`, `*.safetensors`, `*.gguf`, `*.bin`
- [x] `docs/ml/DECISIONS.md` — 11 decisions with reversal paths

### Gate

- [x] registry reviewed — 17 sources, four `use` values, every licence copied
      from the upstream terms; `avoid`/`eval_only` entries documented with why
- [x] golden set frozen — 52 cases, sha256 `3d951412…6a3a84` in
      `docs/ml/DATA_CARD.md`, enforced by `npm run ml:golden:check`
- [x] CI green — run 45891405087 on `b33c82b`, and run 45929399674 on PR #3

### Evaluation checks (section 9)

These are the checks a golden case may declare. `ml/eval/run_eval.py` refuses
an unknown one.

| Check | Applies to | Pass condition |
|---|---|---|
| `jsonld_valid` | schema_generation | Output parses as JSON-LD and validates against the schema.org type |
| `grounding` | all generation jobs | Every content token in the output traces to `input.text`, `input.measured` or `input.findings` (URLs and closed labels exempt) |
| `invented_metrics` | rag_synthesis, entity_gap_analysis | No ranking, volume, CPC, traffic or citation count unless `provenance: "measured"` |
| `title_budget` | metadata_generation | Title ≤ 60 chars, description ≤ 160, exactly one H1 |
| `classifier_macro_f1` | page_classification | Macro-F1 over the page-type labels, reported with the confusion matrix |
| `explainer_citation` | rag_synthesis | The explanation cites a source URL (from the retrieved set when one is provided) |
| `human_review` | any | Operator signs off; used for release gating, not for scoring |

---

## Phase 1 — Data registry & datasets

**Goal.** A licence-gated pipeline that can collect, extract, clean and card
corpora — stdlib-first so CI can verify it with only the root
`requirements.txt`, with heavy accelerators optional.

### Deliverables

- [x] `ml/registry.py` — Python licence gate reading `ml/sources.json`;
      `require_licence` / `assert_trainable` / `register_example` enforce
      rules 3 and 6 (unknown source, `avoid`/`eval_only` in train, synthetic
      claiming `measured`, synthetic in train, first-party consent + tenantId)
- [x] `scripts/export-ml-sources.ts` + `ml/sources.json` — generated mirror of
      `ml/sources.yaml`; `--check` chained into `npm run train:validate` so the
      two can never drift (D-015)
- [x] `ml/collect/sitemaps.py` — urlset/index parsing, gzip, namespace
      tolerance, duplicate-`<loc>` dedupe; no network (caller fetches)
- [x] `ml/collect/robots.py` — Robots Exclusion Protocol: groups, longest-
      match-wins with ties to `Allow`, `*`/`$` wildcards, `Crawl-delay`
- [x] `ml/collect/commoncrawl.py` — CDX query builder + response parser
      (stdlib; `cdx_toolkit` stays an optional accelerator, D-014)
- [x] `ml/collect/lighthouse.py` — labels from our own Lighthouse runs,
      cross-checked against rules-engine findings; disagreement is discarded
      (rule 2), a missing score is `None`, never `0`
- [x] `ml/extract/markup.py` — JSON-LD / OG / Twitter / meta / headings /
      hreflang; `extruct` preferred, `bs4` fallback, backend recorded
- [x] `ml/extract/text.py` — main-content text; `trafilatura` preferred,
      `bs4` fallback, sentence-boundary truncation, measured word count
- [x] `ml/clean/pii.py` — Python twin of `stripPii` (same patterns,
      same placeholders)
- [x] `ml/clean/normalise.py` — `canonical()` / `contentHash()` twin
- [x] `ml/clean/dedup.py` — deterministic MinHash (blake2b, not `hash()`),
      Jaccard threshold with the score surfaced
- [x] `ml/dataset/wdc.py` — Hotel/LodgingBusiness/Restaurant/FAQPage/
      BreadcrumbList allow-list with a per-pass report
- [x] `ml/dataset/wikidata.py` — entity grounding; `novalue`/`somevalue`
      snaks are "not asserted", never a fact
- [x] `ml/dataset/cards.py` — 17 dataset cards + index rendered from the
      registry; `npm run ml:cards` writes, `--check` gates CI
- [x] PII fix — parenthesized phone numbers (`(503) 555 0123`) were never
      redacted by `stripPii` in `src/core/training/dataset.ts` or by the
      extension vault; fixed on both sides plus the Python twin (D-016),
      with a regression test
- [x] `tests/python/test_ml_{registry,collect,extract,clean,dataset}.py` —
      133 new tests, 185 total in `tests/python`

### Gate

- [x] licence gate fires — `avoid`/`eval_only` blocked from train, synthetic
      blocked from train and from `measured`, first-party requires consent +
      tenantId, unknown sources rejected (covered by the tests above)
- [x] dataset cards in sync — `python3 ml/dataset/cards.py --check` chained
      into `npm run train:validate`
- [x] CI green locally — typecheck, lint, train:validate (5 gates),
      vitest 468/468, lint:seo 10/10, test:seo 67, test:ts 34,
      brain:eval fabrication 0.0000, next build, pytest 185,
      build:extension
- [x] CI green on the PR — run 45934113623 on `add7b45`, merged as `b29868e`

## Phase 2 — Retrieval explainer + classifier

**Goal.** Retrieval that can be explained (every chunk carries its source
URL, every citation traces back) and a page-type classifier that trains and
evaluates inside CI — stdlib-first, licence-gated, fail-closed on the
network path.

### Deliverables

- [x] `ai/rag/embedder.ts` — `HttpEmbedder` (OpenAI-compatible
      `POST {input:[...]}`) behind `EMBEDDINGS_ENDPOINT`, syntactic SSRF
      guard at construction + DNS-aware `safeFetch` per request, redirects
      disabled, vector-width drift refused, bounded LRU text cache;
      `createEmbedderFromEnv` picks it or the offline hashing embedder (D-018)
- [x] `Embedder` / `KnowledgeBase` additive async path — `embedAsync` /
      `embedBatchAsync` / `searchAsync` / `ready()`; sync `search` throws
      under an async embedder instead of returning wrong-space vectors;
      a failed ingest stays sticky until a later upsert succeeds (D-018)
- [x] `src/lib/security/egress.ts` reused for the endpoint (the same
      DNS-aware SSRF guard as crawl targets; no second guard implementation)
- [x] `ml/retrieve/chunk.py` — sentence-aligned chunking, clamped overlap,
      per-chunk `id`/`source`/`url`/`charStart`/`charEnd` so a citation can be
      verified against the original document
- [x] `ml/retrieve/corpus.py` — JSONL corpus behind the licence gate:
      unknown source, `avoid`/`eval_only` in a train split, missing
      attribution on `train_attribution` sources, duplicate ids and non-http
      URLs all rejected; `build_from_html` gates before *and* after extraction
- [x] `ml/retrieve/embed.py` — hashing embedder (blake2b, deterministic across
      processes) + fail-closed `HttpEmbedder` with the same SSRF guard and
      shape/width validation as the TypeScript twin (D-018)
- [x] `ml/retrieve/store.py` — in-memory cosine index with the app's hybrid
      ranking (0.7 embedding + 0.3 keyword), JSON persist, optional pgvector
      export (lazy `psycopg`, D-014)
- [x] `ml/retrieve/classifier.py` — one-vs-rest logistic regression over
      measured-only features (jsonLdTypes / h1Count / booking widget /
      word-count buckets / URL path / hashed text tokens), deterministic
      weights, macro-F1 + confusion matrix, CLI that re-checks the licence
      gate on every row (synthetic and non-trainable sources refused)
- [x] `ml/eval/run_eval.py` — all seven section-9 checks as code; a check
      with no inputs is `skipped`/`pending`, never `passed`; unknown checks
      fail loudly; exit 1 only on a genuine failure; report carries the
      golden sha256 so a run is attributable to the frozen set
- [x] `src/core/brain/index.ts` — explainer prompt now requires citing the
      retrieved chunk's source URL, and `contextText` includes it
- [x] `tests/rag-embedder.test.ts` — 32 tests (SSRF cases, fail-closed
      shapes, cache, sticky failure, async pipeline); `tests/python/
      test_ml_{retrieve,eval}.py` — 93 tests
- [x] D-017, D-018 logged with reversal paths

### Gate

- [x] licence gate fires on corpora and classifier rows — covered by the
      93 new Python tests (unknown/avoid/synthetic/attribution refusals)
- [x] golden set unchanged — sha256 `3d951412...6a3a84`, runner reports
      52 cases / 106 checks, all `skipped` without model outputs
- [x] CI green locally — typecheck, lint, train:validate (5 gates),
      vitest 500/500, lint:seo 10/10, test:seo, test:ts, brain:eval
      fabrication 0.0000, next build, pytest 278, build:extension
- [x] CI green on the PR — run 45939702942 on `9ca9da7`, merged as `da88e73`

## Phase 3 — LoRA fine-tunes

**Merged (PR #7).** `ml/train/` — QLoRA SFT and DPO for
the schema writer, meta writer, audit explainer and GEO gap finder, plus
the golden-set harness that scores them. Qwen3 / Qwen3.5 small,
Apache-2.0. Training itself is operator-side on a GPU box (D-020): what
ships here is everything that must be true *before* a weight is ever
produced.

### Shipped

- [x] `ml/train/errors.py` — `HeavyDepsError` raised lazily so `ml.train`
      stays importable (and testable in CI) with only the root
      `requirements.txt` (D-014)
- [x] `ml/train/config.py` — `BASE_MODELS` allow-list with per-model
      licence (D-019), `SftConfig`/`DpoConfig` validation with
      `trust_remote_code` pinned false, `MIN_REVIEWED_PAIRS_FOR_TRAINING`
      mirrored from the TypeScript exporter (a test asserts no drift)
- [x] `ml/train/dataset.py` — licence-gated SFT assembly: registry gate
      (rule 3), synthetic ban (rule 6), first-party `consent` + `tenantId`
      + reviewed/gold, golden-set content exclusion (eval never trains),
      PII strip, dedupe, and the 2000-pair gate on client-derived sources
      (`blocked` below threshold, `--require-ready` exits 1)
- [x] `ml/train/sft.py` — QLoRA dry-run by default; `--train` lazily
      imports torch/trl/peft; every run manifest records base model +
      licence, data sha256, golden sha256, git sha and hyperparameters —
      and never a score
- [x] `ml/train/dpo.py` — same gates for `prompt/chosen/rejected` pairs,
      plus `chosen == rejected` refused (no preference signal = noise);
      no committed pair corpus (D-020)
- [x] `ml/train/evaluate.py` — deterministic golden-set requests (one per
      case, versioned templates) → generation with base ± adapter →
      `{caseId, output}` rows for `ml/eval/run_eval.py`, so before/after
      numbers in the score log are always runner-produced
- [x] `data/training/unified_seo_*.jsonl` de-branded (268 occurrences) and
      `legacy-brand` added to the validator's hard patterns so the retired
      name can never re-enter training data
- [x] `LoraExample.metadata.consent` carried through
      `buildLoraExample` (additive; older exports stay parseable)
- [x] `tests/python/test_ml_train.py` — 46 tests (config/allow-list,
      every refusal path, gate arithmetic, dry-run manifests, lazy
      heavy-deps errors, request determinism, golden round-trip into
      `run_eval`); **324 Python tests total**
- [x] D-019, D-020, D-021 logged with reversal paths

### Gate

- [x] licence gate fires on every train row — unknown / `avoid` / synthetic
      / first-party-without-consent / golden-leaking rows all refused with
      a recorded reason (covered by the 46 new tests)
- [x] golden set unchanged — sha256 `3d951412...6a3a84` asserted by the
      assembly manifest and the new tests
- [x] no score without `run_eval.py` — trainers write manifests only;
      `evaluate.py` is the sole path from a model to a scored row
- [x] CI green locally — typecheck, lint, train:validate (5 gates),
      vitest 515/516 (the 1 failure is `tests/vault-sync-resilience.test.ts`,
      Task 1.3 work, failing identically on `origin/main` without this branch —
      verified by stash; see D-021), lint:seo 10/10, test:seo, test:ts,
      brain:eval fabrication 0.0000, next build, pytest 324, build:extension
- [x] CI green on the PR — run 45944977507 on `0509253`, merged as `ee4d9db`
- [x] D-021 isolation: worktree `ml-phase-3`, branch cut from
      `origin/main`, no shared history rewritten

## Phase 4 — Ship to app & extension

**Merged (PR #10).** Shipped:

- **`ml/serve/`** — stdlib-only OpenAI-compatible gateway (D-014):
  `registry.py` (alias migration `seo-studio-*` → persisted `seo-studio-*` on
  read, storage never rewritten; servability gate: `ready` only, `unverified`
  needs `--allow-unverified` per D-013) and `server.py` (`/health`,
  `/v1/models`, `/v1/chat/completions`; optional `SERVE_API_KEY` bearer;
  **fail-closed** — no upstream ⇒ `503 upstream_not_configured`, never a
  fabricated completion; `--adapter` lazy-imports heavy deps →
  `HeavyDepsError` without `ml/requirements-ml.txt`; logs ids/latency only,
  never prompts).
- **App** — `src/core/ai/custom-model.ts`: `CUSTOM_MODEL_*` reader +
  OpenAI-shaped call behind the SSRF guard (`isSafeEmbeddingsEndpoint`,
  then DNS-aware `safeFetch` — loopback/private refused). Wired as the
  **first** attempt in `generateClaudeText` with fall-through to the existing
  providers; `getActiveAiProviderLabel` / `isClaudeConfigured` report it;
  router `seo-studio-tuned` descriptor is now guard-aware and owns its tier
  when configured, falling back when the endpoint is unset.
- **Extension copy** — `chrome-extension/src/engine/custom-model-client.ts`
  already routed Auto-Fix / GEO Summary to `CUSTOM_MODEL_*` with rules-engine
  fallback; unchanged.
- **`PageTypeLabel` +7 (D-008)** — `dining`, `spa`, `offers`,
  `meetings_events`, `faq`, `gallery`, `contact` added to
  `src/storage/training-vault.ts` **and** the extension copy;
  `classifyPageType` produces them (specific-URL rules first; `/dining`,
  `/spa`, `/contact` moved from the broader `amenities`/`location` rules —
  URL-classification output for those three shifts, stored records never
  change). Vocabulary now equals `MlPageTypeLabels` (15 labels).
- **Tests** — `tests/custom-model-provider.test.ts` (13),
  `tests/page-type-labels.test.ts` (4), `tests/python/test_ml_serve.py` (20):
  Python **344**, vitest **533/533**.

Local CI: typecheck, next lint, train:validate, lint:seo 10/10, test:ts,
vitest 533/533, brain:eval fabrication 0.0000, test:seo, next build,
build:extension, pytest 344, ruff (new files).

- [x] Local CI green
- [x] CI green on the PR — run 45953114827 on `5c6d813`, merged as `67fa605`
- [x] D-021 isolation: branch cut from `origin/main` in worktree
      `ml-phase-3`, no shared history rewritten (fast-forward merge of
      `origin/main` at `8c7f247`, no force-push)

---

## Phase 5 — First adapter run (playbook, promotion, endpoint eval)

**Merged (PR #20).** Closes the loop between training,
serving and evaluation so the first real GPU run can be executed and
honestly recorded:

- **`docs/ml/GPU_RUNBOOK.md`** — end-to-end operator path: isolated venv +
  pin verification, dataset gates, Kaggle/Colab dry-run → `--train` (< 9 h
  sessions), adapter off-box to `ML_PRIVATE_DATASET_REPO` (never git),
  endpoint-mode evaluation with before/after rows, promotion, app wiring,
  honest score-log recording, rollback, and the never-list.
- **Endpoint generation (D-024)** — `ml/train/evaluate.py --endpoint URL`
  POSTs each frozen golden request to any OpenAI-compatible server (the
  `ml/serve` gateway) at temperature 0, stdlib only: the eval host needs
  **no GPU and no ML deps**. Fail-closed — HTTP/shape/empty failures abort
  naming the case and write no output file; `--generate` (local GPU) stays
  mutually exclusive. `run_eval` reports gain `outputsMeta` (template,
  baseModel, adapter, endpoint, requestedModel — provenance only).
- **Promotion CLI (D-023)** — `python3 -m ml.serve.register` earns
  `status: ready` through an eleven-gate chain (real train run, allow-listed
  base + licence, golden sha agreement across manifest/report/file, data
  sha + rows, adapter named with weights uncommitted, git sha, full 52/52
  coverage, failures ≤ `--allow-failures`, `outputsMeta` cross-check).
  Atomic write with `.bak`, idempotent, `--force` for conflicts, legacy
  entries untouched, `--dry-run` prints the chain.
- **Tests** — `tests/python/test_ml_register.py` (15) and
  `tests/python/test_ml_evaluate_endpoint.py` (12, real stub HTTP server
  incl. end-to-end endpoint → `run_eval` → `outputsMeta`): Python **371**.

Local CI: typecheck, next lint, train:validate, lint:seo, test:ts, vitest,
brain:eval, test:seo, next build, build:extension, pytest 371, ruff (new
files clean; `run_eval`'s three pre-existing SIM/C416 hits unchanged).

- [x] Local CI green
- [x] CI green on the PR — run 45966963618 on `ea6b6d6`, merged as `2a7e0e7`
- [x] D-021 isolation: branch cut from `origin/main` in worktree
      `ml-phase-3`, no shared history rewritten (merged `origin/main` at
      `6a5be86`, no force-push)

---

## Score log

Filled in from Phase 2 onward. Golden-set numbers only — never a number that
was not produced by `ml/eval/run_eval.py`.

| Date | Phase | Model | schema | meta | explainer | classifier | GEO | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-11-27 | 0 | (baseline — golden set frozen) | — | — | — | — | — | 52 cases, no model run yet |
| 2026-11-27 | 2 | (runner shipped, no model outputs yet) | — | — | — | — | — | 106 checks reported `skipped`, never `passed`; no number until a real run |
| 2026-11-27 | 3 | (training layer shipped, no GPU run yet) | — | — | — | — | — | dry-run manifests only — no adapter trained, so no score exists to report |
| 2026-11-27 | 4 | (serving shipped, no model run yet) | — | — | — | — | — | gateway serves only `ready` registry entries; with no adapter there is nothing to number |
| 2026-11-27 | 5 | (runbook + promotion + endpoint eval shipped, no model run yet) | — | — | — | — | — | score log stays untouched until a real `run_eval` report exists |
