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
`PageTypeLabel` in `shared/ts/training-vault.ts`: the eight existing labels
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

**Reverse.** `tools.automation.resume` on `aut_21b3d1096001nfcoxOJreSwYbU`
restores the original behaviour; no repository state depends on the pause.
(The automation was recreated on 2026-11-27 during Phase 2 after the original
`aut_2192c654d001133B6hUreuyudS` was deleted instead of paused — same name,
schedule and action, fresh id and run history.)

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

### D-014 — Phase 1 Python lives in `ml/`, not `python/`, and is stdlib-first

**Decision.** The pipeline modules are `ml/collect/`, `ml/extract/`,
`ml/clean/`, `ml/dataset/` (plus `ml/registry.py`), not
`python/<module>/` as `docs/PROJECT_STRUCTURE.md` prescribes. Tests still go
in `tests/python/`. Heavy dependencies (`cdx_toolkit`, `extruct`,
`trafilatura`) are optional with `bs4`/stdlib fallbacks; `ml/README.md`
(merged in Phase 0) already documents this layout.

**Reason.** Phase 0 merged `ml/README.md` defining `ml/` as the pipeline home
(`collect/extract/clean/retrieve/generate/train/serve/eval`); splitting the
pipeline across `python/` and `ml/` would fragment it against its own
documentation. The CI Python job installs only the root `requirements.txt`,
so stdlib/`bs4`-first is the only way the pipeline is verifiable in CI at
all — a module that cannot import in CI cannot be tested there.

**Reverse.** Move `ml/*.py` under `python/ml/`, update the sys.path bootstrap
and imports, and amend `ml/README.md` and this decision.

### D-015 — `ml/sources.json` is a generated mirror of `ml/sources.yaml`

**Decision.** `ml/sources.yaml` stays the single authored source of truth;
`scripts/export-ml-sources.ts` renders `ml/sources.json` from it, and
`npm run ml:sources:export --check` is chained into `npm run train:validate`.
Python reads only the JSON mirror.

**Reason.** The CI Python job installs the root `requirements.txt`, which has
no PyYAML, so Python cannot read the YAML directly. `js-yaml` is already a
devDependency for the Node validators, so the mirror is generated — never
hand-edited — and the `--check` gate fails CI if either file changes without
regenerating the other.

**Reverse.** Add `PyYAML` to `requirements.txt`, point `ml/registry.py` at the
YAML, and delete the exporter and the `ml:sources:*` scripts.

### D-016 — Parenthesized phone numbers were unredacted; fixed in all three copies

**Decision.** The phone pattern in `src/core/training/dataset.ts`,
`PII_PHONE` in `shared/ts/training-vault.ts`, and `PHONE_RE`
in `ml/clean/pii.py` now share one shape whose word-boundary guard sits on the
digit branch (`\b\d{2,4}`) instead of the start of the pattern, so
`(503) 555 0123` is redacted. Regression tests added on both sides.

**Reason.** A leading `\b` cannot match between a space and `(`, so the old
patterns silently passed parenthesized numbers through — a real PII leak in
production redaction code, found while testing the Python twin. The vault copy
was worse: `\+\d...` only ever matched numbers written with a leading `+`.
Years, prices and ZIP codes remain unaffected (verified before the change).

**Reverse.** Revert the three regex lines — but this reintroduces the leak, so
reversal is not recommended; fix forward instead.

### D-017 — Classifier ships as trainable infrastructure, not a pre-trained model

**Decision.** `ml/retrieve/classifier.py` ships with train/eval/save/load and
a CLI that licence-gates every row, but **no trained weights and no committed
training file**. Training happens operator-side from `data/build/` labels
(Phase 1 pipeline output); `ml/eval/run_eval.py` reports `classifier_macro_f1`
as `skipped` when `--model` is absent — never as a number.

