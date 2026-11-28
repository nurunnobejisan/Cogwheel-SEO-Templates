# GPU Runbook — SEO-Studio AI SEO Model (v1)

End-to-end operator guide from checked-out repo to progressive v1 rollout on free-tier GPUs (Kaggle T4/P100 `< 9 h` or Colab). Every reported metric MUST come directly from `ml/eval/run_eval.py` at temperature `0`.

In **v1**, the fine-tuned QLoRA Qwen3 adapter serves **only** `schema_generation` and `metadata_generation` (`D-025`, `D-029`). All other tasks (`rag_synthesis`, `entity_gap_analysis`, `page_classification`, untagged prompts) remain on the existing provider chain.

```
build_sft (v2) ─▶ measure baselines ─▶ QLoRA (0.6B → 1.7B → 4B) ─▶ private HF push
                                                                       │
app (shadow→canary→on) ◀─ promote (11 gates) ◀─ run_eval (temp 0) ◀────┘
```

## Prerequisites & Safety Rules

- **Isolated Python ML venv** — NEVER install GPU packages into the app venv or Vercel build (`ml/requirements-ml.txt`, `D-014`):
  ```bash
  python3 -m venv .venv-ml && source .venv-ml/bin/activate
  pip install --dry-run -r ml/requirements-ml.txt   # verify pins first
  pip install -r ml/requirements-ml.txt             # install unsloth LAST
  ```
- **Licence-clean sources & no client leakage** — only sources declared trainable in `ml/sources.yaml` (without editing `use:` or `feeds:`). Never commit weights (`*.safetensors`, `*.gguf`, `*.bin`), `data/raw/`, `data/build/`, or client-specific vault/GSC data.
- **Frozen v1 golden set untouched** — verify `ml/eval/golden/cases.jsonl` matches its frozen sha256 (`npm run ml:golden:check`), and populate `ml/eval/golden_v2/cases.jsonl` (`>= 75` schema + `>= 75` metadata human-reviewed cases) before shipping v1.

---

## Step 1 — Build v1 Host-Split Dataset (`sft-v2.jsonl`)

Generate the v2 SFT dataset (scoped to `schema_generation` and `metadata_generation` with deterministic 90/10 domain-host isolation and golden host exclusion) and inspect its build report:

```bash
# 1a. Verify repo governance & check golden v2 status
npm run train:validate
npx tsx scripts/check-golden-v2.ts --strict --train-file data/build/sft-v2.jsonl

# 1b. Build data/build/sft-v2.jsonl + data/build/sft-v2.report.json (gitignored)
python3 -m ml.train.build_sft \
  --in data/raw/wdc-2024.jsonl=wdc-2024 \
  --in data/raw/wdc-tables-2023.jsonl=wdc-tables-2023 \
  --in data/raw/vault.jsonl=vault \
  --in data/raw/patches.jsonl=patches \
  --in data/raw/triples.jsonl=triples \
  --out data/build/sft-v2.jsonl \
  --report data/build/sft-v2.report.json

# 1c. Confirm zero host leakage and valid schema/governance gates
cat data/build/sft-v2.report.json
npm run train:validate
```

Confirm `"hostOverlapCount": 0` and `"goldenHostOverlapCount": 0` in `data/build/sft-v2.report.json` before moving to Step 2.

---

## Step 2 — Baseline Evals BEFORE Training (`temperature=0`)

Measure both the untuned base model (`Qwen/Qwen3-1.7B`) and the current free provider on the **exact same evaluation cases** at temperature `0` (`D-024`):

