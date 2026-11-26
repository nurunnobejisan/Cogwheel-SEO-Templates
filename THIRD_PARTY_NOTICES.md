# Third-party notices

Cogwheel SEO & GEO Studio adapts **ideas and small logic patterns** from the
open-source projects below. No entire repository is vendored, and no
third-party source code is copied into this repository unless explicitly noted.

## Adapted (ideas, interfaces, method lists)

### elmohq/elmo
- https://github.com/elmohq/elmo
- MIT License
- Influence: visibility-tracking product shape, prompt sets, per-engine
  mention/citation capture, share-of-voice denominators.
- Code copied: none.

### Auriti-Labs/geo-optimizer-skill (GeoReady)
- https://github.com/Auriti-Labs/geo-optimizer-skill
- MIT License
- Influence: llms.txt and AI-crawler check taxonomy, citability scoring
  categories, drift detection with a CI threshold.
- Code copied: none; our implementation is deterministic TypeScript with
  documented formulas.

### limelit-co/open
- https://github.com/limelit-co/open
- Apache License 2.0
- Influence: deterministic mention matching, citation classification, prompt
  denominator rules, gap → fix-list flow.
- Code copied: none.

### OranAi-Ltd/orangeo-ai-visibility-skill (PixelOrange7)
- https://github.com/OranAi-Ltd/orangeo-ai-visibility-skill
- MIT License
- Influence: buyer-prompt categories and llms.txt/AI-crawler readiness ideas.
- Code copied: none.

## Research reference (no code)

**GEO: Generative Engine Optimization** — Aggarwal et al., KDD 2024.
- Paper: https://arxiv.org/abs/2311.09735
- Benchmark: https://huggingface.co/datasets/GEO-Optim/geo-bench
- Influence: GEO method families (cite sources, quotations, statistics,
  fluency) and the benchmark-style prompt evaluation. We cite the paper's
  findings; we do not present them as our own measurements.

## Reviewed, not incorporated

- ansvisor/ansvisor — MIT
- alexpospekhov/searchstack-aeo — MIT
- gooseworks-ai/goose-aeo — MIT
- zubair-trabzada/geo-seo-claude — MIT
- cloudapp-dev/awesome-open-geo — CC0-1.0 (index only)

## Rejected

- AI2HU/gego — GPL-3.0. No code or ported logic; copyleft is incompatible with
  adapting code into this repository.

## Provider APIs

All AI-provider calls are BYOK (bring your own key) and disabled when the
corresponding environment variable is absent. No keys are stored in the
repository. Daily call and cost caps apply to every provider path.

- OpenAI (ChatGPT) — API terms apply.
- Anthropic (Claude) — API terms apply.
- Perplexity — API terms apply.
- Google (Gemini) — API terms apply.
- Google AI Overviews — no official public API; the adapter reports
  `unavailable` rather than scraping or fabricating results.
