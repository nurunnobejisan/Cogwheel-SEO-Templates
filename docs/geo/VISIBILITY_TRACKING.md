# AI visibility tracking

Track whether buyer prompts mention the brand and which domains the answer
cites. This is a **measurement** layer; it is not a rank tracker.

## Provider matrix

| Surface | Enable with | Key | Evidence |
| --- | --- | --- | --- |
| ChatGPT | Key set | `OPENAI_API_KEY` (paid add-on) | web-grounded citations when OpenAI returns annotations |
| Claude | Key set | `ANTHROPIC_API_KEY` (paid add-on) | web-grounded citations when Anthropic returns them |
| Perplexity | Key set | `PERPLEXITY_API_KEY` (paid add-on) | provider citations |
| Gemini (legacy adapter) | Key set | `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` | grounded search enabled |
| Gemini 2.x (grounded) | `VISIBILITY_FREE_PROVIDERS_ENABLED=true` | `GEMINI_API_KEY` (free tier) | `web_grounded` citations from grounding chunks only |
| Llama 3.3 (Groq) | `VISIBILITY_FREE_PROVIDERS_ENABLED=true` | `GROQ_API_KEY` (free tier) | `model_memory`; no citations |
| OpenRouter free tier | `VISIBILITY_FREE_PROVIDERS_ENABLED=true` | `OPENROUTER_API_KEY`, `:free` model | `model_memory`; no citations |
| Pollinations | `POLLINATIONS_ENABLED=true` | none (keyless) | `model_memory`; no citations |
| Google AI Overviews | — | — | Always `unavailable`; no official API |

The four free adapters are **default-off**. The legacy adapters keep their
original behaviour, so an installation with no keys reports no configured
engines. A running cost of $0 is only guaranteed while free-tier limits are
respected; the cost caps below are the guardrail.

Provider calls are capped per day and per minute:

- `VISIBILITY_DAILY_CALL_CAP` (default 60)
- `VISIBILITY_DAILY_COST_CAP_USD` (default 3)
- `VISIBILITY_RPM_DEFAULT` (default 20), with
  `VISIBILITY_RPM_GEMINI_GROUNDED`, `VISIBILITY_RPM_GROQ_LLAMA`,
  `VISIBILITY_RPM_OPENROUTER_FREE`, `VISIBILITY_RPM_POLLINATIONS` overrides.

Model overrides: `OPENAI_VISIBILITY_MODEL`, `ANTHROPIC_VISIBILITY_MODEL`,
`PERPLEXITY_MODEL`, `GEMINI_VISIBILITY_MODEL` (default `gemini-2.5-flash` for
the grounded adapter), `GROQ_VISIBILITY_MODEL`,
`OPENROUTER_VISIBILITY_MODEL` (must end in `:free`), and `POLLINATIONS_MODEL`.
Web-search grounding can be disabled with `OPENAI_WEB_SEARCH=false` or
`ANTHROPIC_WEB_SEARCH=false` when a key cannot use the tool; the answer is then
not search-grounded and should be treated accordingly.

## Endpoints

- `GET /api/visibility` — adapter status and recent runs.
- `POST /api/visibility` — run a **bounded batch** (1–4 prompts for one or more
  selected providers). The UI calls it once per provider and reports progress
  between batches so a run stays inside the 60-second function window.

```json
{
  "targetUrl": "https://examplehotel.com",
  "brand": "Example Hotel",
  "mode": "hotel",
  "city": "Denver",
  "category": "boutique hotel",
  "competitorDomains": ["rival.example"],
  "maxPrompts": 4,
  "providers": ["gemini_grounded"]
}
```

- `GET /api/visibility?targetUrl=...` — recent run summaries.
- `GET/POST /api/visibility/gaps` `{ targetUrl }` — gaps and approval-gated patch plans.

All endpoints require the operator session.

## Storage

Runs are appended to `SEO_STUDIO_DATA_DIR/runs.jsonl` (default: OS temp dir).
Production should back this with Supabase or a KV store; the interface is three
functions in `src/core/visibility/store.ts`.

## Honesty rules

- Brand mention matching is deterministic text search, not an LLM judge.
- `citationType: "web_grounded"` means the provider returned a live source;
  `citationType: "model_memory"` means any name came from the model's memory.
  The two are never merged into one citation number.
- URLs written inside a model-memory answer are not counted as citations.
- Competitor domains come from the operator. We never guess competitors.
- `mentioned: false` = an answer was measured and the brand was absent.
- `mentioned: null` = no provider answer was measured.
- A prompt is a gap only if at least one provider answered.
- Patch plans are `pending_approval`; nothing is applied automatically.
- Google AI Overviews has no official API, so it stays `unavailable`.
