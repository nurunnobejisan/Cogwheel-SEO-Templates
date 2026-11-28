# Golden Evaluation Set v2 (`ml/eval/golden_v2/`)

Expanded v1 release evaluation set targeting **>= 75** `schema_generation` and
**>= 75** `metadata_generation` hand-checked cases (**150+ total**) across diverse
held-out hosts.

> The v1 frozen 52-case set at `ml/eval/golden/cases.jsonl` and its hash in
> `docs/ml/DATA_CARD.md` remain untouched (`npm run ml:golden:check`).

## Hard Invariants

1. **Zero leakage** — no case in `ml/eval/golden_v2/cases.jsonl` may share a
   registrable domain host or `domainHash` with any `train` split row (or with
   `ml/eval/golden/cases.jsonl`).
2. **Human review required (`D-026`)** — every promoted row in `cases.jsonl` must
   have `humanReviewed: true`, a non-empty `reviewedBy` operator id, and a
   clear `note`. Candidate rows emitted by `ml/eval/propose_golden_v2.py` carry
   `humanReviewed: false` and can never be auto-promoted.
3. **Strict release coverage** — promoting an adapter requires passing the
   `--strict` threshold of `>= 75` `schema_generation` and `>= 75`
   `metadata_generation` cases:

```bash
# Propose held-out unreviewed candidates (writes to gitignored data/build/)
python3 ml/eval/propose_golden_v2.py --in <held-out-or-eval.jsonl>

# Check scaffolding / partial progress
npx tsx scripts/check-golden-v2.ts --allow-partial

# Enforce full 75/75 release gate before training promotion
npx tsx scripts/check-golden-v2.ts --strict --train-file data/build/sft-v2.jsonl
```
