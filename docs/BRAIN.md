# Cogwheel SEO Brain

The brain is a thin interpretation layer over the **measured** audit engine.

## Architecture
- **Audit engine** (`/api/full-audit`, `src/core/full-audit`) produces measured facts + provenance.
- **GEO engine** (`rules/geo`, `src/rules/geo`, `/api/geo/check`) measures llms.txt, AI-crawler rules, citability and drift.
- **Visibility tracker** (`src/core/visibility`, `/api/visibility`) asks BYOK provider adapters a fixed buyer-prompt set and records mentions/citations over time.
- **RAG** (`src/core/brain`, `ai/rag`) indexes `docs/`, `templates/`, `rules/`, `data/`, `schemas/`, `shared/` plus curated seed + GEO knowledge chunks.
- **LLM interpretation** (`src/core/claude.ts`) is optional; when no provider is configured, or a provider fails, the brain returns a deterministic, measured-only summary.
- **Hard constraint**: the system prompt forbids inventing rankings, volumes, citations, competitor names, fees, or revenue. Unavailable dimensions are reported as unavailable.

## Tool registry
`src/core/brain/tools.ts` exposes:

| Tool | Provenance | Notes |
| --- | --- | --- |
| `full_audit` | measured | Full website audit, including the optional GEO report |
| `schema_check` | measured | Schema validation from the audit |
| `keyword_research` | measured / unavailable | Only measured when a keyword provider is configured |
| `search_console` | measured / unavailable | Requires a connected GSC property |
| `serp_data` | measured | Title/pixel budget only; no live SERP provider |
| `llms_check` | measured / unavailable | Live llms.txt status, score, failed checks |
| `citability` | estimated | 0–100 documented weighted heuristic with inputs |
| `drift` | measured / unavailable | Snapshot diff; unavailable until a baseline exists |
| `visibility_tracker` | measured / unavailable | Latest stored prompt × provider run |
| `gap_detector` | measured / unavailable | Prompts with a measured answer but no brand mention |

## Endpoints
- `POST /api/brain` `{ targetUrl, question?, maxPages? }` → measured audit + retrieved chunks + interpretation + `provenanceCheck`.
- `GET /api/brain?targetUrl=...` → same, without a question.
- `POST /api/geo/check` `{ targetUrl, persist? }` → llms.txt, AI-crawler, citability, drift.
- `GET /api/geo/check?url=...` → same via query string.
- `POST /api/visibility` `{ targetUrl, brand?, mode, city?, category?, competitorDomains?, maxPrompts?, providers? }` → run + gaps + reviewable `pending_approval` patch plans.
- `GET /api/visibility?targetUrl=...` → adapter status and recent runs.
- `GET/POST /api/visibility/gaps` `{ targetUrl }` → gaps and patch plans for the latest run.
- `POST /api/training-triples` `{ url, audit, expertFix, consent, tosAccepted }` → append a raw training triple (JSONL).
- `GET /api/training-triples` → counts and triples; `?eligible=true` returns only reviewed/gold.
- `POST /api/training-triples/review` `{ id, quality }` → operator tier change.
- `GET/POST /api/outcomes` → record a deployed change and measure its Search Console before/after (with a control set); see `docs/OUTCOMES.md`.

All endpoints require a signed operator session and use the shared rate-limit classes.

## Claim-to-field provenance
Every sentence in the interpretation must either:

1. cite a retrieved chunk id that was actually returned to the model (`[kc-title-tag]`), or
2. share enough content words with the measured audit/tool data or a retrieved chunk, with every number appearing in that source material.

Sentences that explicitly declare a dimension unavailable are allowed (they are honesty statements). If an LLM answer fails the gate, the brain replaces it with the deterministic measured summary and re-checks. If that also fails, the API returns **422** with the failing claims rather than serving an unsupported answer.

## Training data
Triples are `{ url, audit (measured), expertFix }` plus consent and a robots/ToS gate. Tiers are `raw`, `reviewed`, `gold`; only `reviewed` and `gold` are training-eligible. Each triple also carries `tenantId` (the operator's organisation, for per-tenant isolation) and a required `provenance` (`measured` | `estimated` | `unavailable`). Raw captures are PII-stripped and deduplicated by content hash (identical `audit` + `expertFix`); the same URL may be captured again with a different reviewed fix. The extension training vault sets new captures to `tier: "raw"` and requires consent.

Capture is wired into the Studio via one shared, gated panel (`src/components/TrainingCaptureCard.tsx`, `src/lib/training-capture.ts`). Two surfaces feed it: the **Content Studio** (`ContentStudio.tsx`, step 4), where the operator accepts/rejects and edits generated copy, and the **page-to-keyword Approval Matrix** (`Studio.tsx`, step 3), where the operator approves and edits the allocator's assignments. In both, the operator's accepted, edited result is the `expertFix` and the AI/allocator proposal is the `audit`. Nothing is captured automatically, and such triples are tagged `provenance: "estimated"` because the source is operator-supplied data rather than a live crawl.

### Data-governance gate (`npm run train:validate`)
CI fails if any row in `data/training/*.jsonl`:
- contains an unresolved `{{placeholder}}`,
- asserts an invented metric (currency, `%`, CPC, search volume, authority, rank, or counts of searches/backlinks/impressions/clicks) **that is not traceable to the user-supplied text**,
- lacks a recognised `meta.category` or `meta.provenance`, or
- duplicates another row's content.

`scripts/clean-training-data.py` (`npm run train:clean`) is the deterministic, idempotent fixer: it instantiates placeholders from coherent hotel profiles and replaces fabricated `Benchmark CPC` / `Search Volume Tier` lines with an explicit “unavailable” line. Provenance is `unavailable` because the SFT rows carry guidance, not measured client metrics.

## Evals
Gold set format: `data/brain-gold.example.json`. Each entry:
```json
{ "url": "https://example.com", "expectedActionTitles": ["..."], "forbiddenTokens": ["ranking", "volume"], "verifiedBy": "operator" }
```
Run `npm run brain:eval -- data/brain-gold.json` (requires network + optional LLM key). It reports:
- **finding accuracy** vs hand-supplied `expectedActionTitles`
- **fix quality** (an estimated completeness heuristic, labelled as such)
- **fabrication rate** from untraced numbers/claims and forbidden tokens

Fabrication rate > 0 exits non-zero and blocks CI. The example file stays small until the user fills `data/brain-gold.json` and `data/brain-gold-prompts.template.json` by hand. Labels are never generated by a model.

## Fine-tuning (gated)
`npm run brain:export-lora` writes ChatML JSONL from reviewed/gold pairs only, with a manifest. Training is **not** started by the export. The script reports `BLOCKED` until at least 2,000 reviewed/gold pairs exist, and `--require-ready` turns that into a CI failure. Training data is our own audit → expert-fix pairs; no third-party repository code is used.
