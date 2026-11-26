# AI visibility tracking

Track whether buyer prompts mention the brand and which domains the answer
cites. This is a **measurement** layer; it is not a rank tracker.

## Provider matrix

| Surface | Key | Status |
| --- | --- | --- |
| ChatGPT | `OPENAI_API_KEY` | Adapter enabled when set |
| Claude | `ANTHROPIC_API_KEY` | Adapter enabled when set |
| Perplexity | `PERPLEXITY_API_KEY` | Adapter enabled when set |
| Gemini | `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` | Adapter enabled when set |
| Google AI Overviews | — | Always `unavailable`; no official API |

Provider calls are capped per day:

- `VISIBILITY_DAILY_CALL_CAP` (default 60)
- `VISIBILITY_DAILY_COST_CAP_USD` (default 3)

Model overrides: `OPENAI_VISIBILITY_MODEL`, `ANTHROPIC_VISIBILITY_MODEL`,
`PERPLEXITY_MODEL`, `GEMINI_VISIBILITY_MODEL`. Web-search grounding can be
disabled with `OPENAI_WEB_SEARCH=false` or `ANTHROPIC_WEB_SEARCH=false` when a
key cannot use the tool; the answer is then not search-grounded and should be
treated accordingly.

## Endpoints

- `GET /api/visibility` — adapter status and recent runs.
- `POST /api/visibility` — run a prompt set:

```json
{
  "targetUrl": "https://examplehotel.com",
  "brand": "Example Hotel",
  "mode": "hotel",
  "city": "Denver",
  "category": "boutique hotel",
  "competitorDomains": ["rival.example"],
  "maxPrompts": 8
}
```

- `GET /api/visibility?targetUrl=...` — recent run summaries.
- `GET /api/visibility/gaps?targetUrl=...` — gaps and approval-gated patch plans.

All endpoints require the operator session.

## Storage

Runs are appended to `COGWHEEL_DATA_DIR/runs.jsonl` (default: OS temp dir).
Production should back this with Supabase or a KV store; the interface is three
functions in `src/core/visibility/store.ts`.

## Honesty rules

- Brand mention matching is deterministic text search, not an LLM judge.
- Competitor domains come from the operator. We never guess competitors.
- `mentioned: false` = an answer was measured and the brand was absent.
- `mentioned: null` = no provider answer was measured.
- A prompt is a gap only if at least one provider answered.
- Patch plans are `pending_approval`; nothing is applied automatically.
