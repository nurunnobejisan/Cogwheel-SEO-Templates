# ML decisions log

Every non-obvious judgement call, newest last. Format: date, decision, reason,
how to reverse. If it is not written here, it was not a decision — it was an
accident.

---

## 2026-11-27 — Phase 0

### D-001 — One Zod record shape for every split

**Decision.** `schemas/ml-example.ts` defines a single `MlExample` record used
by every job and every split, exported to `schemas/ml-example.schema.json` via
the existing `npm run export:json-schemas`.

**Reason.** The repository already treats `src/schemas/validation.ts` as a
single source of truth and mirrors Python-facing contracts. A second, ML-only
record format would have to be kept in sync by hand and would drift.

**Reverse.** Add a new schema file, point `scripts/export-json-schemas.ts` at
it, and migrate `ml/build` — nothing in the app imports `MlExample`, so the
blast radius is `ml/` plus two validator scripts.

### D-002 — Two validators, one gate

**Decision.** Keep `scripts/validate-training-data.mjs` for the 3-role chat
form and add `scripts/validate-ml-examples.ts` for the structured form; chain
both under `npm run train:validate`.

**Reason.** The chat validator's rules (placeholder scan, invented-metric scan,
duplicate scan) are written against `row.messages` and are proven in CI. The
structured form needs schema + licence + split rules instead. Merging them
would mean rewriting working checks for no gain; splitting the *gate* would
mean two places to forget.

**Reverse.** Un-chain them in `package.json`; each script still runs alone.

### D-003 — Licence registry is YAML, parsed by both languages

**Decision.** `ml/sources.yaml` is the only place a licence or a `use:` value
is written. The Node validator reads it with `js-yaml`; Python reads it with
`PyYAML` (already pinned in `ml/requirements-ml.txt`).

**Reason.** One source of truth, human-reviewable in a PR, and no duplicated
allow-list that can disagree with itself. `js-yaml` was already in the tree as
an eslint transitive dep, so it is pinned as a direct devDependency rather than
adding a new parser.

**Reverse.** Generate a JSON file from the YAML in a build step and have the
Node side read that; the YAML stays authoritative.

### D-004 — `train_attribution` is a distinct `use` value

**Decision.** `sources.yaml` has four `use` values — `train`,
`train_attribution`, `eval_only`, `avoid`. `train_attribution` may enter a
train split but must be attributed in `THIRD_PARTY_NOTICES.md` and
`docs/ATTRIBUTION.md`, and is limited to declared `feeds`.

**Reason.** Schema.org (CC BY-SA 3.0) and Google Search Central (CC BY 4.0) are
usable but carry attribution duties; collapsing them into plain `train` would
lose that, and collapsing them into `eval_only` would throw away the two most
useful corpora for this product.

**Reverse.** Set `attribution_required: false` on those entries and merge the
value into `train`.

### D-005 — Golden set is frozen by sha256 in the data card, not by Git LFS

**Decision.** `ml/eval/golden/cases.jsonl` is a plain tracked file. Its sha256
is written into `docs/ml/DATA_CARD.md` and re-checked by
`npm run ml:golden:check` in CI.

**Reason.** 52 rows is a few tens of kilobytes — LFS adds friction for no
benefit. A hash check catches silent edits (the failure mode that actually
matters: someone "fixes" a case after seeing a bad score) without needing
history archaeology.

**Reverse.** Move the file to LFS or to a tagged release; the checker reads a
path, so only `scripts/check-golden-set.ts` changes.

### D-006 — Golden cases are `split: "eval"` by schema, not by convention

**Decision.** `MlGoldenCaseSchema` extends `MlExampleSchema` and pins
`split: z.literal("eval")`.

**Reason.** The single most dangerous accident in this project is a golden
case leaking into a train split — the model would then be graded on rows it
memorised. Making it a schema error rather than a comment means the validator
fails before any training script runs.

**Reverse.** Drop the `extend` and pin it in `check-golden-set.ts` instead;
kept because the schema is already loaded there.

### D-007 — Synthetic golden cases are allowed, marked, and never trained

**Decision.** 38 of 52 golden cases are `synthetic: true` with
`provenance: "estimated"`. They are evaluation-only.

