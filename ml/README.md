# SEO Studio ML

Everything machine-learning lives here. The Next.js app never imports from
`ml/`, and `npm run build` never touches it.

| Path | What it holds |
|---|---|
| `sources.yaml` | **Licence registry — the single source of truth.** Every dataset that may enter a build is declared here with its licence and `use: train \| train_attribution \| eval_only \| avoid`. |
| `requirements-ml.txt` | Isolated Python deps (torch, transformers, unsloth, …). Installed into its own venv, never the app's. |
| `collect/` | Crawlers, sitemap/robots readers, Common Crawl pulls, Lighthouse labelling. |
| `extract/` | `extruct` + `trafilatura`: JSON-LD/Microdata/OG/RDFa out, main-content text out. |
| `clean/` | Normalise, dedup (MinHash), tokenise, PII strip. |
| `retrieve/` | Corpus → embeddings → `pgvector` / local vector store. |
| `generate/` | `outlines`-guided JSON generation for schema/meta rows. |
| `train/` | SFT + DPO notebooks and scripts. QLoRA, Qwen3 / Qwen3.5 small. |
| `serve/` | Inference server (`v1` / OpenAI-compatible) + `embed_server.py`. |
| `eval/` | `golden/` — the frozen hand-checked set; `run_eval.py`. |

## Rules this directory obeys

1. **Licence-clean only.** Nothing enters a train split unless `sources.yaml`
   says `use: train` or `use: train_attribution`. MS MARCO, ORCAS and HotelRec
   are `avoid`; GEO-bench and HTTP Archive are `eval_only`.
   `npm run train:validate` enforces this in CI.
2. **Synthetic never trains.** Rows with `synthetic: true` are `estimated`,
   never `measured`, and never enter a train split.
3. **No weights, no crawled HTML, no client data, no embeddings in this repo.**
   `.gitignore` excludes `*.safetensors`, `*.gguf`, `*.bin`, `data/raw/`,
   `data/build/`. Push those to `ML_PRIVATE_DATASET_REPO` instead.
4. **Heavy deps stay in `requirements-ml.txt`.** The root `requirements.txt`
   and the Vercel build must not change because of ML work.
5. **The rules engine scores, models explain.** `scripts/ml-label-cli.ts` runs
   `rules/` on HTML and emits findings; Python calls it rather than
   re-implementing a rule.

## Quick start

```bash
# 1. validate data + licence governance (also runs in CI)
npm run train:validate

# 2. label an HTML page with the rules engine (what Python calls)
npx tsx scripts/ml-label-cli.ts page.html --url https://example.com/ --compact

# 3. check the golden set still matches its frozen hash
npm run ml:golden:check
```

Python environment (only needed for `collect/` onward):

```bash
python3 -m venv .venv-ml
source .venv-ml/bin/activate
pip install -r ml/requirements-ml.txt
```

## Contracts

- `schemas/ml-example.ts` — the one record shape for every split
  (exported to `schemas/ml-example.schema.json`).
- `schemas/ml-golden-case.schema.json` — an example plus its checks.
- `docs/ml/DATA_CARD.md` — what the golden set contains and its frozen hash.
- `docs/ml/DECISIONS.md` — every judgement call, with a reversal path.
- `docs/ml/PROGRESS.md` — phase-by-phase status.
