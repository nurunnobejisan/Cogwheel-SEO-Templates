# SEO-Studio AI SEO Model — Model Card (v2 template, not measured)

> **Status: TEMPLATE / NOT MEASURED.** No GPU training run has happened; no
> adapter has `status: ready` in `data/models/model_registry.json`; every
> numeric field below is **unset by design**. Nothing here was fabricated.
> When the first measured run exists, an operator fills this card from the
> run's eval report and promotion manifest — never from memory or hope.

## Model details

| Field | Value |
|---|---|
| Model name | SEO-Studio AI SEO Adapter (QLoRA on Qwen3; size ladder 0.6B → 1.7B → 4B) |
| Version / run id | _unset — first promoted run fills this_ |
| Base model | Qwen/Qwen3-4B (Apache-2.0) — per run manifest |
| Architecture | Decoder LM + QLoRA adapter, constrained decoding (`ml/generate/constrained.py`) |
| Languages | English (golden set scope) |
| Licence | Apache-2.0 base; adapter governed by this repo's registry |
| Registry status | **no entry has `status: ready`** (both v1 entries retired/unverified, D-028) |
| Per-task scope (`readyTasks`) | **empty** — the adapter serves no task until `ml.serve.register` widens it from measurement (D-036) |
| Deployed inference | not deployed; `AI_ADAPTER_MODE` defaults to `off` everywhere |

## Intended use

- **In scope:** `schema_generation`, `metadata_generation` (Tier 1) and,
  after measured graduation, `entity_gap_analysis` / `rag_synthesis`
  (Tier 2 via D-036) for hospitality SEO pages.
- **Out of scope:** any non-SEO task; any task not in the registry entry's
  measured `readyTasks`; client PII processing; legal, medical or financial
  advice; content in languages the golden set does not cover.
- The extension consumes tuned inference **only** through the app backend
  (`/api/extension/infer`, D-037) — never directly.

## Training data

| Field | Value |
|---|---|
| Sources | `ml/sources.yaml` registry (17 sources); first-party sources require consent + tenant id |
| SFT dataset | `data/build/sft-v2.jsonl` — _not built yet (zero-source report only)_ |
| DPO pairs | `data/build/dpo-v2.jsonl` — _not built yet (zero-source report only)_ |
| Host split | deterministic 90/10 per registrable host (`assign_host_split`); golden hosts excluded |
| Known gaps | no human-approved review rows yet; healing/vault producer exports not yet landing; Tier 2 training slices not built |

## Evaluation

| Metric (temperature 0, frozen golden set) | Value |
|---|---|
| Golden set | `ml/eval/golden/cases.jsonl` (sha `3d951412…a3a84`) — **not measured** |
| `jsonld_valid` | _unset (ship gate: ≥ 95%)_ |
| `title_budget` | _unset (ship gate: ≥ 90%)_ |
| `invented_metrics` | _unset (ship gate: 0)_ |
| `grounding` / `explainer_citation` | _unset (Tier 2 gates)_ |
| Baseline comparisons | _unset — D-036 requires beating untuned base AND free provider on the same cases_ |
| Fairness/robustness | _not evaluated_ |

## Limitations & risks

- No measured performance exists; the model must not be described as
  outperforming any baseline.
- Hallucination risk (invented amenities, ratings, prices) is the primary
  gate target; gates run server-side on every path including the extension
  proxy.
- Client-derived data trains only with explicit consent; shadow-mode
  disagreements default to `consent: false` (v3 adds the real flag).
- Promotion and scope widening are human decisions; no automation may raise
  them.

## Provenance

- Training / promotion manifests land in the registry entry's `provenance`
  (run id, git sha, data sha, golden sha, report sha) — see
  `ml/serve/register.py`.
- Reports-only refresh PRs (`ml/weekly-refresh/*`) carry build counts; row
  data never enters git.

## How to fill this card after the first run

1. Copy values from the run's `manifest.json` + eval report into the tables.
2. Update `data/models/model_registry.json` **only via `ml.serve.register`**.
3. Cite the report sha in every number you add; leave a field `_unset_` if
   the report does not contain it.
