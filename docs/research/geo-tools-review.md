# GEO / AI-visibility tools — source review

Verified **2026-11-26** against the GitHub API (stars, license, last push) and each
project's README. Policy: only MIT, Apache-2.0 and BSD code may be adapted. We
port small logic units behind our own interfaces; we never vendor a repository.
Anything copyleft, unlicensed, or stale is treated as **ideas only**.

## Summary

| Project | License | Stars | Last push | Decision |
| --- | --- | ---: | --- | --- |
| [elmohq/elmo](https://github.com/elmohq/elmo) | MIT | 729 | 2026-11-26 | Adapt ideas |
| [Auriti-Labs/geo-optimizer-skill](https://github.com/Auriti-Labs/geo-optimizer-skill) (GeoReady) | MIT | 1,391 | 2026-11-25 | Adapt ideas + method list |
| [limelit-co/open](https://github.com/limelit-co/open) | Apache-2.0 | 458 | 2026-11-21 | Adapt ideas |
| [OranAi-Ltd/orangeo-ai-visibility-skill](https://github.com/OranAi-Ltd/orangeo-ai-visibility-skill) (PixelOrange7) | MIT | 145 | 2026-06-09 | Ideas only — frozen |
| [GEO-optim/GEO](https://github.com/GEO-optim/GEO) (GEO paper code) | Apache-2.0 | 353 | 2025-10-30 | Ideas only — research code |
| [cloudapp-dev/awesome-open-geo](https://github.com/cloudapp-dev/awesome-open-geo) | CC0-1.0 | 12 | 2026-08-20 | Index only |
| [ansvisor/ansvisor](https://github.com/ansvisor/ansvisor) | MIT | 254 | 2026-11-25 | Reviewed, not adapted |
| [alexpospekhov/searchstack-aeo](https://github.com/alexpospekhov/searchstack-aeo) | MIT | 115 | 2026-09-29 | Reviewed, not adapted |
| [gooseworks-ai/goose-aeo](https://github.com/gooseworks-ai/goose-aeo) | MIT | 32 | 2026-03-27 | Reviewed, not adapted |
| [AI2HU/gego](https://github.com/AI2HU/gego) | GPL-3.0 | 112 | 2026-07-23 | **Rejected — copyleft** |
| [zubair-trabzada/geo-seo-claude](https://github.com/zubair-trabzada/geo-seo-claude) | MIT | 11,860 | 2026-11-25 | Reviewed, not adapted |

## Accepted sources (ideas adapted, code written by us)

### 1. elmohq/elmo — AI visibility tracking
- **Repo:** https://github.com/elmohq/elmo
- **License:** MIT
- **Activity:** created 2025-08-29; 729 stars, 187 forks, 167 open issues; pushed 2026-11-26. Actively maintained.
- **Reuse:** the shape of a visibility product — prompt sets, per-engine mention/citation capture, share-of-voice denominators, and an MCP-first tool surface. We implement our own adapter interface, storage and metrics.
- **Skip:** the TanStack/Postgres/pg-boss platform, Cloro scraping, the hosted "Jev" judge. Too heavy, and an LLM judge would weaken our claim-to-source guarantees.
- **Risk:** low (MIT). No code copied.

### 2. Auriti-Labs/geo-optimizer-skill (GeoReady) — readiness engine
- **Repo:** https://github.com/Auriti-Labs/geo-optimizer-skill
- **License:** MIT
- **Activity:** 1,391 stars, 145 forks, 0 open issues; pushed 2026-11-25. Very active; published on PyPI as `geo-optimizer-skill` with an MCP server.
- **Reuse:** the check taxonomy — llms.txt presence/validity, AI-crawler rules (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …), a 0–100 citability score, score versioning, and drift detection with a CI threshold. We write our own deterministic implementation with visible formulas.
- **Skip:** the CLI, SQLite tracking store, and hosted GeoReady.
- **Risk:** low (MIT).

### 3. limelit-co/open — agent loop for GEO gaps
- **Repo:** https://github.com/limelit-co/open
- **License:** Apache-2.0
- **Activity:** 458 stars, 180 forks, 7 open issues; pushed 2026-11-21. Pre-release (`v0.1`) but active.
- **Reuse:** deterministic brand/competitor mention matching instead of an LLM judge; citation classification (own / competitor / social / informational / other); denominator rules (exclude branded prompts, exclude non-rendered surfaces); gap → fix-list flow.
- **Skip:** the Go binary, SQLite store, hosted-only sentiment and fan-out analysis.
- **Risk:** low (Apache-2.0); NOTICE attribution retained in `THIRD_PARTY_NOTICES.md`.

### 4. GEO paper + GEO-bench (KDD 2024)
- **Paper:** https://arxiv.org/abs/2311.09735
- **Benchmark:** https://huggingface.co/datasets/GEO-Optim/geo-bench (10k queries)
- **Code:** https://github.com/GEO-optim/GEO (Apache-2.0)
- **Activity:** paper published 2024-06-28; code last pushed 2025-10-30.
- **Reuse:** the method families that lift generative-engine visibility — citing sources, adding quotations, adding statistics, and improving fluency/clarity — plus the idea of a prompt benchmark. The paper reports up to ~40% relative visibility improvement; we cite it rather than restating per-method percentages as if we measured them.
- **Skip:** all code. It is research code, and our audit engine is deterministic TypeScript.
- **Risk:** low (ideas only).

## Reviewed, not adapted

- **ansvisor/ansvisor** — MIT, 254 stars, active. Visibility platform. Overlaps Elmo/Limelit; no logic adopted.
- **searchstack-aeo** — MIT, 115 stars, pushed 2026-09-29. Python monitoring stack; we use TypeScript adapters instead.
- **goose-aeo** — MIT, 32 stars, last push 2026-03-27. CLI + agent-driven dashboard; too small and slow-moving to depend on.
- **zubair-trabzada/geo-seo-claude** — MIT, 11.8k stars, active. Citability scoring; useful cross-check but no code needed.
- **cloudapp-dev/awesome-open-geo** — CC0 index. Used for discovery only.

## Rejected

- **AI2HU/gego** — GPL-3.0. Copyleft is incompatible with adapting code into this repository under our current licensing. **No code, no ported logic.**
- **PixelOrange7 / OranAi-Ltd orangeo** — MIT, but one initial commit (2026-06-09) and no activity since. Kept as an idea source for buyer prompts and readiness checks; **not a dependency**, and we prefer GeoReady's more complete check list.
- Any project without a clear OSI license: ideas only.

## What we actually built from this review

1. `rules/geo/` — deterministic llms.txt validation, AI-crawler robots parsing, a documented 0–100 citability formula, and snapshot drift diffing.
2. `src/core/visibility/` — our own prompt-set generator, BYOK provider adapters (no key ⇒ `unavailable`), local-first run store, and a gap detector that emits approval-gated plans.
3. `ai/rag/geo-knowledge.ts` — GEO paper findings and playbooks as citable chunks, with a recall@k test.
4. Brain tools `llms-check`, `citability`, `drift`, `visibility-tracker`, `gap-detector`, wired into `/api/brain` with claim-to-field provenance.

No source repository is vendored. See `THIRD_PARTY_NOTICES.md`.
