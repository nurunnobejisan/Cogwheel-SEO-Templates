# Cogwheel SEO Brain

The brain is a thin interpretation layer over the **measured** audit engine.

## Architecture
- **Audit engine** (`/api/full-audit`, `src/core/full-audit`) produces measured facts + provenance.
- **RAG** (`src/core/brain`, `ai/rag`) indexes `docs/`, `templates/`, `rules/`, `data/`, `schemas/`, `shared/` and the curated seed corpus.
- **LLM interpretation** (`src/core/claude.ts`) is optional; when no provider is configured the brain returns a deterministic, measured-only summary.
- **Hard constraint**: the system prompt forbids inventing rankings, volumes, citations, competitor names, fees, or revenue. Unavailable dimensions are reported as unavailable.

## Endpoints
- `POST /api/brain` `{ targetUrl, question?, maxPages? }` → measured audit + retrieved chunks + interpretation.
- `POST /api/training-triples` `{ url, audit, expertFix }` → append a training triple (JSONL).
- `GET /api/training-triples` → count.

## Training data
Triples are `{ url, audit (measured), expertFix }`. The extension training vault remains the client-side store for page + audit + expert fix; this endpoint is the server-side collection point for evaluation and future fine-tuning.

## Evals
Gold set format: `data/brain-gold.example.json`. Each entry:
```json
{ "url": "https://example.com", "expectedActionIds": ["..."], "forbiddenTokens": ["ranking", "volume"] }
```
Run `npm run brain:eval` (requires network + optional LLM key). Fabrication rate must be 0.

## Fine-tuning (later)
Only after ~2-5k clean audit-to-recommendation pairs. Use LoRA on a small open model for cheap tasks (meta/heading rewrites); keep a frontier model for complex audits.
