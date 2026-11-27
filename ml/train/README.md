# SEO Studio — training (SFT / DPO / LoRA adapters)

QLoRA supervised fine-tuning and DPO for the schema writer, metadata writer,
audit explainer and GEO gap finder, plus the golden-set harness that scores
them. Qwen3 / Qwen3.5 small, Apache-2.0.

## Golden rule: no score without `run_eval.py`

Every number in `docs/ml/PROGRESS.md` comes from:

```bash
python3 ml/eval/run_eval.py --outputs <run>-outputs.jsonl
```

Trainers write manifests (model + licence, data sha256, golden sha256, git
sha, hyperparameters) — never scores. A check without inputs is `skipped`,
never `passed`.

## Quick start (GPU box / Kaggle)

```bash
# isolated venv — never the app venv
python3 -m venv .venv-ml && source .venv-ml/bin/activate
pip install -r ml/requirements-ml.txt

# 1. assemble a licence-gated SFT dataset (CI-safe, no GPU)
python3 ml/train/dataset.py --out data/sft-dataset.jsonl
python3 ml/train/dataset.py --triples data/lora-dataset.jsonl --require-ready

# 2. validate config + data without the GPU stack (this is the CI path)
python3 ml/train/sft.py --data data/sft-dataset.jsonl            # dry-run
python3 ml/train/sft.py --data data/sft-dataset.jsonl --train    # GPU

# 3. score before/after a tune
python3 ml/train/evaluate.py --requests data/golden-requests.jsonl
python3 ml/train/evaluate.py --generate --requests data/golden-requests.jsonl \
    --base Qwen/Qwen3-4B --adapter ml/train/outputs/<run>/adapter \
    --out <run>-outputs.jsonl
python3 ml/eval/run_eval.py --outputs <run>-outputs.jsonl
```

DPO (pairs of `prompt` / `chosen` / `rejected`):

```bash
python3 ml/train/dpo.py --pairs data/patch-pairs.jsonl --source patches   # dry-run
python3 ml/train/dpo.py --pairs data/patch-pairs.jsonl --source patches --train
```

## Gates

| Gate | Where | Below threshold |
|---|---|---|
| Licence registry (rule 3) | `dataset.assemble`, `dpo.prepare` | row refused with reason in manifest |
| Synthetic never trains (rule 6) | same | row refused |
| First-party consent + tenantId | same (`vault`/`patches`/`triples`) | row refused |
| Golden set never trains | same (content fingerprints) | row refused |
| `MIN_REVIEWED_PAIRS_FOR_TRAINING` = 2000 | client-derived sources only | `gate: blocked`; `--require-ready` exits 1 |
| Base-model allow-list | `config.resolve_base_model` | `ConfigError` naming how to add a verified model |

## Rules

1. **Dry-run by default.** Nothing trains without an explicit `--train`.
2. **`trust_remote_code` stays false** — configs that flip it are rejected.
3. **No weights in this repo.** `.gitignore` excludes `*.safetensors`,
   `*.gguf`, `*.bin`, `ml/**/outputs/`. Push adapters to
   `ML_PRIVATE_DATASET_REPO`.
4. **Heavy deps only in `ml/requirements-ml.txt`** (D-014). Module import is
   stdlib-only; GPU paths raise `HeavyDepsError` with the install command.
5. **Templates are versioned.** `evaluate.TEMPLATE_VERSION` — scores from
   different template versions are not comparable.

See `docs/ml/DECISIONS.md` (D-017, D-019, D-020) for why the corpus posture
is what it is.