**Reason.** The measured cases (14) anchor reality; the synthetic ones exist to
test *constraints* — "no price on the page ⇒ no `price` in the Offer" — which
need a controlled input to be a meaningful test. The rule (rule 6) forbids
synthetic data from training, not from being a fixture.

**Reverse.** Regenerate the 38 from crawled pages in Phase 1 and re-freeze;
the data card already flags this as the known limitation.

### D-008 — `page_classification` joins the task vocabulary as a superset

**Decision.** `MlPageTypeLabels` in `schemas/ml-example.ts` is a superset of
`PageTypeLabel` in `src/storage/training-vault.ts`: the eight existing labels
plus seven additive ones (dining, spa, offers, meetings_events, faq, gallery,
contact). The vault is extended to match in Phase 4.

**Reason.** The classifier needs those labels (the plan's Phase 2 job 4), but
removing or renaming a vault label would break existing IndexedDB records. Rule
9 requires additive, backward-compatible change.

**Reverse.** The extra seven entries are pure additions to an enum; deleting
them from `MlPageTypeLabels` affects only rows that already use them.

### D-009 — `js-yaml` and `@types/js-yaml` pinned as devDependencies

**Decision.** Added `js-yaml@^4.3.2` and `@types/js-yaml@^4.0.9` to
`devDependencies`.

**Reason.** `js-yaml` was already present at 4.3.2 as an eslint transitive
dependency; making it explicit costs no install bytes and lets
`validate-training-data.mjs` and `validate-ml-examples.ts` read the registry.
It is a devDependency, so it never ships and never lands in the Vercel
runtime.

**Reverse.** `npm uninstall js-yaml @types/js-yaml` and switch the two scripts
to a hand-rolled YAML subset parser (not recommended).

### D-010 — Initial pins in `ml/requirements-ml.txt` are marked unverified

**Decision.** Every version in `ml/requirements-ml.txt` is an authoring-time
pin with a comment saying so, plus a documented `pip install --dry-run` check
to run before the first real pipeline execution. `trafilatura` is explicitly
constrained to `>= 1.8.0` because older releases are GPL.

**Reason.** Claiming a pin is verified when it has never been resolved would be
an invented fact. The file says what it knows and what it does not.

**Reverse.** Run the dry-run, correct the lines, and delete the "INITIAL PINS"
paragraph once they resolve.

### D-011 — Golden-set coverage floor is 50 cases across all five jobs

**Decision.** `scripts/check-golden-set.ts` fails if there are fewer than 50
cases or if any of the five tasks has zero.

**Reason.** The plan's Phase 0 gate asks for ≥50 cases across five jobs. A
number in a doc decays; the same number in the checker does not.

**Reverse.** Change `MIN_CASES` / `ALL_TASKS` in the script.

### D-012 — Phase PRs are cut from a branch, with autopush paused

**Decision.** For each phase: pause the 5-minute autopush automation, commit on
`ml/phase-N`, open a PR titled `ml(phase-N): …`, wait for green CI, merge, then
resume autopush. Phase 0 had to be retrofitted this way (branch off `b33c82b`,
`--force-with-lease` main back to `3752029`, PR #3, merge).

**Reason.** Autopush commits and pushes straight to `main`, which deploys on
every push. Left alone it would have swallowed each phase into an anonymous
`auto: update` commit with no review point and no per-phase gate. Pausing it
around the phase keeps the fast-push convenience for ordinary work while still
giving every phase a real PR.

**Reverse.** `tools.automation.resume` on `aut_2192c654d001133B6hUreuyudS`
restores the original behaviour; no repository state depends on the pause.

### D-013 — Old `tuned_gemini` registry entries marked `unverified`

**Decision.** Both entries in `data/models/model_registry.json` moved from
`status: "ready"` to `status: "unverified"` with a `statusReason`, and
`python/scripts/train_unified_model.py` now registers new checkpoints as
`unverified` rather than `ready`.

**Reason.** Their `evaluationBenchmark` values are lexical proxies computed
from the eval file (the function's own docstring says so), the base model
`gemini-1.5-flash-002` is retired, and no serving endpoint was ever confirmed.
Calling that "ready" was an unverified claim. A checkpoint becomes `ready` only
after a golden-set run.

**Reverse.** Set `status` back to `ready` in the JSON, and revert the one line
in `train_unified_model.py`.