**Reason.** No licence-clean, non-synthetic page-type training data exists in
the repo: crawled HTML cannot be committed (rule 4), synthetic rows are
banned from train splits (rule 6), and the frozen golden set is eval-only.
Fabricating a training file or reporting a default F1 would violate the
no-invented-metrics rule. The honest Phase 2 deliverable is the machinery —
features, trainer, gate, metric — proven by tests on fixtures, with the score
filled in only after an operator trains on real labels.

**Reverse.** When an operator-side labelled corpus exists, commit (or
CI-fetch from `ML_PRIVATE_DATASET_REPO`) a train file, run
`python3 -m ml.retrieve.classifier train`, and record the real macro-F1 in
`docs/ml/PROGRESS.md` — no code change required, only data.

### D-018 — Embedding failures fail closed; vector spaces are never mixed

**Decision.** With `EMBEDDINGS_ENDPOINT` set, `createEmbedderFromEnv` /
`embedder_from_env` throw on an unsafe endpoint and `HttpEmbedder` throws on
any transport/shape/width error — there is **no per-request fallback to the
hashing embedder**. The async embedder's synchronous `embed`/`embedBatch`
(and the knowledge base's sync `search`) throw instead of returning vectors,
and a failed `upsert` stays sticky: `searchAsync`/`ready` rethrow until a
later upsert succeeds.

**Reason.** Hashing vectors and HTTP vectors live in different spaces;
silently answering a query with a hashing query-vector against HTTP
chunk-vectors corrupts retrieval with no visible failure, and an empty/partial
index served after an endpoint error would look like "no relevant results".
Fail-closed surfaces the outage instead. This also matches the Phase 0 rule
that CI and the extension keep working with the offline hashing embedder when
the endpoint is *unset* — unset is the only fallback path.

**Reverse.** Revert the `EmbeddingError` throws to a caught fallback in
`createEmbedderFromEnv` — not recommended; if a degraded mode is ever needed,
make it explicit (e.g. `EMBEDDINGS_FALLBACK=hashing`) rather than implicit.

### D-019 — Base models are allow-listed with licences; `trust_remote_code` stays false

**Decision.** `ml/train/config.py` carries a `BASE_MODELS` allow-list
(Qwen3 0.6B/1.7B/4B, Qwen3.5 family — all Apache-2.0). Any other
`base_model` is refused with instructions to verify the model card and add
the entry; the matched licence is written into every run manifest.
`trust_remote_code` is hard-rejected when set to anything but `false`.

**Reason.** The licence-clean rule applies to weights, not just rows: an
unverified base model is the remaining contamination vector in the
pipeline, and its licence must travel with the artefact for provenance.
Qwen-family models do not need remote code, so allowing it would buy
arbitrary code execution during training for zero benefit.

**Reverse.** To adopt a new model: verify its model card licence, then add
a pattern entry to `BASE_MODELS`. Relaxing `trust_remote_code` means
removing the validation check — not recommended without a model that
proves it needs it.

### D-020 — Trainers dry-run by default; no committed DPO pair corpus

**Decision.** `ml/train/sft.py` and `ml/train/dpo.py` validate config,
data and every governance gate and write a run manifest by default, and
only train when `--train` is passed explicitly (which requires the
isolated `ml/requirements-ml.txt` stack, else `HeavyDepsError`).
**No `prompt/chosen/rejected` corpus is committed**: pair capture lives in
the app, and client-derived pairs stay in `data/` / the private dataset
repo (`ML_PRIVATE_DATASET_REPO`).

**Reason.** Same posture as D-017 — no licence-clean, non-synthetic pair
corpus exists in the repo, and committing a placeholder one would invite
training on fabricated preferences. Dry-run keeps CI meaningful: it
exercises the licence gate, the 2000-pair gate and manifest provenance
(data + golden sha256, git sha, licence) without torch, so a broken
config fails the build instead of the GPU box.

**Reverse.** Once reviewed pairs exist operator-side, run with
`--source patches --train`, then score before/after with
`ml/train/evaluate.py` + `ml/eval/run_eval.py` and record both rows in the
PROGRESS score log.

### D-021 — Two sessions, one checkout: isolate in a worktree, never rewrite shared history

**Decision.** When a second agent session was found working in the same
checkout (branch `task/1.3-vault-sync-resilience`), autopush was paused
immediately and Phase 3 was moved into a dedicated worktree
(`ml-phase-3`), with `ml/phase-3` cut from `origin/main`. History already
pushed by either session — including the `auto: update` commits that swept
Phase 3 files onto `main` and onto the task branch — was **left untouched**;
this phase's PR therefore carries only the delta that was still uncommitted
when the collision was found.

**Reason.** The D-012 soft-reset pattern requires force-pushing `main`,
which would destroy commits the other session has already pushed and may
be building a PR on. Two actors sharing one working tree also make branch
switches destructive. Isolating my work in a worktree is reversible and
harmless; rewriting shared history is neither. (The earlier mistake that
caused this — resuming autopush while other work was in flight — is why
autopush stays paused for the duration of a phase.)

**Reverse.** After both sessions have merged, optionally re-cut `main` into
one commit per phase with a coordinated force-push — not recommended while
any session is active. Prevention instead: keep the automation paused from
the first file write of a phase until the phase's docs commit lands, and
verify `automation.list` shows `paused` before writing anything. (Note:
during this collision the autopush automation was deleted outright rather
than paused and `automation.list` came back empty — it must be recreated
explicitly, and only when no session has uncommitted work in the shared
checkout.) Confirmed by the user on 2026-11-27: **leave it deleted** while
multiple sessions are active — manual pushes are the safe mode until only
one session is working; recreate the scheduled sweep only then.

### D-022 — The serving gateway refuses to fabricate output

**Decision.** `ml/serve/` (Phase 4) serves only registry entries with
`status: ready`; legacy `unverified` entries (D-013) are refused unless the
operator passes `--allow-unverified`, and `/health` reports which mode is
active. With no upstream or adapter configured every `POST
/v1/chat/completions` answers `503 upstream_not_configured` — the gateway
never emits a stand-in completion. `seo-studio-*` model ids migrate to the
persisted `seo-studio-*` ids on read only; `/v1/models` advertises both
spellings. `SERVE_API_KEY` (optional) requires a bearer on `/v1/*`, and logs
carry ids, status and latency only — never prompts.

**Reason.** The measured/suggested distinction collapses if a gateway can
silently answer with something other than the model. Unverified registry
entries must not be reachable in a default run (D-013), and the de-brand
rule allows alias-on-read but forbids rewriting persisted ids.

**Reverse.** `--allow-unverified` already exists as the operator-local
override; dropping the alias table is one dict entry in
`ml/serve/registry.py`; removing the bearer check means not setting
`SERVE_API_KEY`.

### D-023 — `ready` is earned: promotion runs an eleven-gate chain

**Decision.** An entry may carry `status: ready` only through
`python3 -m ml.serve.register`, which refuses unless: the manifest is a
real `mode: train` run (dry-run manifests can never promote), the base model
resolves through the Phase 3 allow-list with a matching licence, the frozen
golden sha agrees across manifest, run_eval report and the on-disk file,
training data sha + rows are recorded, the adapter artifact is named with
`weightsCommitted: false`, a git sha is present, the report covers every
golden case (skips are not passes), failures are within `--allow-failures`
(default 0, any allowance recorded in `statusReason`), and the report's
`outputsMeta` (when present) matches the manifest's adapter/base model. The
registry write is atomic (tmp + replace) with a `.bak`, is idempotent for
the same manifest, refuses a conflicting entry under the same modelId
without `--force`, and never touches legacy entries.

**Reason.** The two legacy entries reached `unverified` precisely because
their `ready` was typed rather than earned (D-013). The chain ties a
`ready` claim to the frozen golden set and to a real training run, so a
registry status can always be re-derived from artifacts, not trusted on
sight.

**Reverse.** `--allow-failures` and `--force` already exist as recorded
overrides; deleting `ml/serve/register.py` returns promotion to manual
registry edits (not recommended — that is how D-013 happened).

### D-024 — Golden-set generation gains an endpoint mode; the eval host needs no GPU

**Decision.** `ml/train/evaluate.py` gains `--endpoint URL` (with
`--api-key`, default `$SERVE_API_KEY`): each frozen request is POSTed to an
OpenAI-compatible server — typically `ml/serve` in front of the adapter —
at temperature 0, using only the standard library. Any HTTP, transport or
shape failure aborts with the case id and writes no output file. The
existing `--generate` local-GPU path is unchanged and mutually exclusive.
`ml/eval/run_eval.py` reports add an `outputsMeta` block (template version,
base model, adapter, endpoint, requested model — provenance only, never a
score).

**Reason.** Before this, scoring an adapter required torch + transformers
on the machine running `run_eval`, which pushed eval onto the GPU box and
made the "before" (base model) run awkward. Endpoint mode lets any host
score any served model, keeps the fail-closed rule (no invented outputs for
unreachable cases), and `outputsMeta` lets the promotion chain prove which
model produced a report.

**Reverse.** Delete the `--endpoint` branch and `OUTPUT_META_FIELDS`;
`--generate` and plain `run_eval --outputs` behave exactly as before.


---

## 2026-11-28 — AI SEO Model (v1) Readiness

### D-025 — v1 adapter scope locked to Tier 1 `schema_generation` and `metadata_generation`

**Decision.** Only Tier 1 `schema_generation` and `metadata_generation` route to the fine-tuned adapter. `rag_synthesis` and `entity_gap_analysis` stay on the Tier 2 frontier/free provider chain until a fine-tuned adapter beats Tier 2 on the frozen golden set.

**Reason.** Narrowing v1 to the two strictly structured, objectively gateable tasks minimizes hallucination blast radius while validating end-to-end training and serving.

**Reverse.** Expand `V1_ADAPTER_TASKS` in `src/core/claude.ts` once golden-set metrics show net improvement over Tier 2.

### D-026 — Teacher-model synthetic drafts require human review marks before training

**Decision.** Teacher-model synthetic outputs may enter training only after human review as `TrainingTriple` records; `ml/train/build_sft.py` excludes `repo-synthetic` (and `synthetic: true`) rows unless they carry an explicit human review mark, without editing `ml/sources.yaml`.

**Reason.** Preserves the immutability contract on `ml/sources.yaml` while preventing unreviewed synthetic contamination from entering weights.

**Reverse.** Pass an explicit reviewed flag on curated triples or adjust `is_human_reviewed` filter rules in `ml/train/build_sft.py`.

### D-027 — Qwen3 Apache-2.0 progression with 1.7B GGUF default serving target

**Decision.** Standardize v1 training progression on `Qwen/Qwen3-0.6B` (smoke test) -> `Qwen/Qwen3-1.7B` (baseline) -> `Qwen/Qwen3-4B` (candidate, all Apache-2.0 allow-listed). Default CPU/low-budget serving target is Qwen3-1.7B quantized to GGUF behind `ml/serve/server.py`.

**Reason.** Zero paid GPU serving budget means CPU/GGUF inference on 1.7B gives predictable latency and cost while preserving Apache-2.0 commercial safety.

**Reverse.** Update `ml/train/config.py` / `docs/ml/GPU_RUNBOOK.md` and `CUSTOM_MODEL_ID` after provisioning dedicated GPU serving.

### D-028 — Retire legacy Gemini 1.5 Flash registry entry

**Decision.** Retire the unverified `gemini-1.5-flash` entry in `data/models/model_registry.json` (`status: "retired"`, `activeModelId: null`) and refuse non-`ready` entries in both the app and `ml/serve/`.

**Reason.** Gemini 1.5 Flash is deprecated and was never verified on the golden set; leaving an unverified entry selectable risks silent misrouting.

**Reverse.** Only a newly trained model passing `python3 -m ml.serve.register` can earn `status: "ready"` and become `activeModelId`.

### D-029 — Ship `schema_generation` before `metadata_generation`

**Decision.** Ship and roll out `schema_generation` first (strictly machine-checkable JSON-LD `@type` and zero invented metrics), followed by `metadata_generation` (SERP pixel budgets + brand presence).

**Reason.** Objective deterministic verification makes schema quality regressions immediately catchable before broader copy rollout.

**Reverse.** Toggle `V1_ADAPTER_TASKS` or adapter mode gates per task.

### D-030 — Operator bearer token guard uses Web Crypto for Edge + Node parity

**Decision.** Implement `requireOperator(req)` in `src/lib/security/operator.ts` using `globalThis.crypto.subtle` SHA-256 digest normalization + constant-time XOR comparison. Unset `SEO_STUDIO_API_BEARER_TOKEN` allows with a one-line warning only when `NODE_ENV === "development"` and fails closed (`401`) otherwise; `GET /api/ai-training` returns counts + safe provider metadata unless a valid token is present.

**Reason.** Next.js Edge Middleware cannot reliably import `node:crypto`, and failing closed in every non-development environment prevents test/production bypasses.

**Reverse.** Swap `operatorAuthHeaders` / `requireOperator` for upstream SSO/JWT verification at the edge proxy.

---

## D-031 — Adapter rollout flag defaults to `off` (`AI_ADAPTER_MODE`)

**Status:** accepted (2026-11-28, WP5).

**Decision.** Add `AI_ADAPTER_MODE` (`off | shadow | canary | on`, defaulting to `off`) and `AI_ADAPTER_CANARY_PCT` (`0..100`, defaulting to `0`) in `src/core/ai/adapter-mode.ts` and enforce them inside `generateClaudeText` (`src/core/claude.ts`).

- `off`: never calls the custom adapter; traffic uses the standard/free provider chain.
- `shadow`: fires the adapter concurrently via `Promise.allSettled`, runs `gateOutput` on both results, records counter + latency metrics (`never` prompt or output text), and always returns the standard/free provider response.
- `canary`: hashes `propertyId || requestId || "anonymous"` deterministically with FNV-1a mod 100 and routes buckets `< AI_ADAPTER_CANARY_PCT` to the adapter with WP3 gate fallback.
- `on`: routes eligible v1 Tier 1 tasks (`schema_generation`, `metadata_generation`) to the adapter first with WP3 gate fallback.

**Reason.** Safe progressive deployment ensures production never shifts traffic to a newly hosted adapter merely because `CUSTOM_MODEL_ENDPOINT` is populated; suites testing active adapter dispatch must opt in via `AI_ADAPTER_MODE=on`.

**Reverse.** Remove `AI_ADAPTER_MODE` checks or default to `on` after production promotion gates pass.

---

## 2026-11-29 — v2

### D-032 — `ml/generate/` stays as v1 shipped it; dataset generation keeps its existing home

**Decision.** No restructuring of `ml/generate/` or `ml/dataset/` in v2. The
v2 WPs consume the existing generation entry points and add builder CLIs
(`build_dpo.py`) alongside `ml/train/build_sft.py`.

**Reason.** v1 (WP7) already shipped `ml/generate/constrained.py` with lazy
`outlines` import; moving or duplicating generation code adds drift risk with
no behaviour change.

**Reverse.** Move the entry points in one PR and update the runbook commands.

### D-033 — The review queue's local source of truth is a JSONL data file; Supabase ships as a mirror migration

**Decision.** Review rows and decisions persist through the existing
`seoStudioDataFile` mechanism (`data/ml-review-queue.jsonl` locally, the
`SEO_STUDIO_DATA_DIR` volume in deployment), mirroring the training-triples
store. A Supabase table with the same shape ships as
`supabase/migrations/0006_ml_review_queue.sql` for the deployment path.

**Reason.** The app already persists operator data (triples, rules, healing
events) through `seoStudioDataFile`; a second, Supabase-only write path would
need credentials and client wiring this run cannot test end to end. The
migration keeps the deployed schema in step so a later PR can switch the
store without a data reshape.

**Reverse.** Point `src/lib/review/store.ts` at the Supabase client (the table
already matches), keep the JSONL as an export path, and backfill existing
rows.

### D-034 — Approving a teacher triple flips it to `reviewed`, not `gold`

**Decision.** An approve in the review queue sets the underlying triple's
quality to `reviewed` (training-eligible). `gold` stays a stronger, separate
human judgement in the triple store.

**Reason.** Conservative default: approval through this queue proves the
output is usable, which is the definition of `reviewed`. Promoting to `gold`
should be a deliberate act by a reviewer who has checked the case against the
golden criteria.

**Reverse.** Map `approve` → `gold` in `recordDecision`, or add an explicit
`gold` action to the queue.

### D-035 — DPO pairs come from paired human decisions, keyed by input fingerprint

**Decision.** `ml/train/build_dpo.py` builds `data/build/dpo-v2.jsonl` from
three first-party sources (healing patch decisions, vault approve/reject
pairs, WP1 review-queue decisions on shadow disagreements). Decisions are
grouped by a stable input fingerprint; an input with only one decision kind
is counted and skipped — a single outcome is not a preference signal. Review-
queue rows carry the losing candidate inline (`originalOutput`), so one
approved row is enough for a shadow pair. A rejected review row never becomes
a train row.

**Reason.** Preference data must encode a real human choice between two
outputs. Reusing `build_sft.py`'s host split and `dpo.py`'s gate family keeps
one governance path.

**Reverse.** Relax `pair_decisions` to synthesize pairs from single
outcomes (not recommended), or add explicit pair producers.

### D-036 — Adapter task scope is measured per task (`readyTasks`), never hard-coded

**Decision.** The registry gains `readyTasks` + `readyTasksProvenance` per
entry. Only `ml.serve.register --ready-task <task> --baseline-report <r1>
--baseline-report <r2>` widens scope, and only when every ship gate for the
task passes (e.g. `jsonld_valid >= 95%`, `title_budget >= 90%`,
`invented_metrics = 0`) **and** the candidate beats both baselines (untuned
base + free provider) on the same golden cases. The router reads the active
ready entry's measured scope instead of v1's hard-coded `V1_ADAPTER_TASKS`;
provenance-less `readyTasks` is treated as empty everywhere (Python and TS,
fail closed). A requested task that fails refuses the whole promotion.

**Reason.** Tier 2 graduation was a v2 goal; a per-task measured scope is the
mechanism. With no ready entry the adapter serves no task — today's truth.

**Reverse.** Restore the hard-coded `V1_ADAPTER_TASKS` two-task list in
`ai/router.ts` (kept temporarily as a deprecated constant), or relax the
baselines requirement to a single baseline.

### D-037 — The extension never calls a model endpoint; inference is proxied through the app

**Decision.** `chrome-extension/src/engine/custom-model-client.ts` no longer
dials model endpoints and no longer sends model API keys anywhere: Auto-Fix,
GEO Summary and the connection test go through the SEO Studio backend
(`POST /api/extension/infer`, operator-token authed). The backend route runs
the task through the same `generateClaudeText` plumbing as the app
(`AI_ADAPTER_MODE`, output gates, canary, monitoring) and degrades with
`{ ok: false }` instead of leaking provider errors. `model-proxy.ts` enforces
an https-only (loopback-dev excepted), no-userinfo, no-private-IP origin
guard; every proxy failure falls back to the deterministic rules engine.
`CustomModelConfig.endpointId`/`apiKey` stay as legacy storage fields and are
never used as a network target.

**Reason.** The extension calling endpoints directly shipped user-stored
model keys to arbitrary URLs (including plain-http hosts) and bypassed every
output gate; the app backend already owns rollout state and gating, so
proxying keeps one safety path.

**Reverse.** Restore the direct-endpoint branches in
`custom-model-client.ts` (v1 behaviour) — not recommended; keys would again
leave the backend.