```bash
# 2a. Baseline 1: Untuned Qwen/Qwen3-1.7B behind an OpenAI-compatible server
export SERVE_API_KEY="<operator-serve-key>"
python3 -m ml.train.evaluate \
  --golden ml/eval/golden_v2/cases.jsonl \
  --endpoint "https://<base-model-host>/v1/chat/completions" \
  --api-key "$SERVE_API_KEY" \
  --out data/build/baseline-qwen3-1.7b-v2-outputs.jsonl
python3 ml/eval/run_eval.py \
  --golden ml/eval/golden_v2/cases.jsonl \
  --outputs data/build/baseline-qwen3-1.7b-v2-outputs.jsonl \
  --out data/build/baseline-qwen3-1.7b-v2-report.json

# 2b. Baseline 2: Current free provider (Groq/Gemini OpenAI-compatible shim)
python3 -m ml.train.evaluate \
  --golden ml/eval/golden_v2/cases.jsonl \
  --endpoint "https://<free-provider-shim>/v1/chat/completions" \
  --api-key "<free-provider-key>" \
  --out data/build/baseline-free-provider-v2-outputs.jsonl
python3 ml/eval/run_eval.py \
  --golden ml/eval/golden_v2/cases.jsonl \
  --outputs data/build/baseline-free-provider-v2-outputs.jsonl \
  --out data/build/baseline-free-provider-v2-report.json
```

(Also run the same pair against the frozen 52-case `ml/eval/golden/cases.jsonl` by omitting `--golden`.)

---

## Step 3 — GPU QLoRA Training Progression (`0.6B` -> `1.7B` -> `4B`, `< 9 h`)

Use Apache-2.0 allow-listed Qwen3 checkpoints (`D-019`, `D-027`). Keep every Kaggle session strictly under **9 hours** and save per-epoch checkpoints so interrupted runs never lose work:

```bash
# Dry-run first (D-020): validates config, dataset sha256, golden sha256; no GPU needed
python3 -m ml.train.sft --data data/build/sft-v2.jsonl

# 3a. Stage 1 — 0.6B pipeline smoke test (1 epoch)
python3 -c 'import json; from pathlib import Path; Path("data/build/cfg-0.6b.json").write_text(json.dumps({"base_model": "Qwen/Qwen3-0.6B", "epochs": 1.0}))'
python3 -m ml.train.sft --data data/build/sft-v2.jsonl --config data/build/cfg-0.6b.json --train

# 3b. Stage 2 — 1.7B baseline adapter (default CPU/GGUF serving target, D-027)
python3 -c 'import json; from pathlib import Path; Path("data/build/cfg-1.7b.json").write_text(json.dumps({"base_model": "Qwen/Qwen3-1.7B", "epochs": 3.0}))'
python3 -m ml.train.sft --data data/build/sft-v2.jsonl --config data/build/cfg-1.7b.json --train

# 3c. Stage 3 — 4B scale-up candidate (default SftConfig)
python3 -m ml.train.sft --data data/build/sft-v2.jsonl --train
```

Outputs land in `ml/train/outputs/<runId>/adapter/` alongside `ml/train/outputs/<runId>.manifest.json`. Always copy checkpoints/adapters off the GPU instance before the 9 h timeout.

---

## Step 4 — Upload Adapter to Private Repo (`ML_PRIVATE_DATASET_REPO`)

Never commit weights into Git (`D-004`). Push the trained adapter directory to your private Hugging Face repo:

```bash
huggingface-cli login
export ML_PRIVATE_DATASET_REPO="<owner>/<private-repo>"
huggingface-cli upload "$ML_PRIVATE_DATASET_REPO" \
  ml/train/outputs/<runId>/adapter \
  adapters/v1/<runId> \
  --repo-type dataset --private
```

---

## Step 5 — Serve Constrained Adapter, Evaluate & Check Ship Gates

Serve the adapter behind `ml/serve/server.py` (with constrained schema enforcement from `ml/generate/` when `task` is passed) and score against **both** the frozen 52-case golden set and `ml/eval/golden_v2/cases.jsonl` at temperature `0`:

