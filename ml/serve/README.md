# `ml/serve` — fine-tuned model gateway (Phase 4)

An OpenAI-compatible, **standard-library-only** gateway (D-014) that sits in
front of a Phase 3 adapter and answers the contract
`src/core/ai/custom-model.ts` speaks: `GET /health`, `GET /v1/models`,
`POST /v1/chat/completions`.

```
app (CUSTOM_MODEL_ENDPOINT) ──▶ ml/serve/server.py ──▶ upstream (vLLM/SGLang …)
                                     │                      │
                                     └── data/models/model_registry.json
```

## Run

```bash
# supported path: an OpenAI-compatible server in front of the LoRA adapter
python3 -m ml.serve.server --host 127.0.0.1 --port 8000 \
  --upstream https://inference.example.com/v1

# local adapter weights (needs ml/requirements-ml.txt; HeavyDepsError without it)
python3 -m ml.serve.server --adapter /path/to/adapter

# smoke-test a legacy 'unverified' registry entry (D-013)
python3 -m ml.serve.server --upstream ... --allow-unverified

# require a bearer on /v1/* (the app sends CUSTOM_MODEL_API_KEY)
SERVE_API_KEY=... python3 -m ml.serve.server --upstream ...
```

Point the app at it with `CUSTOM_MODEL_ENDPOINT=http://…/v1/chat/completions`
(the app's SSRF guard requires a **public** address — loopback is refused, so
use a tunnel or a public host for real deployments) plus optional
`CUSTOM_MODEL_ID` and `CUSTOM_MODEL_API_KEY`.

## Rules

- **Servability gate** — registry `status: ready` only; `unverified` needs
  `--allow-unverified` and is reported by `/health`.
- **No fabricated output** — no upstream ⇒ `503 upstream_not_configured`.
- **No prompt logging** — logs method, path, status, model id, latency only.
- **De-branded ids** — `seo-studio-*` aliases resolve to the persisted
  `seo-studio-*` ids; storage is never rewritten.

## Promotion to `ready`

`ready` is earned, never typed (D-023). After a real training run and a
golden-set report:

```bash
python3 -m ml.serve.register \
  --manifest data/out/<run>/<run>.manifest.json \
  --report <run>-report.json \
  --dry-run            # print the gate chain, write nothing
python3 -m ml.serve.register --manifest ... --report ... --active
```

Eleven gates must pass — real train run (not dry-run), allow-listed base
model + matching licence, frozen golden sha agreeing across manifest /
report / on-disk file, recorded data sha, adapter named with weights never
committed, git sha, complete outputs coverage, failures within
`--allow-failures` (default 0), and `outputsMeta` cross-checks. The write
is atomic and keeps a `.bak`; legacy entries are untouched.

## Tests

`tests/python/test_ml_serve.py` — registry aliasing/servability, gateway
gates, HTTP contract (auth, 404/400/403/503 paths), passthrough shape.
`tests/python/test_ml_register.py` — the promotion gate chain.
`docs/ml/GPU_RUNBOOK.md` — the end-to-end operator path.
