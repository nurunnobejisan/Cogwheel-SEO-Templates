# Data card — golden evaluation set

**Status:** frozen for Phase 0.
**Location:** `ml/eval/golden/cases.jsonl`
**Frozen sha256:** `3d9514129d6a694fed90fa9a52039806bfa687e6b51c757998b4e05bcd6a3a84`
**Frozen on:** 2026-11-27
**Rows:** 52
**Schema:** `schemas/ml-golden-case.schema.json` (from `schemas/ml-example.ts`)

Verify at any time:

```bash
shasum -a 256 ml/eval/golden/cases.jsonl
# 3d9514129d6a694fed90fa9a52039806bfa687e6b51c757998b4e05bcd6a3a84
npm run ml:golden:check     # re-hashes and re-validates against the schema
```

## Purpose

A small, hand-checked set used to answer one question per phase: *did the new
model get better without breaking anything?* It is evaluation-only — no row
here ever enters a train split (the schema pins `split: "eval"`).

## Composition

| Task | Cases | Checks applied |
|---|---:|---|
| `schema_generation` (Schema writer) | 14 | `jsonld_valid`, `grounding` |
| `metadata_generation` (Meta & heading writer) | 12 | `title_budget`, `grounding` |
| `rag_synthesis` (Audit explainer) | 10 | `explainer_citation`, `grounding`, `invented_metrics` |
| `page_classification` (Page classifier) | 8 | `classifier_macro_f1` |
| `entity_gap_analysis` (GEO gap finder) | 8 | `grounding`, `invented_metrics` |
| **Total** | **52** | |

Checks are the section-9 list from `docs/ml/PROGRESS.md`. `ml/eval/run_eval.py`
refuses to run a check it does not know.

## Provenance mix

| provenance | rows | meaning |
|---|---:|---|
| `measured` | 14 | Values traceable to the input text / rules-engine output. Used where a real audit supplied the numbers (the `thenines.com` pages and the measured-count explainers). |
| `estimated` | 38 | Synthetic fixtures. `synthetic: true`. Used where the point is *shape and constraint*, not a real-world value. |

**No row asserts a ranking, search volume, CPC, traffic or citation count.**
Where a count appears (word counts, image counts, title length, seat counts) it
is declared in `input.measured` and marked `provenance: "measured"`.

## Source mix (from `ml/sources.yaml`)

| source | `use` | rows |
|---|---|---:|
| `repo-synthetic` | train | 26 |
| `commoncrawl` | train | 14 |
| `schemaorg` | train_attribution | 5 |
| `wikidata` | train | 9 |
| `google-search-central` | train_attribution | 12 |
| `lighthouse-labels` | train | 0 |
| `httparchive` | eval_only | 0 |
| `geo-bench` | eval_only | 0 |

Attribution-required sources used here (`schemaorg`, `google-search-central`)
are recorded in `THIRD_PARTY_NOTICES.md` / `docs/ATTRIBUTION.md`.

## Page-type coverage

`hotel_homepage`, `room_details`, `dining`, `spa`, `faq`, `gallery`, `contact`,
`offers`, `meetings_events`, `location`. The seven additive labels beyond the
original `PageTypeLabel` (dining, spa, offers, meetings_events, faq, gallery,
contact) are exercised here first; they become vault labels in Phase 4.

## Known limitations

- **Hotel-heavy.** All 52 cases are hospitality. Non-hotel coverage arrives in
  Phase 1 with the WDC / Common Crawl collect pass.
- **English only.**
- **52 rows is a smoke test, not a benchmark.** It catches regressions; it does
  not establish a quality claim. Any published number comes from a larger,
  separately-carded set.
- **Two `thenines.com` pages are real** (homepage and FAQ); the rest are
  synthetic fixtures written against the schema, not crawled pages.

## Changing this set

1. Edit `ml/eval/golden/cases.jsonl` (or regenerate it).
2. `npm run train:validate` must pass — schema, licence registry, unique ids.
3. Update the frozen hash above **and** the row counts in this file.
4. Note the change in `docs/ml/DECISIONS.md` with the reason.

Never edit the hash without editing the file, and never edit the file in the
same commit as a model change you intend to measure.
