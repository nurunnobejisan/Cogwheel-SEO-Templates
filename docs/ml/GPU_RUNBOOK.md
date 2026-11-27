# GPU Runbook — the first adapter (Phase 5)

End-to-end path from "repo checked out" to "the app is using a promoted
adapter", on free-tier GPUs. Every number this produces comes from
`ml/eval/run_eval.py` and nowhere else.

```
build dataset ─▶ GPU session (dry-run → --train) ─▶ adapter to private store
                                                            │
app ◀─ promote (11 gates) ◀─ run_eval report ◀─ generate ◀───┘ (endpoint mode)
```

## 0. TL;DR

```bash
# any machine — data + gates
npm run train:validate
python3 -m ml.train.dataset                       # licence/consent gates, 2000-pair rule

# GPU session (Kaggle/Colab, < 9 h) — see §2
python3 -m ml.train.sft                           # dry-run: manifests, no weights
python3 -m ml.train.sft --train                   # the real run

# any machine with the served adapter — see §3
python3 -m ml.serve.server --upstream <vLLM URL> &
python3 -m ml.train.evaluate --endpoint "$CUSTOM_MODEL_ENDPOINT" \
    --out <run>-outputs.jsonl
python3 ml/eval/run_eval.py --outputs <run>-outputs.jsonl --out <run>-report.json

# promote + wire up — see §4/§5
python3 -m ml.serve.register --manifest <run>.manifest.json \
    --report <run>-report.json --dry-run
python3 -m ml.serve.register --manifest <run>.manifest.json \
    --report <run>-report.json --active
```

## 1. Prerequisites

- **Kaggle** (~30 free GPU-hours/week, T4/P100) or Colab free tier as
  backup. Keep each session **under 9 hours**.
- ML deps in an isolated venv — never the app venv, never the Vercel build
  (rule 11):

  ```bash
  python3 -m venv .venv-ml && source .venv-ml/bin/activate
  pip install --dry-run -r ml/requirements-ml.txt   # verify the pins first
  pip install -r ml/requirements-ml.txt             # install unsloth LAST
  ```

- Licence-clean only: base models from the `BASE_MODELS` allow-list in
  `ml/train/config.py` (Apache-2.0 Qwen3/Qwen3.5), training data only via
  `ml/sources.yaml`. Never MS MARCO/ORCAS/HotelRec/GEO-bench as train.
- **No weights in this repo.** Adapters live in `ML_PRIVATE_DATASET_REPO`
  (private HF) or on the serve host. `.gitignore` already excludes
  `*.safetensors`, `*.gguf`, `*.bin`, `data/raw/`, `data/build/`,
  `data/sft-dataset.jsonl`.

## 2. GPU session

```bash
git clone <repo> && cd SEO-Studio
python3 -m venv .venv-ml && source .venv-ml/bin/activate
pip install -r ml/requirements-ml.txt

# 1) dry-run first (D-020): validates config + dataset gates, writes a
#    provenance manifest, imports no GPU stack, trains nothing
python3 -m ml.train.sft
python3 -m ml.train.dpo            # only if data/patch-pairs.jsonl ≥ 2000 pairs

# 2) the real run — explicit, opt-in
python3 -m ml.train.sft --train
#    → data/out/<runId>/<runId>.manifest.json
#    → data/out/<runId>/adapter/   (adapter weights)

# 3) ship the adapter OFF the GPU box (never into git)
huggingface-cli upload <your-private-repo> data/out/<runId>/adapter adapter
#    or download the folder to the serve host directly
```

The manifest records base model + allow-listed licence, data sha256, frozen
golden sha256, git sha and (for real runs) the adapter path, train loss and
step count. `mode: train` + `trainingStarted: true` is what promotion later
requires — a dry-run manifest can never become `ready`.

## 3. Evaluate — no GPU needed on the eval host (Phase 5)

Serve the adapter, then generate through the endpoint:

```bash
# serve host: vLLM/SGLang in front of the adapter (OpenAI-compatible), then
python3 -m ml.serve.server --upstream http://127.0.0.1:8000/v1 --port 8000
# or, with ml/requirements-ml.txt on that host:
python3 -m ml.serve.server --adapter /path/to/adapter --port 8000

# eval host — stdlib only
export CUSTOM_MODEL_ENDPOINT=https://<public-host>/v1/chat/completions   # SSRF guard: public address
python3 -m ml.train.evaluate --endpoint "$CUSTOM_MODEL_ENDPOINT" \
    --out <run>-outputs.jsonl
python3 ml/eval/run_eval.py --outputs <run>-outputs.jsonl --out <run>-report.json
```

Before/after: run the same three commands with the **base** model only
(endpoint in front of the base, or `--generate --base …` on the GPU box) so
the score log gets both rows. Template changes bump `TEMPLATE_VERSION` —
rows from different template versions are not comparable.

Fail-closed: an HTTP error, bad body or empty content aborts with the case
id and **no output file is written**; a case that could not be generated is
never filled in.

## 4. Promote — `ready` is earned (D-023)

```bash
python3 -m ml.serve.register --manifest <run>.manifest.json \
    --report <run>-report.json --dry-run      # inspect the 11 gates
python3 -m ml.serve.register --manifest <run>.manifest.json \
    --report <run>-report.json --active
```

Gates: real train run · allow-listed base model with matching licence ·
manifest/report/on-disk golden sha all equal · data sha + rows recorded ·
adapter named with `weightsCommitted: false` · git sha · complete outputs
coverage (52/52 — skips are not passes) · zero failures unless
`--allow-failures N` (recorded in `statusReason`) · `outputsMeta`
cross-check. The registry write is atomic, keeps a `.bak`, and never
touches legacy `unverified` entries.

## 5. Wire the app

```bash
CUSTOM_MODEL_ENDPOINT=https://<public-host>/v1/chat/completions
CUSTOM_MODEL_ID=seo-studio-<runId>
CUSTOM_MODEL_API_KEY=…            # bearer the gateway requires (SERVE_API_KEY)
```

Verify: `getActiveAiProviderLabel()` returns
`SEO Studio fine-tuned (<id>)`, and `/health` on the gateway shows the
entry under `servableModels`. Unset any of the three and the router falls
back to the existing providers — nothing breaks.

## 6. Record honestly

- Add a score-log row in `docs/ml/PROGRESS.md`: date, phase, model id, and
  per-task numbers **copied from the run_eval report** — or an explicit
  "n/a" with the reason. No other source may produce a number.
- The registry entry's `statusReason` / `provenance` already carry run id,
  git sha and shas; do not hand-edit them.

## 7. Rollback

- Set the entry's `status` back to `unverified` (registry edit, one line)
  or unset `CUSTOM_MODEL_ENDPOINT` — the gateway then refuses the model and
  the router falls back automatically.
- Delete the adapter from the private repo/host if the run is discarded.

## Never

- Never commit adapter weights, crawled HTML, client data or embeddings.
- Never report a ranking/volume/CPC/traffic/citation number that run_eval
  did not produce.
- Never train on licence-blocked sources; `ml/sources.yaml` is the only
  intake.
- Never leave a session running past 9 h on Kaggle — copy the adapter out
  first.
