# ML plan — progress

One row per phase. A phase is **done** only when its PR is merged with green CI.
Status values: `not started` · `in progress` · `done`.

| Phase | Title | Status | PR |
|---|---|---|---|
| 0 | Foundations | done | [#3](https://github.com/nurunnobejisan/SEO-Studio/pull/3) |
| 1 | Data registry & datasets | done | [#4](https://github.com/nurunnobejisan/SEO-Studio/pull/4) |
| 2 | Retrieval explainer + classifier | not started | — |
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
| `grounding` | all generation jobs | Every value in the output appears in `input.text` or `input.measured` |
| `invented_metrics` | rag_synthesis, entity_gap_analysis | No ranking, volume, CPC, traffic or citation count unless `provenance: "measured"` |
| `title_budget` | metadata_generation | Title ≤ 60 chars, description ≤ 160, exactly one H1 |
| `classifier_macro_f1` | page_classification | Macro-F1 over the page-type labels, reported with the confusion matrix |
| `explainer_citation` | rag_synthesis | The explanation cites a retrieved source URL |
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

**Not started.** Planned: `ml/retrieve/` corpus → embeddings → `pgvector`,
`HttpEmbedder` in `ai/rag/embedder.ts` behind `EMBEDDINGS_ENDPOINT` (falls back
to the offline hashing embedder), audit explainer over the Google Search
Central corpus with per-chunk source URLs, and the page classifier trained on
the Phase 1 labels with `page_classification` wired into `TaskKind`.

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
