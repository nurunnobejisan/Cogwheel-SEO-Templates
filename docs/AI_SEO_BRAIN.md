# AI SEO Brain & RAG — Implementation Notes (Phase 2)

Implements **Phase 2** of [`ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md`](./ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md):
the multi-tier model router, the RAG vector knowledge base, the prompt
construction engine, and the strict JSON patch pipeline that converts an
`AuditReport` (Phase 1) into a machine-applicable `FixPatch` (Phase 3 input).

The layer is additive — it consumes the Phase 1 audit payload and produces a new
artifact. Nothing in the existing hotel workflows is modified.

## Layout

```
ai/
├── index.ts                 # public barrel
├── types.ts                 # FixPatch / RagChunk / RouteDecision contracts
├── router.ts                # task → tier (tier1 fast / tier2 frontier) routing
├── prompt.ts                # grounded prompt construction + JSON contract
├── orchestrator.ts          # AuditReport → FixPatch (model + deterministic fallback)
├── rag/
│   ├── index.ts             # createRagPipeline() (embedder + index + seed corpus)
│   ├── embedder.ts          # dependency-free hashing embedder
│   ├── knowledge-base.ts    # cosine vector index + document chunker
│   └── seed-knowledge.ts    # curated SEO knowledge corpus
└── patch/
    ├── index.ts
    ├── schema.ts            # Zod FixPatch schema + allowed CMS fields
    ├── validator.ts         # strict validation, risk tiers, auto-pilot gate
    └── synthesizer.ts       # deterministic (no-LLM) patch generation
```

## Pipeline

```
AuditReport ─▶ classify task ─▶ route tier ─▶ RAG retrieve ─▶ prompt ─▶ model
                                                                        │
                        deterministic synthesizer ◀────────────────────┘ (fallback)
                                   │
                                   ▼
                        strict JSON patch validation  ─▶  FixPatch
```

```ts
import { generateFixPatch } from "./ai/index.ts";
import { runAudit, buildSnapshotFromHtml } from "./rules/index.ts";

const report = runAudit(buildSnapshotFromHtml(html, url));
const { patch, validation, deferred } = await generateFixPatch(report, {
  autoPilot: true,            // deploy low-risk mutations automatically
  // invoker: myModelInvoker, // optional — omit to run deterministically
});
```

### 1. Multi-tier model router (`router.ts`)

| Tier | Tasks | Providers |
| --- | --- | --- |
| **Tier 1** (fast/cheap) | `structured_extraction`, `metadata_generation`, `alt_text_generation`, `schema_generation` | Gemini Flash, Groq Llama, Cogwheel tuned model |
| **Tier 2** (frontier) | `semantic_reasoning`, `rag_synthesis`, `intent_mapping`, `entity_gap_analysis` | Claude (if key), OpenRouter |

Model ids and provider defaults live in `src/core/ai/models.ts` and are **free-first**:
with no paid key the pipeline runs on free tiers (Gemini → Groq → OpenRouter →
Pollinations) and every id is env-overridable. `loadProviders()` reads the same
env credentials as `src/core/claude.ts`. When no provider is configured the
router reports it and the deterministic synthesizer runs alone, so the pipeline
never hard-fails.

### 2. RAG knowledge base (`rag/`)

- **Embedder** — a dependency-free FNV hashing-trick embedder (unigrams + bigrams),
  L2-normalised, so the pipeline works offline and in CI. Swap in Voyage/OpenAI/…
  by implementing `Embedder`.
- **Index** — in-memory cosine similarity with tag filtering and `topK`; the
  interface matches a Pinecone/Qdrant adapter.
- **Corpus** (`seed-knowledge.ts`) — curated, paraphrased summaries of Google
  Search Central, the Search Quality Rater Guidelines (E-E-A-T), Schema.org,
  Core Web Vitals, WCAG image guidance and GEO/AI-search guidance. Each chunk
  carries `tags` keyed to the Phase 1 issue ids so retrieval is targeted.

### 3. Prompt construction (`prompt.ts`)

`buildPatchPrompt()` assembles the strict JSON-only system contract, the specific
issue, the page facts and the retrieved knowledge chunks. `buildRagQuery()` maps
an issue to a retrieval query (including a hospitality hint in Hotel Mode).

### 4. Strict JSON patch validation (`patch/`)

- **Schema** (`schema.ts`) — Zod-validated `FixPatch` with an allow-list of CMS
  fields (`ALLOWED_CMS_FIELDS`).
- **Validator** (`validator.ts`) — rejects freeform prose, action/value
  mismatches, disallowed fields, wrong risk tiers, SERP budget overruns
  (`title` ≤ 60, `meta_description` ≤ 160), `auditId` mismatches and risk-ceiling
  breaches. `assertJsonOnly()` guards the raw model boundary.
- **Risk & auto-pilot** — every CMS field has an operational tier
  (`meta_description` = low, `json_ld_schema` = medium, `meta_robots` = high).
  With `autoPilot: true`, only low-risk, non-`manual_review` mutations are marked
  `autoApply`; everything else is queued for review.
- **Synthesizer** (`synthesizer.ts`) — deterministic generators for titles,
  descriptions, canonical, viewport, OG/Twitter tags, alt text (from filenames)
  and structured data (Organization, or LodgingBusiness in Hotel Mode). Unsafe
  issues (noindex, thin content, asset transforms, link replacement) become
  `manual_review`.

## Patch contract

```json
{
  "patchId": "ptch_...",
  "auditId": "aud_..._univ",
  "targetUrl": "https://example.com/products/widgets",
  "mode": "universal",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "mutations": [
    { "field": "meta_description", "action": "replace", "before": "", "after": "…", "risk": "low", "autoApply": true },
    { "field": "json_ld_schema", "action": "inject", "before": null, "after": { "@type": "Organization", "…": "…" }, "risk": "medium", "autoApply": false }
  ]
}
```

Machine-readable schema: `schemas/fix-patch.schema.json`.

## Tests

`tests/ai-seo-brain.test.ts` (Vitest, **28 tests**) covers tier routing, provider
loading and degradation, embedder determinism/normalisation, corpus retrieval and
tag filtering, document chunking, prompt grounding, the full validation matrix,
risk/auto-pilot gating, the deterministic synthesizer (including hotel schema) and
the end-to-end orchestrator (model path + fallback, deferral, idempotent ids).

```bash
npx vitest run tests/ai-seo-brain.test.ts tests/universal-mode.test.ts
```

## Remaining Phase 2 items

- Plug a real embedding provider (Voyage/OpenAI/Gemini) and an external vector DB
  (Pinecone/Qdrant) behind `Embedder` / `KnowledgeBase`.
- Wire the `ModelInvoker` to `src/core/claude.ts` for production inference.
- Persist generated patches and audit runs to the backend `runs` store.
- Render the diff preview (before/after) in the side panel before deployment.
