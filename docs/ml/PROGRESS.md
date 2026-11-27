# ML plan — progress

One row per phase. A phase is **done** only when its PR is merged with green CI.
Status values: `not started` · `in progress` · `done`.

| Phase | Title | Status | PR |
|---|---|---|---|
| 0 | Foundations | done | [#3](https://github.com/nurunnobejisan/SEO-Studio/pull/3) |
| 1 | Data registry & datasets | done | [#4](https://github.com/nurunnobejisan/SEO-Studio/pull/4) |
| 2 | Retrieval explainer + classifier | in progress | — |
| 3 | LoRA fine-tunes | not started | — |
| 4 | Ship to app & extension | not started | — |

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

- [ ] licence gate fires on corpora and classifier rows — covered by the
      93 new Python tests (unknown/avoid/synthetic/attribution refusals)
- [ ] golden set unchanged — sha256 `3d951412...6a3a84`, runner reports
      52 cases / 106 checks, all `skipped` without model outputs
- [ ] CI green locally — typecheck, lint, train:validate (5 gates), vitest,
      lint:seo, test:seo, test:ts, brain:eval, next build, pytest 278,
      build:extension
- [ ] CI green on the PR

## Phase 3 — LoRA fine-tunes

**Not started.** Planned: `ml/train/` QLoRA on Qwen3 / Qwen3.5 small for the
schema writer, meta writer, audit explainer and GEO gap finder; DPO on
healing-approved vs rejected patches; SFT on reviewed/gold triples subject to
`MIN_REVIEWED_PAIRS_FOR_TRAINING`. Golden-set scores recorded per run in this
file before and after each tune.

## Phase 4 — Ship to app & extension

**Not started.** Planned: `ml/serve/` OpenAI-compatible endpoint, the
`cogwheel-tuned` provider behind `CUSTOM_MODEL_*`, additive `PageTypeLabel`
extension in `src/storage/training-vault.ts` and the extension copy, router
fallback when the endpoint is unset.

---

## Score log

Filled in from Phase 2 onward. Golden-set numbers only — never a number that
was not produced by `ml/eval/run_eval.py`.

| Date | Phase | Model | schema | meta | explainer | classifier | GEO | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-11-27 | 0 | (baseline — golden set frozen) | — | — | — | — | — | 52 cases, no model run yet |
| 2026-11-27 | 2 | (runner shipped, no model outputs yet) | — | — | — | — | — | 106 checks reported `skipped`, never `passed`; no number until a real run |