```bash
# Serve host (vLLM/SGLang upstream or --adapter on GPU box)
export SERVE_API_KEY="<operator-serve-key>"
python3 -m ml.serve.server --upstream http://127.0.0.1:8001/v1 --port 8000 --api-key "$SERVE_API_KEY"

# Eval host (stdlib-only; public HTTPS endpoint passing the SSRF guard)
export CUSTOM_MODEL_ENDPOINT=https://<public-host>/v1/chat/completions
export CUSTOM_MODEL_ID=seo-studio-<runId>

# Score frozen v1 golden set (required for ml.serve.register 11-gate check)
python3 -m ml.train.evaluate \
  --endpoint "$CUSTOM_MODEL_ENDPOINT" \
  --api-key "$SERVE_API_KEY" \
  --out data/build/<runId>-v1-outputs.jsonl
python3 ml/eval/run_eval.py \
  --outputs data/build/<runId>-v1-outputs.jsonl \
  --out data/build/<runId>-v1-report.json

# Score expanded v2 golden set (>= 75 schema + >= 75 metadata)
python3 -m ml.train.evaluate \
  --golden ml/eval/golden_v2/cases.jsonl \
  --endpoint "$CUSTOM_MODEL_ENDPOINT" \
  --api-key "$SERVE_API_KEY" \
  --out data/build/<runId>-v2-outputs.jsonl
python3 ml/eval/run_eval.py \
  --golden ml/eval/golden_v2/cases.jsonl \
  --outputs data/build/<runId>-v2-outputs.jsonl \
  --out data/build/<runId>-v2-report.json
```

### Mandatory v1 Ship Gates (temperature `0`)

Do **not** promote unless **every** condition below passes on the `run_eval.py` reports:

1. **`schema_generation`**: `jsonld_valid >= 95%`, `invented_metrics = 0`, zero grounding failures.
2. **`metadata_generation`**: `title_budget >= 90%`, zero invented metrics.
3. **Comparative lift**: tuned adapter scores **strictly higher** than **both** the untuned `Qwen/Qwen3-1.7B` baseline AND the current free provider on the exact same held-out cases (`golden_v2` + frozen `golden`).
4. **Registry 11-gate promotion (`D-023`)**:
   ```bash
   python3 -m ml.serve.register \
     --manifest ml/train/outputs/<runId>.manifest.json \
     --report data/build/<runId>-v1-report.json \
     --dry-run
   python3 -m ml.serve.register \
     --manifest ml/train/outputs/<runId>.manifest.json \
     --report data/build/<runId>-v1-report.json \
     --active
   ```

---

## Step 6 — App Rollout (`shadow` -> `canary` -> `on`)

Ship `schema_generation` first (`D-029`). Configure Vercel / runtime environment variables cleanly:

```env
CUSTOM_MODEL_ENDPOINT=https://<public-host>/v1/chat/completions
CUSTOM_MODEL_ID=seo-studio-<runId>
CUSTOM_MODEL_API_KEY=<SERVE_API_KEY>

# Phase A: dark launch — evaluates adapter concurrently + checks WP3 gate + records
# latency/pass counters, while 100% of responses still come from standard providers.
AI_ADAPTER_MODE=shadow
AI_ADAPTER_CANARY_PCT=0
```

After verifying zero unexpected gate failures and healthy latency in shadow telemetry:

1. **Canary (`AI_ADAPTER_MODE=canary`)**: deterministic per-`propertyId` / `requestId` routing:
   `AI_ADAPTER_CANARY_PCT=10` -> monitor error/fallback rate -> `25` -> `50`.
2. **Full v1 rollout (`AI_ADAPTER_MODE=on`)**: active serving for `schema_generation` and `metadata_generation` with WP3 deterministic gate fallback on every call.

Verify `/health` on `ml/serve/server.py` shows `seo-studio-<runId>` under `servableModels`, and `getActiveAiProviderLabel()` returns `SEO Studio fine-tuned (seo-studio-<runId>)` when `AI_ADAPTER_MODE=on`.

---

## Step 7 — Instant Rollback & Record Keeping

- **Instant zero-deploy rollback**: set `AI_ADAPTER_MODE=off` in Vercel/env (all traffic returns immediately to the standard/free provider chain).
- **Server-side registry rollback**: set the model's `"status"` back to `"retired"` or `"unverified"` (and `"activeModelId": null`) in `data/models/model_registry.json`, or unset `CUSTOM_MODEL_ENDPOINT` (`ml/serve` refuses non-`ready` entries per `D-028`).
- **Record scores honestly (`docs/ml/PROGRESS.md`)**: copy per-task metrics verbatim from `data/build/<runId>-*-report.json` (`ml/eval/run_eval.py`). Never extrapolate or invent unmeasured numbers.
